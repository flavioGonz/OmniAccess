"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    Zap, ChevronDown, Bell, BellOff, User, LayoutGrid, Settings, Sparkles,
    Camera, Video, Users, RefreshCw, Maximize2, X, Check, Rows3, Grid2x2, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getQueueDevices, getLatestQueueCounts, getQueueAlerts } from "@/app/actions/queue";
import io from "socket.io-client";

const OCC = ["Aforo", "Occupancy", "Ocupación", "Ocupacion"];
type Dev = { id: string; name: string; ip: string };

function getStreamName(ip: string) { return `bosch_${ip.replace(/\./g, "_")}`; }
function statusColor(aforo: number, limit: number) { const r = limit > 0 ? aforo / limit : 0; return r >= 1 ? "#ef4444" : r >= 0.7 ? "#f59e0b" : "#10b981"; }
function urlB64ToUint8(base64: string) { const p = "=".repeat((4 - (base64.length % 4)) % 4); const b = (base64 + p).replace(/-/g, "+").replace(/_/g, "/"); const raw = atob(b); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); }

function LiveVideo({ streamName, deviceId, className }: { streamName: string; deviceId: string; className?: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [failed, setFailed] = useState(false);
    const retry = useRef(0);
    useEffect(() => {
        if (!streamName) { setFailed(true); return; }
        setFailed(false); retry.current = 0;
        const video = videoRef.current; if (!video) return;
        let destroyed = false; let timer: any = null;
        const src = `/go2rtc/api/stream.mp4?src=${encodeURIComponent(streamName)}`;
        const load = () => { if (destroyed || !video) return; video.src = src; video.play().catch(() => {}); };
        const onError = () => { if (destroyed) return; retry.current++; if (retry.current > 6) { setFailed(true); return; } timer = setTimeout(load, Math.min(1000 * retry.current, 5000)); };
        const onProgress = () => { if (!video || video.buffered.length === 0) return; const end = video.buffered.end(video.buffered.length - 1); if (end - video.currentTime > 3) video.currentTime = end - 0.4; };
        video.addEventListener("error", onError); video.addEventListener("progress", onProgress); load();
        return () => { destroyed = true; if (timer) clearTimeout(timer); video.removeEventListener("error", onError); video.removeEventListener("progress", onProgress); video.pause(); video.removeAttribute("src"); video.load(); };
    }, [streamName]);
    if (failed) return <SnapshotImg deviceId={deviceId} className={className} />;
    return <video ref={videoRef} className={cn("object-cover bg-black", className)} autoPlay muted playsInline />;
}
function SnapshotImg({ deviceId, className }: { deviceId: string; className?: string }) {
    const [src, setSrc] = useState(`/api/snapshot/${deviceId}?t=${Date.now()}`);
    const [err, setErr] = useState(false);
    useEffect(() => { const iv = setInterval(() => { setSrc(`/api/snapshot/${deviceId}?t=${Date.now()}`); setErr(false); }, 5000); return () => clearInterval(iv); }, [deviceId]);
    if (err) return <div className={cn("flex flex-col items-center justify-center gap-1.5 bg-zinc-950", className)}><Camera className="w-8 h-8 text-white/30" /><span className="text-[10px] text-white/40">Sin señal · reintentando…</span></div>;
    return <img src={src} alt="" className={cn("object-cover", className)} onError={() => setErr(true)} draggable={false} />;
}

function EventsFeed({ events, onlyAlerts }: { events: any[]; onlyAlerts: boolean }) {
    const list = onlyAlerts ? events.filter((e) => e.type === "alert") : events;
    if (list.length === 0) return (
        <div className="flex-1 flex flex-col items-center justify-center text-white/40 gap-2 pb-24">
            <Bell size={28} /><span className="text-sm">{onlyAlerts ? "Sin alertas" : "Sin eventos"} todavía</span>
            <span className="text-[11px] text-white/30">Aparecen en vivo cuando ocurren</span>
        </div>
    );
    return (
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden pb-24 px-3 pt-2 space-y-1.5">
            {list.map((e) => {
                const t = new Date(e.time);
                const isAlert = e.type === "alert";
                const isIn = e.flow === "in";
                const col = isAlert ? "#ef4444" : isIn ? "#10b981" : "#f59e0b";
                const img = e.snapshotPath ? (String(e.snapshotPath).startsWith("/") ? e.snapshotPath : `/api/files/lpr-prod/${e.snapshotPath}`) : null;
                return (
                    <div key={e.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] border border-white/10 p-2.5">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-black shrink-0 flex items-center justify-center" style={{ border: `1px solid ${col}55` }}>
                            {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : (isAlert ? <Bell size={18} style={{ color: col }} /> : isIn ? <Check size={18} style={{ color: col }} /> : <X size={18} style={{ color: col }} />)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white truncate">{isAlert ? (e.alertName || "Alerta de aforo") : isIn ? "Entrada" : "Salida"}</span>
                                {isAlert && e.health && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold uppercase">salud</span>}
                            </div>
                            <div className="text-[11px] text-white/50 flex items-center gap-2 mt-0.5">
                                <span className="font-mono">{t.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                                {e.deviceName && <span className="truncate">· {e.deviceName}</span>}
                            </div>
                        </div>
                        {!isAlert ? (
                            <span className="text-xl font-black tabular-nums" style={{ color: col }}>{isIn ? "+1" : "−1"}</span>
                        ) : (
                            <div className="text-right shrink-0">
                                <div className="text-2xl font-black tabular-nums leading-none" style={{ color: col }}>{e.count ?? "—"}</div>
                                {e.threshold != null && <div className="text-[9px] text-white/40">umbral {e.threshold}</div>}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function FilasPWA() {
    const [devices, setDevices] = useState<Dev[]>([]);
    const [aforo, setAforo] = useState<Record<string, number>>({});
    const [limit, setLimit] = useState(8);
    const [connected, setConnected] = useState(false);
    const [now, setNow] = useState(new Date());
    const [pushState, setPushState] = useState<"idle" | "on" | "denied" | "loading">("idle");
    const [flashId, setFlashId] = useState<string | null>(null);
    const [view, setView] = useState<"list" | "grid">("list");
    const [focusId, setFocusId] = useState<string | null>(null); // null = todas
    const [menu, setMenu] = useState<null | "device" | "profile">(null);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<"vivo" | "eventos" | "alertas">("vivo");
    const [events, setEvents] = useState<any[]>([]);
    const feedRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const load = useCallback(async () => {
        try {
            const [devs, counts, alerts] = await Promise.all([getQueueDevices(), getLatestQueueCounts(), getQueueAlerts()]);
            setDevices((devs as any[]).map((d) => ({ id: d.id, name: d.name, ip: d.ip })));
            const map: Record<string, number> = {};
            for (const c of counts as any[]) { const ch = (c.channels || []).find((x: any) => OCC.includes(x.channelName)); map[c.device.id] = ch ? ch.peopleCount : 0; }
            setAforo(map);
            const ths = (alerts as any[]).map((a) => a.threshold).filter((n: number) => n > 0);
            if (ths.length) setLimit(Math.max(...ths));
        } catch (e) { console.error(e); }
    }, []);
    useEffect(() => { load(); const t = setInterval(() => setNow(new Date()), 1000); const r = setInterval(load, 15000); return () => { clearInterval(t); clearInterval(r); }; }, [load]);

    useEffect(() => {
        const socket = io(window.location.origin, { path: "/io/socket.io", transports: ["polling"] });
        socket.on("connect", () => setConnected(true));
        socket.on("disconnect", () => setConnected(false));
        socket.on("queue_update", (data: any) => {
            if (OCC.includes(data.channelName) && data.deviceId) setAforo((p) => ({ ...p, [data.deviceId]: data.peopleCount }));
            const ch = String(data.channelName || "");
            if (/entrad|entering|salid|leaving/i.test(ch)) {
                const flow = /entrad|entering/i.test(ch) ? "in" : "out";
                setEvents((ev) => [{ id: Math.random().toString(36).slice(2), type: "flow", flow, deviceName: data.deviceName, channelName: ch, count: data.peopleCount, time: Date.now(), snapshotPath: data.snapshotPath || null }, ...ev].slice(0, 150));
            }
        });
        socket.on("queue_alert", (data: any) => {
            const id = devices.find((d) => d.name === data.deviceName)?.id || devices[0]?.id || null; setFlashId(id); setTimeout(() => setFlashId(null), 1800); if ("vibrate" in navigator) navigator.vibrate?.([120, 60, 120]);
            setEvents((ev) => [{ id: Math.random().toString(36).slice(2), type: "alert", health: data.health || null, deviceName: data.deviceName, channelName: data.channelName, count: data.peopleCount, threshold: data.threshold, time: Date.now(), snapshotPath: data.snapshotPath || null, alertName: data.alertName }, ...ev].slice(0, 150));
        });
        return () => { socket.disconnect(); };
    }, [devices]);

    useEffect(() => {
        if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
        if ("Notification" in window) { if (Notification.permission === "granted") setPushState("on"); else if (Notification.permission === "denied") setPushState("denied"); }
    }, []);

    const enablePush = async () => {
        setMenu(null);
        if (pushState === "on") { return; }
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) { alert("Tu navegador no soporta push."); return; }
        setPushState("loading");
        try {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") { setPushState("denied"); return; }
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "") });
            await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
            setPushState("on");
        } catch (e) { console.error(e); setPushState("idle"); }
    };
    const goFs = () => { setMenu(null); const el: any = document.documentElement; if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.().catch(() => {}); };
    const doRefresh = async () => { setMenu(null); setRefreshing(true); await load(); setTimeout(() => setRefreshing(false), 600); };
    const focusDevice = (id: string | null) => { setFocusId(id); setMenu(null); if (id && feedRefs.current[id]) feedRefs.current[id]!.scrollIntoView({ behavior: "smooth", block: "start" }); };

    const totalAforo = Object.values(aforo).reduce((a, b) => a + b, 0);
    const tStr = now.toLocaleString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(",", "");
    const shown = focusId ? devices.filter((d) => d.id === focusId) : devices;
    const siteName = (focusId ? devices.find((d) => d.id === focusId)?.name : null) || devices[0]?.name || "Control de Filas";

    return (
        <div className="fixed inset-0 flex flex-col bg-[#0a0a0b] overflow-hidden">
            {/* Top bar */}
            <header className="px-4 pt-[max(0.9rem,env(safe-area-inset-top))] pb-2 shrink-0 relative z-30">
                <div className="flex items-center justify-between">
                    <button onClick={() => setMenu(menu === "device" ? null : "device")} className="flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 active:bg-white/10">
                        <span className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center"><Zap size={14} className="text-emerald-400 fill-emerald-400" /></span>
                        <span className="text-[15px] font-bold tracking-tight max-w-[40vw] truncate">{siteName}</span>
                        <ChevronDown size={16} className={cn("text-white/50 transition", menu === "device" && "rotate-180")} />
                    </button>
                    <div className="flex items-center gap-2">
                        <button onClick={enablePush} className={cn("w-10 h-10 rounded-full flex items-center justify-center border border-white/10 transition", pushState === "on" ? "bg-blue-500 text-white" : "bg-white/[0.06] text-white/80")}>
                            {pushState === "loading" ? <RefreshCw size={17} className="animate-spin" /> : pushState === "on" ? <Bell size={17} /> : <BellOff size={17} />}
                        </button>
                        <button onClick={() => setMenu(menu === "profile" ? null : "profile")} className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-white/70 active:bg-white/10"><User size={18} /></button>
                    </div>
                </div>

                {/* Device dropdown */}
                {menu === "device" && (
                    <div className="absolute left-4 top-[calc(100%-0.25rem)] w-64 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden">
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Cámaras</div>
                        <button onClick={() => focusDevice(null)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 text-sm">
                            <span className="flex items-center gap-2"><Grid2x2 size={15} className="text-blue-400" /> Todas</span>
                            {!focusId && <Check size={15} className="text-blue-400" />}
                        </button>
                        {devices.map((d) => (
                            <button key={d.id} onClick={() => focusDevice(d.id)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 text-sm">
                                <span className="flex items-center gap-2 min-w-0"><Camera size={15} className="text-white/60 shrink-0" /><span className="truncate">{d.name}</span></span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs font-black tabular-nums" style={{ color: statusColor(aforo[d.id] ?? 0, limit) }}>{aforo[d.id] ?? 0}</span>
                                    {focusId === d.id && <Check size={15} className="text-blue-400" />}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
                {/* Profile dropdown */}
                {menu === "profile" && (
                    <div className="absolute right-4 top-[calc(100%-0.25rem)] w-56 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden py-1">
                        <button onClick={doRefresh} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm"><RefreshCw size={16} className="text-white/60" /> Actualizar</button>
                        <button onClick={goFs} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm"><Maximize2 size={16} className="text-white/60" /> Pantalla completa</button>
                        <button onClick={enablePush} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm">{pushState === "on" ? <Bell size={16} className="text-blue-400" /> : <BellOff size={16} className="text-white/60" />} Notificaciones {pushState === "on" ? "activas" : "off"}</button>
                        <div className="h-px bg-white/10 my-1" />
                        <div className="px-4 py-2 text-[11px] text-white/40">Aforo total: <b className="text-white/70">{totalAforo}</b> · {connected ? "en vivo" : "sin conexión"}</div>
                    </div>
                )}
            </header>

            {/* click-away */}
            {menu && <div className="absolute inset-0 z-20" onClick={() => setMenu(null)} />}

            {tab === "vivo" && (<>
            {/* Thumbnail strip */}
            <div className="shrink-0 px-4 pb-1">
                <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden pb-1">
                    {devices.map((d) => (
                        <button key={d.id} onClick={() => focusDevice(focusId === d.id ? null : d.id)} className="shrink-0 w-[88px]">
                            <div className={cn("relative w-[88px] h-[60px] rounded-xl overflow-hidden border bg-black transition", focusId === d.id ? "border-blue-500 ring-2 ring-blue-500/40" : "border-white/10")}>
                                <SnapshotImg deviceId={d.id} className="absolute inset-0 w-full h-full" />
                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-black tabular-nums" style={{ color: statusColor(aforo[d.id] ?? 0, limit) }}>{aforo[d.id] ?? 0}</span>
                            </div>
                            <div className="text-center text-[11px] text-white/45 font-mono mt-1">{now.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick actions */}
            <div className="shrink-0 flex items-center gap-2 px-4 pb-2">
                <button onClick={() => setView("list")} className={cn("w-12 h-11 rounded-2xl border flex items-center justify-center transition", view === "list" ? "bg-blue-500/90 text-white border-blue-500" : "bg-white/[0.06] text-blue-400 border-white/10")}><Rows3 size={18} /></button>
                <button onClick={() => setView("grid")} className={cn("w-12 h-11 rounded-2xl border flex items-center justify-center transition", view === "grid" ? "bg-blue-500/90 text-white border-blue-500" : "bg-white/[0.06] text-blue-400 border-white/10")}><LayoutGrid size={18} /></button>
                <div className="flex-1 h-11 rounded-2xl border flex items-center justify-center gap-2 font-bold text-[15px]" style={{ borderColor: statusColor(totalAforo, limit) + "55", background: statusColor(totalAforo, limit) + "14", color: statusColor(totalAforo, limit) }}>
                    <Users size={17} /> Aforo {totalAforo}{limit > 0 ? ` / ${limit}` : ""}
                </div>
            </div>

            </>)}
            {/* Feeds (vivo) */}
            {tab === "vivo" && (
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden pb-24">
                {devices.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/40 gap-2"><Camera size={28} /><span className="text-sm">Sin cámaras de fila</span></div>
                ) : (
                    <div className={cn(view === "grid" ? "grid grid-cols-2 gap-px bg-white/10" : "")}>
                        {shown.map((d) => {
                            const a = aforo[d.id] ?? 0; const col = statusColor(a, limit);
                            return (
                                <div key={d.id} ref={(el) => { feedRefs.current[d.id] = el; }} className="relative w-full aspect-video border-b border-white/10 bg-black">
                                    <LiveVideo streamName={getStreamName(d.ip)} deviceId={d.id} className="absolute inset-0 w-full h-full" />
                                    <div className="absolute top-2 left-3 text-[11px] font-mono text-white/90" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{tStr}</div>
                                    <div className="absolute top-2 right-3 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/55 text-[9px] font-bold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />Live</div>
                                    <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-10 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex items-end justify-between">
                                        <span className={cn("font-black text-white truncate max-w-[55%]", view === "grid" ? "text-[12px]" : "text-[17px]")} style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>{d.name}</span>
                                        <span className="flex items-baseline gap-1.5">
                                            <span className="text-[10px] uppercase tracking-wide text-white/60 font-bold mb-0.5">Aforo</span>
                                            <span className={cn("font-black tabular-nums leading-none", view === "grid" ? "text-xl" : "text-3xl")} style={{ color: col, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>{a}</span>
                                        </span>
                                    </div>
                                    {flashId === d.id && <div className="absolute inset-0 bg-red-500/25 animate-pulse pointer-events-none" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            )}
            {tab !== "vivo" && (
                <EventsFeed events={events} onlyAlerts={tab === "alertas"} />
            )}

            {/* Bottom nav */}
            <nav className="absolute bottom-0 inset-x-0 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 px-6 flex justify-center pointer-events-none z-30">
                <div className="pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-full bg-zinc-900/85 backdrop-blur-xl border border-white/10 shadow-2xl">
                    <button onClick={() => setTab("vivo")} className={cn("w-12 h-11 rounded-full flex items-center justify-center transition", tab === "vivo" ? "bg-blue-500/90 text-white" : "text-white/60")}><Video size={19} /></button>
                    <button onClick={() => setTab("eventos")} className={cn("relative w-12 h-11 rounded-full flex items-center justify-center transition", tab === "eventos" ? "bg-blue-500/90 text-white" : "text-white/60")}><Rows3 size={19} />{tab !== "eventos" && events.length > 0 && <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-blue-400" />}</button>
                    <button onClick={() => setTab("alertas")} className={cn("relative w-12 h-11 rounded-full flex items-center justify-center transition", tab === "alertas" ? "bg-blue-500/90 text-white" : "text-white/60")}><Zap size={19} />{tab !== "alertas" && events.some((e) => e.type === "alert") && <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-red-500" />}</button>
                    <button onClick={enablePush} className="w-12 h-11 rounded-full text-white/60 flex items-center justify-center">{pushState === "on" ? <Bell size={19} className="text-blue-400" /> : <Sparkles size={19} />}</button>
                    <button onClick={() => setMenu(menu === "profile" ? null : "profile")} className="w-12 h-11 rounded-full text-white/60 flex items-center justify-center"><Settings size={19} /></button>
                </div>
            </nav>
        </div>
    );
}
