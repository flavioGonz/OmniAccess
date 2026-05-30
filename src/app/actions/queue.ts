"use server";

import { prisma } from "@/lib/prisma";

// --- Get Queue Events (history) ---
export async function getQueueEvents(options?: {
    take?: number;
    skip?: number;
    deviceId?: string;
    channelName?: string;
    from?: Date;
    to?: Date;
    minCount?: number;
}) {
    const where: any = {};

    if (options?.deviceId) where.deviceId = options.deviceId;
    if (options?.channelName) where.channelName = options.channelName;
    if (options?.minCount) where.peopleCount = { gte: options.minCount };

    if (options?.from || options?.to) {
        where.timestamp = {};
        if (options?.from) where.timestamp.gte = options.from;
        if (options?.to) where.timestamp.lte = options.to;
    }

    const [events, total] = await Promise.all([
        prisma.queueEvent.findMany({
            where,
            take: options?.take ?? 50,
            skip: options?.skip ?? 0,
            orderBy: { timestamp: "desc" },
            include: { device: true },
        }),
        prisma.queueEvent.count({ where }),
    ]);

    return { events, total };
}

// --- Get latest count per channel (live view) ---
export async function getLatestQueueCounts() {
    const devices = await prisma.device.findMany({
        where: { deviceType: "QUEUE_COUNTER" },
        select: { id: true, name: true, ip: true, location: true, brand: true },
    });

    if (devices.length === 0) return [];

    const results = [];

    for (const device of devices) {
        const latestEvents = await prisma.$queryRaw<
            { channelName: string; channelId: number; peopleCount: number; timestamp: Date; snapshotPath: string | null }[]
        >`
            SELECT DISTINCT ON ("channelName")
                "channelName", "channelId", "peopleCount", "timestamp", "snapshotPath"
            FROM "QueueEvent"
            WHERE "deviceId" = ${device.id}
            ORDER BY "channelName", "timestamp" DESC
        `;

        // Live aforo: mirror exactly what the camera's OccupancyCounter sends (1 -> 1, 0 -> 0).
        // No app-side hold/smoothing. Stability is handled at the camera (VCA "Tiempo de rebote").
        results.push({
            device,
            channels: latestEvents.map(e => ({
                channelName: e.channelName || `Canal ${e.channelId}`,
                channelId: e.channelId,
                peopleCount: e.peopleCount,
                lastUpdate: e.timestamp,
                snapshotPath: e.snapshotPath,
            })),
        });
    }

    return results;
}

// --- Get today's queue stats ---
export async function getQueueStatsToday() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [totalEvents, avgCount, maxCount, alertsFired] = await Promise.all([
        prisma.queueEvent.count({
            where: { timestamp: { gte: startOfDay } },
        }),
        prisma.queueEvent.aggregate({
            where: { timestamp: { gte: startOfDay } },
            _avg: { peopleCount: true },
        }),
        prisma.queueEvent.aggregate({
            where: { timestamp: { gte: startOfDay } },
            _max: { peopleCount: true },
        }),
        prisma.queueAlert.count({
            where: {
                lastFiredAt: { gte: startOfDay },
            },
        }),
    ]);

    return {
        totalEvents,
        avgCount: Math.round((avgCount._avg.peopleCount || 0) * 10) / 10,
        maxCount: maxCount._max.peopleCount || 0,
        alertsFired,
    };
}

// --- Get hourly breakdown for chart ---
export async function getQueueHourlyBreakdown(deviceId?: string, date?: Date) {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const where: any = {
        timestamp: { gte: startOfDay, lte: endOfDay },
    };
    if (deviceId) where.deviceId = deviceId;

    const events = await prisma.queueEvent.findMany({
        where,
        select: { timestamp: true, peopleCount: true },
        orderBy: { timestamp: "asc" },
    });

    const hourly: { hour: number; avg: number; max: number; count: number }[] = [];
    for (let h = 0; h < 24; h++) {
        const hourEvents = events.filter(e => new Date(e.timestamp).getHours() === h);
        if (hourEvents.length === 0) {
            hourly.push({ hour: h, avg: 0, max: 0, count: 0 });
        } else {
            const counts = hourEvents.map(e => e.peopleCount);
            hourly.push({
                hour: h,
                avg: Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10,
                max: Math.max(...counts),
                count: hourEvents.length,
            });
        }
    }

    return hourly;
}

// --- CRUD for QueueAlerts ---
export async function getQueueAlerts() {
    return prisma.queueAlert.findMany({
        include: { device: { select: { id: true, name: true, ip: true } } },
        orderBy: { createdAt: "desc" },
    });
}

export async function createQueueAlert(data: {
    name: string;
    deviceId?: string;
    channelName?: string;
    threshold: number;
    cooldownMin?: number;
    cooldownSec?: number;
}) {
    const sec = data.cooldownSec ?? (data.cooldownMin != null ? data.cooldownMin * 60 : 30);
    return prisma.queueAlert.create({
        data: {
            name: data.name,
            deviceId: data.deviceId || null,
            channelName: data.channelName || null,
            threshold: data.threshold,
            cooldownMin: Math.max(1, Math.round(sec / 60)),
            cooldownSec: sec,
        },
    });
}

export async function updateQueueAlert(id: string, data: {
    name?: string;
    deviceId?: string | null;
    channelName?: string | null;
    threshold?: number;
    enabled?: boolean;
    cooldownMin?: number;
    cooldownSec?: number;
}) {
    const upd: any = { ...data };
    if (data.cooldownSec != null) {
        upd.cooldownSec = data.cooldownSec;
        upd.cooldownMin = Math.max(1, Math.round(data.cooldownSec / 60));
    }
    return prisma.queueAlert.update({ where: { id }, data: upd });
}

export async function deleteQueueAlert(id: string) {
    return prisma.queueAlert.delete({ where: { id } });
}

// --- Get daily breakdown (for a date range) ---
export async function getQueueDailyBreakdown(deviceId?: string, from?: Date, to?: Date) {
    const end = to || new Date();
    const start = from || (() => { const d = new Date(end); d.setDate(d.getDate() - 30); return d; })();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const where: any = { timestamp: { gte: start, lte: end } };
    if (deviceId) where.deviceId = deviceId;

    const events = await prisma.queueEvent.findMany({
        where,
        select: { timestamp: true, peopleCount: true },
        orderBy: { timestamp: "asc" },
    });

    const dayMap = new Map<string, number[]>();
    for (const e of events) {
        const d = new Date(e.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const arr = dayMap.get(key) || [];
        arr.push(e.peopleCount);
        dayMap.set(key, arr);
    }

    const result: { date: string; avg: number; max: number; count: number; total: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        const counts = dayMap.get(key) || [];
        result.push({
            date: key,
            avg: counts.length > 0 ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10 : 0,
            max: counts.length > 0 ? Math.max(...counts) : 0,
            count: counts.length,
            total: counts.reduce((a, b) => a + b, 0),
        });
        cursor.setDate(cursor.getDate() + 1);
    }
    return result;
}

// --- Get weekly breakdown ---
export async function getQueueWeeklyBreakdown(deviceId?: string, from?: Date, to?: Date) {
    const end = to || new Date();
    const start = from || (() => { const d = new Date(end); d.setDate(d.getDate() - 12 * 7); return d; })();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const where: any = { timestamp: { gte: start, lte: end } };
    if (deviceId) where.deviceId = deviceId;

    const events = await prisma.queueEvent.findMany({
        where,
        select: { timestamp: true, peopleCount: true },
        orderBy: { timestamp: "asc" },
    });

    const weekMap = new Map<string, number[]>();
    for (const e of events) {
        const d = new Date(e.timestamp);
        const jan1 = new Date(d.getFullYear(), 0, 1);
        const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
        const key = `${d.getFullYear()}-S${String(week).padStart(2, "0")}`;
        const arr = weekMap.get(key) || [];
        arr.push(e.peopleCount);
        weekMap.set(key, arr);
    }

    return Array.from(weekMap.entries()).map(([week, counts]) => ({
        week,
        avg: Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10,
        max: Math.max(...counts),
        count: counts.length,
        total: counts.reduce((a, b) => a + b, 0),
    })).sort((a, b) => a.week.localeCompare(b.week));
}

// --- Get monthly breakdown ---
export async function getQueueMonthlyBreakdown(deviceId?: string, from?: Date, to?: Date) {
    const end = to || new Date();
    const start = from || (() => { const d = new Date(end); d.setMonth(d.getMonth() - 12); return d; })();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const where: any = { timestamp: { gte: start, lte: end } };
    if (deviceId) where.deviceId = deviceId;

    const events = await prisma.queueEvent.findMany({
        where,
        select: { timestamp: true, peopleCount: true },
        orderBy: { timestamp: "asc" },
    });

    const monthMap = new Map<string, number[]>();
    for (const e of events) {
        const d = new Date(e.timestamp);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const arr = monthMap.get(key) || [];
        arr.push(e.peopleCount);
        monthMap.set(key, arr);
    }

    return Array.from(monthMap.entries()).map(([month, counts]) => ({
        month,
        avg: Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10,
        max: Math.max(...counts),
        count: counts.length,
        total: counts.reduce((a, b) => a + b, 0),
    })).sort((a, b) => a.month.localeCompare(b.month));
}

// --- Get queue devices for selects ---
export async function getQueueDevices() {
    return prisma.device.findMany({
        where: { deviceType: "QUEUE_COUNTER" },
        select: { id: true, name: true, ip: true, location: true, brand: true },
        orderBy: { name: "asc" },
    });
}


// --- Get queue notifications (events that crossed an enabled alert threshold) ---
export async function getQueueNotifications(options?: { take?: number }) {
    const alerts = await prisma.queueAlert.findMany({
        where: { enabled: true },
        include: { device: { select: { id: true, name: true, ip: true, location: true, brand: true } } },
    });
    if (alerts.length === 0) return [];

    const dispatchSettings = await prisma.setting.findMany({
        where: { key: { in: ["DISPATCH_TELEGRAM_ENABLED", "DISPATCH_EMAIL_ENABLED", "DISPATCH_WEBHOOK_ENABLED"] } },
    });
    const legacyChannels = await prisma.notificationChannel.count({ where: { enabled: true } }).catch(() => 0);
    const dispatchOn = legacyChannels > 0 || dispatchSettings.some(s => s.value === "true");

    const all: any[] = [];
    for (const alert of alerts) {
        const where: any = { peopleCount: { gte: alert.threshold } };
        if (alert.deviceId) where.deviceId = alert.deviceId;
        if (alert.channelName) where.channelName = alert.channelName;

        const events = await prisma.queueEvent.findMany({
            where, orderBy: { timestamp: "asc" }, take: 3000,
            include: { device: { select: { id: true, name: true, ip: true, location: true, brand: true } } },
        });

        // Collapse consecutive over-threshold readings into ONE notification per "episode"
        // (separated by more than the cooldown), keeping the peak + its snapshot.
        const cdSec = (alert as any).cooldownSec ?? (alert.cooldownMin || 1) * 60;
        const cdMs = Math.max(cdSec, 1) * 1000;
        let cur: any = null;
        const flush = () => { if (cur) { delete cur._lastT; cur.dispatch = dispatchOn ? "SENT" : "NONE"; all.push(cur); } };
        for (const e of events) {
            const t = new Date(e.timestamp).getTime();
            if (!cur || t - cur._lastT > cdMs) {
                flush();
                cur = {
                    id: e.id, alertId: alert.id, alertName: alert.name, threshold: alert.threshold,
                    cooldownMin: alert.cooldownMin, channelName: e.channelName, peopleCount: e.peopleCount,
                    timestamp: e.timestamp, snapshotPath: e.snapshotPath, device: e.device, _lastT: t,
                };
            } else {
                if (e.peopleCount > cur.peopleCount) {
                    cur.peopleCount = e.peopleCount; cur.id = e.id; cur.timestamp = e.timestamp;
                    if (e.snapshotPath) cur.snapshotPath = e.snapshotPath;
                }
                cur._lastT = t;
            }
        }
        flush();
    }

    const seen = new Set<string>();
    return all
        .filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, options?.take ?? 100);
}

// --- Camera outages (connectivity cuts) ---
export async function getCameraOutages(options?: {
    deviceId?: string;
    from?: Date;
    to?: Date;
    take?: number;
    includeOpen?: boolean;
}) {
    const where: any = {};
    if (options?.deviceId) where.deviceId = options.deviceId;
    if (options?.from || options?.to) {
        where.startedAt = {};
        if (options.from) where.startedAt.gte = options.from;
        if (options.to) where.startedAt.lte = options.to;
    }
    const outages = await prisma.cameraOutage.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: options?.take ?? 200,
    });
    return outages.map((o) => ({
        id: o.id,
        deviceId: o.deviceId,
        startedAt: o.startedAt,
        endedAt: o.endedAt,
        durationSec: o.durationSec ?? (o.endedAt
            ? Math.round((new Date(o.endedAt).getTime() - new Date(o.startedAt).getTime()) / 1000)
            : Math.round((Date.now() - new Date(o.startedAt).getTime()) / 1000)),
        lastValue: o.lastValue ?? null,
        ongoing: !o.endedAt,
    }));
}

// --- Flow (entries/exits per hour) ---
export async function getQueueFlowHourly(deviceId?: string, date?: Date) {
    const day = date ? new Date(date) : new Date();
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(day); end.setHours(23, 59, 59, 999);
    const where: any = { timestamp: { gte: start, lte: end }, channelName: { in: ["Entrada", "Salida"] } };
    if (deviceId) where.deviceId = deviceId;
    const events = await prisma.queueEvent.findMany({
        where, select: { channelName: true, timestamp: true },
    });
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, entradas: 0, salidas: 0 }));
    for (const e of events) {
        const h = new Date(e.timestamp).getHours();
        if (e.channelName === "Entrada") hours[h].entradas++;
        else if (e.channelName === "Salida") hours[h].salidas++;
    }
    const totalIn = hours.reduce((s, x) => s + x.entradas, 0);
    const totalOut = hours.reduce((s, x) => s + x.salidas, 0);
    return { hours, totalIn, totalOut, net: totalIn - totalOut };
}

// --- Estimated wait time (Little's law-ish: occupancy / service rate) ---
export async function getQueueWaitEstimate(deviceId?: string) {
    const aforoWhere: any = { channelName: "Aforo" };
    if (deviceId) aforoWhere.deviceId = deviceId;
    const latest = await prisma.queueEvent.findFirst({ where: aforoWhere, orderBy: { timestamp: "desc" } });
    const aforo = latest?.peopleCount ?? 0;

    const windowMin = 15;
    const since = new Date(Date.now() - windowMin * 60 * 1000);
    const exitWhere: any = { channelName: "Salida", timestamp: { gte: since } };
    if (deviceId) exitWhere.deviceId = deviceId;
    const exits = await prisma.queueEvent.count({ where: exitWhere });

    const exitRatePerMin = exits / windowMin;               // personas/min que salen
    const servicePerPersonMin = exitRatePerMin > 0 ? 1 / exitRatePerMin : null;
    const waitMin = servicePerPersonMin != null ? Math.round(aforo * servicePerPersonMin) : null;

    return {
        aforo,
        exits15: exits,
        exitRatePerMin: Math.round(exitRatePerMin * 100) / 100,
        servicePerPersonMin: servicePerPersonMin != null ? Math.round(servicePerPersonMin * 10) / 10 : null,
        waitMin,
    };
}

// --- Calibration helper: raw vs stabilized aforo + suggested debounce ---
export async function getQueueRawVsStable(deviceId?: string, minutes: number = 10) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const where: any = { channelName: "Aforo", timestamp: { gte: since } };
    if (deviceId) where.deviceId = deviceId;
    const rows = await prisma.queueEvent.findMany({
        where, orderBy: { timestamp: "asc" }, select: { peopleCount: true, timestamp: true },
    });
    const raw = rows.map(r => ({ t: new Date(r.timestamp).getTime(), v: r.peopleCount }));

    // Stabilized: adopt a new value only if it persists >= HOLD ms
    const HOLD = 2000;
    const stable: { t: number; v: number }[] = [];
    let current = raw.length ? raw[0].v : 0;
    let candidate = current, candidateSince = raw.length ? raw[0].t : 0;
    for (const p of raw) {
        if (p.v === current) { candidate = current; }
        else {
            if (p.v !== candidate) { candidate = p.v; candidateSince = p.t; }
            else if (p.t - candidateSince >= HOLD) { current = candidate; }
        }
        stable.push({ t: p.t, v: current });
    }

    const rawChanges = raw.filter((p, i) => i > 0 && p.v !== raw[i - 1].v).length;
    const stableChanges = stable.filter((p, i) => i > 0 && p.v !== stable[i - 1].v).length;
    const changesPerMin = minutes > 0 ? Math.round((rawChanges / minutes) * 10) / 10 : 0;
    const vals = raw.map(p => p.v);
    const amplitude = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
    let suggestedReboteSec = 1;
    if (changesPerMin > 30) suggestedReboteSec = 3;
    else if (changesPerMin > 15) suggestedReboteSec = 2.5;
    else if (changesPerMin > 8) suggestedReboteSec = 2;
    else if (changesPerMin > 4) suggestedReboteSec = 1.5;

    return { raw, stable, rawChanges, stableChanges, changesPerMin, amplitude, suggestedReboteSec, samples: raw.length, minutes };
}

// ─────────────────────────────────────────────────────────────────────────
// Notificaciones: reglas de notificación (criterios/filtros)
// ─────────────────────────────────────────────────────────────────────────
export async function getNotificationRules() {
    return prisma.notificationRule.findMany({ orderBy: [{ enabled: "desc" }, { createdAt: "desc" }] });
}

type RuleInput = {
    name: string;
    enabled?: boolean;
    deviceId?: string | null;
    channelName?: string | null;
    metric?: string;        // aforo | entrada | salida
    operator?: string;      // >= | > | == | <=
    threshold?: number;
    daysOfWeek?: string;    // "1,2,3,4,5,6,7"
    startTime?: string;     // "08:00"
    endTime?: string;       // "20:00"
    channels?: string;      // "telegram,email"
    minSeverity?: string | null;
    cooldownSec?: number;
    dedupe?: boolean;
};

export async function createNotificationRule(data: RuleInput) {
    return prisma.notificationRule.create({
        data: {
            name: data.name,
            enabled: data.enabled ?? true,
            deviceId: data.deviceId || null,
            channelName: data.channelName || null,
            metric: data.metric || "aforo",
            operator: data.operator || ">=",
            threshold: data.threshold ?? 1,
            daysOfWeek: data.daysOfWeek || "1,2,3,4,5,6,7",
            startTime: data.startTime || "00:00",
            endTime: data.endTime || "23:59",
            channels: data.channels || "telegram",
            minSeverity: data.minSeverity || null,
            cooldownSec: data.cooldownSec ?? 60,
            dedupe: data.dedupe ?? true,
        },
    });
}

export async function updateNotificationRule(id: string, data: Partial<RuleInput>) {
    return prisma.notificationRule.update({
        where: { id },
        data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
            ...(data.deviceId !== undefined ? { deviceId: data.deviceId || null } : {}),
            ...(data.channelName !== undefined ? { channelName: data.channelName || null } : {}),
            ...(data.metric !== undefined ? { metric: data.metric } : {}),
            ...(data.operator !== undefined ? { operator: data.operator } : {}),
            ...(data.threshold !== undefined ? { threshold: data.threshold } : {}),
            ...(data.daysOfWeek !== undefined ? { daysOfWeek: data.daysOfWeek } : {}),
            ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
            ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
            ...(data.channels !== undefined ? { channels: data.channels } : {}),
            ...(data.minSeverity !== undefined ? { minSeverity: data.minSeverity || null } : {}),
            ...(data.cooldownSec !== undefined ? { cooldownSec: data.cooldownSec } : {}),
            ...(data.dedupe !== undefined ? { dedupe: data.dedupe } : {}),
        },
    });
}

export async function deleteNotificationRule(id: string) {
    await prisma.notificationRule.delete({ where: { id } });
    return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Despachos: lectura de la cola/outbox (DispatchJob)
// ─────────────────────────────────────────────────────────────────────────
export async function getDispatchJobs(opts?: { take?: number; status?: string }) {
    const where: any = {};
    if (opts?.status) where.status = opts.status;
    return prisma.dispatchJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: opts?.take ?? 100,
    });
}

export async function getDispatchStats() {
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const [pending, sent, failed] = await Promise.all([
        prisma.dispatchJob.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
        prisma.dispatchJob.count({ where: { status: "SENT", sentAt: { gte: since } } }),
        prisma.dispatchJob.count({ where: { status: "FAILED" } }),
    ]);
    return { pending, sent, failed };
}

// Re-encolar un despacho (p.ej. uno fallido) creando un nuevo DispatchJob.
export async function retryDispatchJob(id: string) {
    const dj = await prisma.dispatchJob.findUnique({ where: { id } });
    if (!dj) return { ok: false };
    const { enqueueDispatch } = await import("@/lib/dispatch-queue");
    await enqueueDispatch({
        type: dj.type as "ALERT" | "REPORT",
        channel: dj.channel,
        payload: dj.payload,
        ruleId: dj.ruleId,
        deviceId: dj.deviceId,
        maxAttempts: dj.maxAttempts,
    });
    return { ok: true };
}

// Encolar un reporte para despacho manual (botón "Despachar").
export async function enqueueReportDispatch(input: { period: "daily" | "weekly"; deviceId?: string | null; channel?: string }) {
    const { enqueueDispatch } = await import("@/lib/dispatch-queue");
    const job = await enqueueDispatch({
        type: "REPORT",
        channel: input.channel || "telegram",
        payload: { period: input.period, deviceId: input.deviceId || null },
        deviceId: input.deviceId || null,
        maxAttempts: 3,
    });
    return { ok: true, id: job.id };
}

// ─────────────────────────────────────────────────────────────────────────
// Reportes programados (ReportSchedule)
// ─────────────────────────────────────────────────────────────────────────
export async function getReportSchedules() {
    return prisma.reportSchedule.findMany({ orderBy: [{ enabled: "desc" }, { createdAt: "desc" }] });
}
type SchedInput = {
    name: string; enabled?: boolean; frequency?: string; time?: string;
    dayOfWeek?: number; period?: string; deviceId?: string | null; channel?: string;
};
export async function createReportSchedule(data: SchedInput) {
    const freq = data.frequency || "daily";
    return prisma.reportSchedule.create({
        data: {
            name: data.name, enabled: data.enabled ?? true,
            frequency: freq, time: data.time || "22:00",
            dayOfWeek: data.dayOfWeek ?? 7, period: data.period || freq,
            deviceId: data.deviceId || null, channel: data.channel || "telegram",
        },
    });
}
export async function updateReportSchedule(id: string, data: Partial<SchedInput>) {
    const patch: any = {};
    for (const k of ["name", "enabled", "frequency", "time", "dayOfWeek", "channel"] as const)
        if ((data as any)[k] !== undefined) patch[k] = (data as any)[k];
    if (data.deviceId !== undefined) patch.deviceId = data.deviceId || null;
    if (data.frequency !== undefined) patch.period = data.frequency; // window follows cadence
    return prisma.reportSchedule.update({ where: { id }, data: patch });
}
export async function deleteReportSchedule(id: string) {
    await prisma.reportSchedule.delete({ where: { id } });
    return { ok: true };
}

// ── Series con rango (24h horas / 7d-30d por día) para flujo-filas ──────────
function _rangeWindow(range: string) {
    const now = new Date();
    if (range === "7d") { const s = new Date(now); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0); return { start: s, end: now, days: 7 }; }
    if (range === "30d") { const s = new Date(now); s.setDate(s.getDate() - 29); s.setHours(0, 0, 0, 0); return { start: s, end: now, days: 30 }; }
    const s = new Date(now); s.setHours(0, 0, 0, 0); return { start: s, end: now, days: 0 };
}
function _dLabel(d: Date) { return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; }

export async function getQueueAforoSeries(deviceId?: string, range: string = "24h") {
    if (range === "24h") {
        const hourly = await getQueueHourlyBreakdown(deviceId);
        return { buckets: hourly.map(h => ({ label: String(h.hour).padStart(2, "0") + "h", avg: h.avg, max: h.max, count: h.count })), unit: "hour" };
    }
    const { start, end, days } = _rangeWindow(range);
    const where: any = { timestamp: { gte: start, lte: end } };
    if (deviceId) where.deviceId = deviceId;
    const events = await prisma.queueEvent.findMany({ where, select: { timestamp: true, peopleCount: true } });
    const buckets: any[] = [];
    for (let d = 0; d < days; d++) {
        const day = new Date(start); day.setDate(start.getDate() + d);
        const next = new Date(day); next.setDate(day.getDate() + 1);
        const evs = events.filter(e => { const t = new Date(e.timestamp); return t >= day && t < next; });
        const counts = evs.map(e => e.peopleCount);
        buckets.push({ label: _dLabel(day), avg: counts.length ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10 : 0, max: counts.length ? Math.max(...counts) : 0, count: evs.length });
    }
    return { buckets, unit: "day" };
}

export async function getQueueFlowSeries(deviceId?: string, range: string = "24h") {
    if (range === "24h") {
        const f = await getQueueFlowHourly(deviceId);
        return { buckets: f.hours.map(h => ({ label: String(h.hour).padStart(2, "0") + "h", entradas: h.entradas, salidas: h.salidas })), totalIn: f.totalIn, totalOut: f.totalOut, net: f.net, unit: "hour" };
    }
    const { start, end, days } = _rangeWindow(range);
    const where: any = { timestamp: { gte: start, lte: end }, channelName: { in: ["Entrada", "Salida"] } };
    if (deviceId) where.deviceId = deviceId;
    const events = await prisma.queueEvent.findMany({ where, select: { channelName: true, timestamp: true } });
    const buckets: any[] = [];
    for (let d = 0; d < days; d++) {
        const day = new Date(start); day.setDate(start.getDate() + d);
        const next = new Date(day); next.setDate(day.getDate() + 1);
        let entradas = 0, salidas = 0;
        for (const e of events) { const t = new Date(e.timestamp); if (t >= day && t < next) { if (e.channelName === "Entrada") entradas++; else salidas++; } }
        buckets.push({ label: _dLabel(day), entradas, salidas });
    }
    const totalIn = buckets.reduce((s, b) => s + b.entradas, 0);
    const totalOut = buckets.reduce((s, b) => s + b.salidas, 0);
    return { buckets, totalIn, totalOut, net: totalIn - totalOut, unit: "day" };
}

// --- Dispatch message templates (stored as JSON in Setting DISPATCH_TEMPLATES) ---
export async function getDispatchTemplates() {
    const s = await prisma.setting.findUnique({ where: { key: "DISPATCH_TEMPLATES" } });
    if (!s?.value) return [];
    try { return JSON.parse(s.value); } catch { return []; }
}

export async function saveDispatchTemplates(tpls: { id: string; name: string; channel: string; body: string }[]) {
    const value = JSON.stringify(Array.isArray(tpls) ? tpls : []);
    await prisma.setting.upsert({
        where: { key: "DISPATCH_TEMPLATES" },
        update: { value },
        create: { key: "DISPATCH_TEMPLATES", value },
    });
    return { success: true };
}

// --- Dispatch volume series (last 24h, hourly) for the queue chart ---
export async function getDispatchSeries() {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 3600 * 1000);
    const jobs = await prisma.dispatchJob.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true, status: true },
    });
    const buckets = Array.from({ length: 24 }, (_, i) => ({ i, label: "", count: 0, sent: 0, failed: 0 }));
    for (const j of jobs) {
        const idx = Math.min(23, Math.max(0, Math.floor((j.createdAt.getTime() - start.getTime()) / 3600000)));
        buckets[idx].count++;
        if (j.status === "SENT") buckets[idx].sent++;
        else if (j.status === "FAILED") buckets[idx].failed++;
    }
    buckets.forEach((b, i) => { b.label = String(new Date(start.getTime() + i * 3600000).getHours()).padStart(2, "0") + "h"; });
    return buckets;
}

// --- Notification recipients (DISPATCH_RECIPIENTS JSON in Setting) ---
export async function getDispatchRecipients() {
    const s = await prisma.setting.findUnique({ where: { key: "DISPATCH_RECIPIENTS" } });
    if (!s?.value) return [];
    try { return JSON.parse(s.value); } catch { return []; }
}

export async function saveDispatchRecipients(list: { id: string; name: string; channel: string; address: string; enabled: boolean }[]) {
    const value = JSON.stringify(Array.isArray(list) ? list : []);
    await prisma.setting.upsert({
        where: { key: "DISPATCH_RECIPIENTS" },
        update: { value },
        create: { key: "DISPATCH_RECIPIENTS", value },
    });
    return { success: true };
}

// --- Dispatch history (recent DispatchJobs, enriched with recipient) ---
export async function getDispatchHistory(options?: { take?: number }) {
    const jobs = await prisma.dispatchJob.findMany({ orderBy: { createdAt: "desc" }, take: options?.take ?? 60 });
    return jobs.map((j) => {
        const p: any = (j as any).payload || {};
        return {
            id: j.id, type: j.type, channel: j.channel, status: j.status,
            attempts: j.attempts, maxAttempts: j.maxAttempts, lastError: j.lastError,
            recipient: p.recipientName || p.chatId || p.to || p.email || null,
            recipientChannel: p.recipientChannel || j.channel,
            ruleName: p.ruleName || (j.type === "REPORT" ? "Reporte" : "Alerta"),
            deviceName: p.deviceName || null, count: p.count ?? null, threshold: p.threshold ?? null,
            channelName: p.channelName || null, snapshotPath: p.snapshotPath || null,
            createdAt: j.createdAt, sentAt: j.sentAt,
        };
    });
}
