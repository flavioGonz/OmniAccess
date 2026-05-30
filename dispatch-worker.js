// Standalone BullMQ worker — consumes the "dispatch" queue and sends
// notifications/reports with retries. Run via PM2 (process: dispatch-worker).
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const https = require("https");
const http = require("http");
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const { execFile } = require("child_process");

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

async function getSetting(key, fallback) {
    try { const s = await prisma.setting.findUnique({ where: { key } }); return (s && s.value) || fallback; }
    catch { return fallback; }
}

function telegramSend(token, chatId, text) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
        const req = https.request(`https://api.telegram.org/bot${token}/sendMessage`,
            { method: "POST", headers: { "Content-Type": "application/json" }, timeout: 12000 },
            (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ ok: res.statusCode === 200, body: d })); });
        req.on("error", (e) => resolve({ ok: false, body: e.message }));
        req.on("timeout", () => { req.destroy(); resolve({ ok: false, body: "timeout" }); });
        req.write(body); req.end();
    });
}

function telegramSendPhoto(token, chatId, photoUrl, caption) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: "HTML" });
        const req = https.request(`https://api.telegram.org/bot${token}/sendPhoto`,
            { method: "POST", headers: { "Content-Type": "application/json" }, timeout: 20000 },
            (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ ok: res.statusCode === 200, body: d })); });
        req.on("error", (e) => resolve({ ok: false, body: e.message }));
        req.on("timeout", () => { req.destroy(); resolve({ ok: false, body: "timeout" }); });
        req.write(body); req.end();
    });
}

// Resolve a public image URL: stored snapshot, else the live camera frame.
function imageUrlFor(base, snapshotPath, deviceId) {
    const b = (base || "https://omniaccess.infratec.com.uy").replace(/\/+$/, "");
    if (snapshotPath) {
        if (/^https?:\/\//i.test(snapshotPath)) return snapshotPath;
        if (snapshotPath.startsWith("/")) return b + snapshotPath;
        return b + "/api/files/lpr-prod/" + snapshotPath;
    }
    if (deviceId) return b + "/api/snapshot/" + deviceId;
    return null;
}

// Local path (served by the web process) for the snapshot image.
function imagePathFor(snapshotPath, deviceId) {
    if (snapshotPath) {
        if (/^https?:\/\//i.test(snapshotPath)) return null; // external, can't fetch locally
        if (snapshotPath.startsWith("/")) return snapshotPath;
        return "/api/files/lpr-prod/" + snapshotPath;
    }
    if (deviceId) return "/api/snapshot/" + deviceId;
    return null;
}

// Fetch an image from the local web process and return base64 (no data-uri prefix).
function fetchLocalBase64(path) {
    return new Promise((resolve) => {
        const req = http.request({ hostname: "127.0.0.1", port: 10001, path, method: "GET", timeout: 12000 },
            (res) => {
                if (res.statusCode !== 200) { res.resume(); return resolve(null); }
                const chunks = [];
                res.on("data", (c) => chunks.push(c));
                res.on("end", () => { const buf = Buffer.concat(chunks); resolve(buf.length > 100 ? buf.toString("base64") : null); });
            });
        req.on("error", () => resolve(null));
        req.on("timeout", () => { req.destroy(); resolve(null); });
        req.end();
    });
}

// Build a short MP4 clip from the camera (via go2rtc) for animated alerts.
async function buildClip(deviceId) {
    try {
        const dev = await prisma.device.findUnique({ where: { id: deviceId }, select: { ip: true } });
        if (!dev || !dev.ip) return null;
        const streamName = "bosch_" + String(dev.ip).replace(/\./g, "_");
        const input = `http://127.0.0.1:1984/api/stream.mp4?src=${streamName}`;
        const fname = `${deviceId}_${Date.now()}.mp4`;
        const out = `/opt/OmniAccess/public/clips/${fname}`;
        await new Promise((resolve, reject) => {
            execFile("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-t", "3", "-vf", "scale=480:-2,fps=10", "-an", "-movflags", "+faststart", out],
                { timeout: 18000 }, (err) => err ? reject(err) : resolve());
        });
        let st; try { st = fs.statSync(out); } catch { return null; }
        if (!st || st.size < 1500) { try { fs.unlinkSync(out); } catch {} return null; }
        const base64 = fs.readFileSync(out).toString("base64");
        setTimeout(() => { try { fs.unlinkSync(out); } catch {} }, 120000);
        return { base64, rel: "/clips/" + fname };
    } catch (e) { console.error("[clip] " + ((e && e.message) || e)); return null; }
}

// OpenWA send-video (base64 mp4).
function openwaSendVideo(baseUrl, apiKey, session, chatId, base64, caption) {
    return new Promise((resolve) => {
        let u;
        try { u = new URL(`${baseUrl.replace(/\/+$/, "")}/api/sessions/${encodeURIComponent(session)}/messages/send-video`); }
        catch (e) { return resolve({ ok: false, body: "bad OPENWA_URL: " + e.message }); }
        const lib = u.protocol === "https:" ? https : http;
        const body = JSON.stringify({ chatId, base64, caption, mimetype: "video/mp4", filename: "aforo.mp4" });
        const req = lib.request({ hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80), path: u.pathname, method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "X-API-Key": apiKey || "" }, timeout: 40000 },
            (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, body: d, status: res.statusCode })); });
        req.on("error", (e) => resolve({ ok: false, body: e.message }));
        req.on("timeout", () => { req.destroy(); resolve({ ok: false, body: "timeout" }); });
        req.write(body); req.end();
    });
}

// Telegram sendAnimation (by public URL).
function telegramSendAnimation(token, chatId, animationUrl, caption) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ chat_id: chatId, animation: animationUrl, caption, parse_mode: "HTML" });
        const req = https.request(`https://api.telegram.org/bot${token}/sendAnimation`,
            { method: "POST", headers: { "Content-Type": "application/json" }, timeout: 25000 },
            (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ ok: res.statusCode === 200, body: d })); });
        req.on("error", (e) => resolve({ ok: false, body: e.message }));
        req.on("timeout", () => { req.destroy(); resolve({ ok: false, body: "timeout" }); });
        req.write(body); req.end();
    });
}

// OpenWA send-text. baseUrl like http://192.168.99.22:2785 (http or https).
function openwaSend(baseUrl, apiKey, session, chatId, text) {
    return new Promise((resolve) => {
        let u;
        try { u = new URL(`${baseUrl.replace(/\/+$/, "")}/api/sessions/${encodeURIComponent(session)}/messages/send-text`); }
        catch (e) { return resolve({ ok: false, body: "bad OPENWA_URL: " + e.message }); }
        const lib = u.protocol === "https:" ? https : http;
        const body = JSON.stringify({ chatId, text });
        const req = lib.request({
            hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80),
            path: u.pathname, method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "X-API-Key": apiKey || "" },
            timeout: 15000,
        }, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, body: d, status: res.statusCode })); });
        req.on("error", (e) => resolve({ ok: false, body: e.message }));
        req.on("timeout", () => { req.destroy(); resolve({ ok: false, body: "timeout" }); });
        req.write(body); req.end();
    });
}

// OpenWA send-image (by base64).
function openwaSendImage(baseUrl, apiKey, session, chatId, base64, caption) {
    return new Promise((resolve) => {
        let u;
        try { u = new URL(`${baseUrl.replace(/\/+$/, "")}/api/sessions/${encodeURIComponent(session)}/messages/send-image`); }
        catch (e) { return resolve({ ok: false, body: "bad OPENWA_URL: " + e.message }); }
        const lib = u.protocol === "https:" ? https : http;
        const body = JSON.stringify({ chatId, base64, caption, mimetype: "image/jpeg", filename: "aforo.jpg" });
        const req = lib.request({
            hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80),
            path: u.pathname, method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "X-API-Key": apiKey || "" },
            timeout: 25000,
        }, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, body: d, status: res.statusCode })); });
        req.on("error", (e) => resolve({ ok: false, body: e.message }));
        req.on("timeout", () => { req.destroy(); resolve({ ok: false, body: "timeout" }); });
        req.write(body); req.end();
    });
}

// Build a public URL for the snapshot so OpenWA can fetch it.
function snapshotUrl(base, snapshotPath) {
    if (!snapshotPath) return null;
    const b = (base || "https://omniaccess.infratec.com.uy").replace(/\/+$/, "");
    if (/^https?:\/\//i.test(snapshotPath)) return snapshotPath;
    if (snapshotPath.startsWith("/")) return b + snapshotPath;
    return b + "/api/files/lpr-prod/" + snapshotPath;
}

// Normalize a phone/jid to a WhatsApp chatId (<digits>@c.us)
function toChatId(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.includes("@")) return s; // already a jid (c.us / g.us)
    const digits = s.replace(/[^0-9]/g, "");
    return digits ? `${digits}@c.us` : null;
}

function getInternal(path) {
    return new Promise((resolve) => {
        const req = http.request({ hostname: "127.0.0.1", port: 10001, path, method: "GET", timeout: 60000 },
            (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, body: d })); });
        req.on("error", (e) => resolve({ ok: false, body: e.message }));
        req.on("timeout", () => { req.destroy(); resolve({ ok: false, body: "timeout" }); });
        req.end();
    });
}

async function handle(job) {
    const { dispatchJobId } = job.data || {};
    const dj = await prisma.dispatchJob.findUnique({ where: { id: dispatchJobId } });
    if (!dj) return;
    await prisma.dispatchJob.update({ where: { id: dj.id }, data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } } });
    const p = dj.payload || {};
    try {
        if (dj.type === "ALERT") {
            const text = p.text || (
                `🚨 ${p.ruleName || "Alerta de aforo"}\n` +
                `📍 ${p.deviceName || "Fila"} · ${p.channelName || "Aforo"}\n` +
                `Valor ${p.count} (umbral ${p.threshold})`
            );
            const base = await getSetting("PUBLIC_BASE_URL", "https://omniaccess.infratec.com.uy");
            const animated = (await getSetting("DISPATCH_ANIMATED", "false")) === "true";
            // Build the animated clip once (reused across channels of the same job)
            let clip = null;
            if (animated && dj.deviceId) clip = await buildClip(dj.deviceId);
            if (dj.channel === "telegram") {
                const token = await getSetting("TELEGRAM_BOT_TOKEN", process.env.TELEGRAM_BOT_TOKEN);
                const chat = p.chatId || await getSetting("TELEGRAM_CHAT_ID", process.env.TELEGRAM_CHAT_ID);
                if (!token || !chat) throw new Error("Faltan credenciales de Telegram");
                const htmlText = p.text || (
                    `🚨 <b>${p.ruleName || "Alerta de aforo"}</b>\n` +
                    `📍 ${p.deviceName || "Fila"} · ${p.channelName || "Aforo"}\n` +
                    `Valor <b>${p.count}</b> (umbral ${p.threshold})`
                );
                let r;
                if (clip) r = await telegramSendAnimation(token, chat, base.replace(/\/+$/, "") + clip.rel, htmlText);
                if (!r || !r.ok) {
                    const img = imageUrlFor(base, p.snapshotPath, dj.deviceId);
                    r = img ? await telegramSendPhoto(token, chat, img, htmlText) : await telegramSend(token, chat, htmlText);
                }
                if (!r.ok) throw new Error("Telegram: " + r.body);
            } else if (dj.channel === "whatsapp") {
                const url = await getSetting("OPENWA_URL", await getSetting("WAHA_URL", "http://192.168.99.22:2785"));
                const key = await getSetting("OPENWA_API_KEY", await getSetting("WAHA_API_KEY", ""));
                const session = await getSetting("OPENWA_SESSION", "omniaccess");
                const chatId = toChatId(p.chatId || p.to || await getSetting("OPENWA_DEFAULT_CHAT", ""));
                if (!chatId) throw new Error("Falta destinatario WhatsApp (OPENWA_DEFAULT_CHAT o payload.chatId)");
                let r;
                if (clip) r = await openwaSendVideo(url, key, session, chatId, clip.base64, text);
                if (!r || !r.ok) {
                    const imgPath = imagePathFor(p.snapshotPath, dj.deviceId);
                    const b64 = imgPath ? await fetchLocalBase64(imgPath) : null;
                    r = b64 ? await openwaSendImage(url, key, session, chatId, b64, text) : await openwaSend(url, key, session, chatId, text);
                }
                if (!r.ok) throw new Error("WhatsApp: " + (r.body || r.status));
            } else {
                throw new Error("Canal no soportado: " + dj.channel);
            }
        } else if (dj.type === "REPORT") {
            // Reuse the existing report generation/send endpoint (GET ?period=&deviceId=).
            const period = p.period || "daily";
            const qs = "period=" + encodeURIComponent(period) + (p.deviceId ? "&deviceId=" + encodeURIComponent(p.deviceId) : "");
            const r = await getInternal("/api/queue/report/send?" + qs);
            if (!r.ok) throw new Error("Reporte: " + r.body);
        } else {
            throw new Error("Tipo desconocido: " + dj.type);
        }
        await prisma.dispatchJob.update({ where: { id: dj.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
    } catch (e) {
        const willRetry = (job.attemptsMade + 1) < (dj.maxAttempts || 5);
        await prisma.dispatchJob.update({ where: { id: dj.id }, data: { status: willRetry ? "PENDING" : "FAILED", lastError: String((e && e.message) || e) } });
        throw e; // surface to BullMQ for retry/backoff
    }
}

const worker = new Worker("dispatch", handle, { connection, concurrency: 4 });
worker.on("completed", (j) => console.log(`[dispatch-worker] ✅ completed ${j.id}`));
worker.on("failed", (j, e) => console.error(`[dispatch-worker] ❌ failed ${j && j.id}: ${e && e.message}`));
worker.on("error", (e) => console.error(`[dispatch-worker] error: ${e && e.message}`));
console.log("[dispatch-worker] started, consuming queue 'dispatch'");
