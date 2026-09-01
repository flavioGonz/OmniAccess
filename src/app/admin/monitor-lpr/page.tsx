"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessEvents, getEventsCountToday } from "@/app/actions/history";
import { getDevices, getAvailableStreams } from "@/app/actions/devices";
import {
    Car,
    CheckCircle2,
    XCircle,
    Clock,
    TrendingUp,
    TrendingDown,
    Zap,
    Shield,
    AlertTriangle,
    Filter,
    RefreshCw,
    Camera,
    LogIn,
    LogOut,
    Truck,
    Bus,
    Bike,
    Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EventDetailsDialog } from "@/components/dashboard/EventDetailsDialog";
import Image from "next/image";
import { AccessEvent, Device, Unit } from "@prisma/client";
import { getCarLogo } from "@/lib/car-logos";
import { getVehicleBrandName } from "@/lib/hikvision-codes";
import { getImagePath } from "@/lib/image-path";
import { getSocketUrl } from "@/lib/socket-config";

interface FullAccessEvent extends AccessEvent {
    user: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        dni: string | null;
        apartment: string | null;
        cara: string | null;
        unit: Unit | null;
        parkingSlotId: string | null;
    } | null;
    device: Device | null;
}

function TimeAgo({ timestamp }: { timestamp: string | Date }) {
    const [label, setLabel] = useState("");
    useEffect(() => {
        const update = () => {
            const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
            if (diff < 0) { setLabel("Ahora"); return; }
            if (diff < 60) setLabel(`Hace ${diff}s`);
            else if (diff < 3600) setLabel(`Hace ${Math.floor(diff / 60)}m`);
            else if (diff < 86400) setLabel(`Hace ${Math.floor(diff / 3600)}h`);
            else setLabel(`Hace ${Math.floor(diff / 86400)}d`);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [timestamp]);
    return <span>{label}</span>;
}


function LSnapImg({ deviceId, className }: { deviceId: string; className?: string }) {
    const [src, setSrc] = useState(`/api/snapshot/${deviceId}?t=${Date.now()}`);
    const [err, setErr] = useState(false);
    const ivRef = useRef<any>(null);
    useEffect(() => {
        setErr(false);
        setSrc(`/api/snapshot/${deviceId}?t=${Date.now()}`);
        ivRef.current = setInterval(() => setSrc(`/api/snapshot/${deviceId}?t=${Date.now()}`), 5000);
        return () => { if (ivRef.current) clearInterval(ivRef.current); };
    }, [deviceId]);
    const onErr = () => { setErr(true); if (ivRef.current) { clearInterval(ivRef.current); ivRef.current = null; } };
    if (err) return <div className={cn("flex flex-col items-center justify-center bg-zinc-950 gap-1 text-[9px] text-white/40", className)}><Camera size={18} className="opacity-40" /> Sin señal</div>;
    return <img src={src} alt="" className={cn("object-cover", className)} onError={onErr} onLoad={(e) => e.currentTarget.setAttribute("data-ready", "1")} />;
}

// --- Camera shutter sound (synthesized, no asset) + autoplay unlock ---
let _shutterCtx: any = null;
function playShutter() {
    try {
        _shutterCtx = _shutterCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
        const ctx = _shutterCtx;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const t = ctx.currentTime;
        const click = (start: number, freq: number, dur: number, gain: number) => {
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.type = "square"; o.frequency.value = freq;
            g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(gain, start + 0.002);
            g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
            o.connect(g); g.connect(ctx.destination); o.start(start); o.stop(start + dur);
        };
        const noise = (start: number, dur: number, gain: number) => {
            const n = Math.floor(ctx.sampleRate * dur); const buf = ctx.createBuffer(1, n, ctx.sampleRate);
            const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
            const src = ctx.createBufferSource(); src.buffer = buf; const g = ctx.createGain(); g.gain.value = gain;
            src.connect(g); g.connect(ctx.destination); src.start(start);
        };
        click(t, 1900, 0.03, 0.16); noise(t + 0.004, 0.045, 0.11);
        click(t + 0.10, 1150, 0.045, 0.13); noise(t + 0.10, 0.05, 0.08);
    } catch {}
}
if (typeof window !== "undefined") {
    const _unlock = () => {
        try { _shutterCtx = _shutterCtx || new (window.AudioContext || (window as any).webkitAudioContext)(); _shutterCtx.resume?.(); } catch {}
        window.removeEventListener("pointerdown", _unlock); window.removeEventListener("keydown", _unlock);
    };
    window.addEventListener("pointerdown", _unlock); window.addEventListener("keydown", _unlock);
}

function LLiveVideo({ deviceId, className }: { deviceId: string; className?: string }) {
    const ref = useRef<HTMLVideoElement>(null);
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    const tries = useRef(0);
    const src = `/go2rtc/api/stream.mp4?src=lpr_${deviceId}&video=h264`;
    useEffect(() => {
        setFailed(false); setReady(false); tries.current = 0;
        const v = ref.current; if (!v) return;
        v.src = src; v.play().catch(() => {});
        const onErr = () => { tries.current++; if (tries.current > 4) { setFailed(true); return; } setTimeout(() => { if (ref.current) { ref.current.src = src; ref.current.play().catch(() => {}); } }, 1500); };
        v.addEventListener("error", onErr);
        return () => { v.removeEventListener("error", onErr); try { v.pause(); v.removeAttribute("src"); v.load(); } catch {} };
    }, [deviceId]);
    if (failed) return <LSnapImg deviceId={deviceId} className={className} />;
    return <video ref={ref} data-ready={ready ? "1" : undefined} onPlaying={() => setReady(true)} onLoadedData={() => setReady(true)} className={cn("object-cover", className)} muted autoPlay playsInline />;
}

function LiveCam({ cam, label, title, count, accent = "emerald", icon, pulseId, cap }: { cam: string | null; label: string; title?: string; count?: number; accent?: "emerald" | "orange" | "blue"; icon?: any; pulseId?: string; cap?: any }) {
    const [flash, setFlash] = useState(false);
    const [shown, setShown] = useState<any>(null);
    const last = useRef<string | undefined>(pulseId);
    const capRef = useRef<any>(null);
    capRef.current = cap;
    useEffect(() => {
        if (pulseId && pulseId !== last.current) {
            last.current = pulseId;
            setFlash(true);
            setShown(capRef.current);
            playShutter();
            const t1 = setTimeout(() => setFlash(false), 1000);
            return () => { clearTimeout(t1); };
        }
    }, [pulseId]);
    // keep the last capture pinned on the video (don't auto-hide it)
    useEffect(() => { if (cap && !shown) setShown(cap); }, [cap, shown]);
    return (
        <div className={cn("relative shrink-0 mx-3 mt-3 mb-1 rounded-lg overflow-hidden border vid-surface aspect-video transition-all duration-300", flash ? "border-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.7)]" : "border-neutral-800")}>
            {cam ? <LLiveVideo deviceId={cam} className="w-full h-full" /> : <div className="flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] text-foreground/40"><Camera size={20} className="opacity-40" /> Sin cámara</div>}
            <div className="absolute top-2 left-2 right-2 z-20 flex items-center gap-2 pointer-events-none">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/65 backdrop-blur-sm border border-white/10 shadow-lg">
                    <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span></span>
                    {icon}
                    <span className={cn("text-[11px] font-bold uppercase tracking-wider", accent === "orange" ? "text-orange-300" : accent === "blue" ? "text-blue-300" : "text-emerald-300")}>{title || label}</span>
                </div>
                {typeof count === "number" && (
                    <span className={cn("ml-auto px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/65 backdrop-blur-sm border", accent === "orange" ? "border-orange-500/40 text-orange-300" : accent === "blue" ? "border-blue-500/40 text-blue-300" : "border-emerald-500/40 text-emerald-300")}>{count}</span>
                )}
            </div>
            {flash && <div className="iris-shot" />}
            {shown && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-2 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/80 backdrop-blur border border-emerald-400/50 shadow-2xl animate-in fade-in slide-in-from-bottom-3 zoom-in-95 duration-300">
                    {shown.img && <img src={shown.img} alt="" className="w-14 h-10 rounded-md object-cover border border-white/20" />}
                    <div className="flex flex-col items-start">
                        {shown.anomalous ? (
                            <span className="text-sm font-bold text-yellow-300">SIN LECTURA</span>
                        ) : (
                            <span className="font-mono text-xl font-black tracking-widest text-white leading-none">{shown.plate}</span>
                        )}
                        <span className={cn("text-[10px] font-bold mt-0.5", shown.ok ? "text-emerald-400" : "text-red-400")}>{shown.ok ? "PERMITIDO" : "DENEGADO"}{shown.sub ? ` · ${shown.sub}` : ""}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function MonitorLPR() {
    const [events, setEvents] = useState<FullAccessEvent[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeFilter, setActiveFilter] = useState<"ALL" | "GRANT" | "DENY">("ALL");
    const [stats, setStats] = useState({ total: 0, grants: 0, denies: 0 });
    const [isConnected, setIsConnected] = useState(false);
    const [devices, setDevices] = useState<Device[]>([]);
    const [streams, setStreams] = useState<string[]>([]);

    const lastEntry = events.find(e => e.direction === 'ENTRY');
    const lastExit = events.find(e => e.direction === 'EXIT');

    const loadInitialData = async () => {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const data = await getAccessEvents({ take: 50, from: twentyFourHoursAgo, type: "PLATE" });
            setEvents(data.events as FullAccessEvent[]);
            const todayStats = await getEventsCountToday("PLATE");
            setStats(todayStats);
        } catch (error) {
            console.error("Error loading LPR data:", error);
        }
    };

    useEffect(() => { getDevices().then((d: any) => setDevices((d || []).filter((x: any) => x.deviceType === "LPR_CAMERA"))).catch(() => {}); getAvailableStreams().then((s: any) => setStreams(s || [])).catch(() => {}); }, []);

    useEffect(() => {
        loadInitialData();
        const socketUrl = getSocketUrl();
        const newSocket = io(socketUrl, { transports: ["websocket", "polling"] });

        newSocket.on("connect", () => setIsConnected(true));
        newSocket.on("disconnect", () => setIsConnected(false));

        newSocket.on("access_event", (event: FullAccessEvent) => {
            // Only LPR events
            if (event.accessType !== "PLATE") return;

            const eventTime = new Date(event.timestamp).getTime();
            const limit = Date.now() - 24 * 60 * 60 * 1000;
            if (eventTime < limit) return;

            // Skip door open/close
            const plate = (event.plateDetected || '').toUpperCase();
            if (plate === 'DOOR_OPEN' || plate === 'DOOR_CLOSE') return;

            setEvents((prev) => [event, ...prev].slice(0, 50));
            setStats(prev => ({
                total: prev.total + 1,
                grants: prev.grants + (event.decision === "GRANT" ? 1 : 0),
                denies: prev.denies + (event.decision === "DENY" ? 1 : 0)
            }));
        });

        setSocket(newSocket);
        return () => { newSocket.disconnect(); };
    }, []);

    const filteredEvents = useMemo(() => {
        return events.filter(e => {
            const plate = (e.plateDetected || '').toUpperCase();
            if (plate === 'DOOR_OPEN' || plate === 'DOOR_CLOSE') return false;
            if (activeFilter !== "ALL" && e.decision !== activeFilter) return false;
            return true;
        });
    }, [events, activeFilter]);

    const entryEvents = useMemo(() => filteredEvents.filter(e => e.direction === 'ENTRY'), [filteredEvents]);
    const exitEvents = useMemo(() => filteredEvents.filter(e => e.direction === 'EXIT'), [filteredEvents]);
    const lprDevs = useMemo(() => devices, [devices]);
    const hasStream = (id: any) => !!id && streams.includes(`lpr_${id}`);
    const pickCam = (evts: any[], dir: string) => {
        for (const e of evts) { if (hasStream(e?.device?.id)) return e.device.id; }
        const d = lprDevs.find((x: any) => x.direction === dir && hasStream(x.id)) || lprDevs.find((x: any) => hasStream(x.id));
        return d?.id || null;
    };
    const entryCam = useMemo(() => pickCam(entryEvents, "ENTRY"), [lprDevs, entryEvents, streams]);
    const exitCam = useMemo(() => pickCam(exitEvents, "EXIT"), [lprDevs, exitEvents, streams]);

    const getImageUrl = (path: string | null | undefined): string => getImagePath(path) || "";

    const parseMeta = (details: string | null) => {
        const meta: any = {};
        if (details) {
            details.split(',').forEach(p => {
                const [k, v] = p.split(':').map(s => s.trim());
                if (k && v) meta[k] = v;
            });
        }
        if (meta.Marca) {
            let cleanBrand = meta.Marca.replace(/\s*UNKNOWN\s*/gi, '').trim();
            const brandCodeMatch = cleanBrand.match(/BRAND\s*(\d+)/i);
            if (brandCodeMatch) cleanBrand = getVehicleBrandName(brandCodeMatch[1]);
            meta.Marca = cleanBrand;
        }
        return meta;
    };

    const VehicleCard = ({ event }: { event: FullAccessEvent }) => {
        const meta = parseMeta(event.details);
        const logoUrl = getCarLogo(meta.Marca);
        const fullImageUrl = getImageUrl(event.snapshotPath || event.imagePath);
        const isAnomalous = event.plateDetected === "NO_LEIDA" || event.plateDetected === "unknown" || event.plateDetected === "S/P" || !event.plateDetected;

        return (
            <EventDetailsDialog event={event} timeStatus={null}>
                <div className={cn(
                    "p-3 cursor-pointer transition-all group border-b border-border last:border-0",
                    isAnomalous ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "hover:bg-accent"
                )}>
                    <div className="flex items-center gap-3">
                        {/* Thumbnail */}
                        <div className="w-20 h-14 rounded-lg bg-card border border-border overflow-hidden relative shrink-0">
                            {fullImageUrl ? (
                                <Image src={fullImageUrl} alt="Captura" fill sizes="80px" className="object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Car size={20} className="text-muted-foreground" />
                                </div>
                            )}
                        </div>

                        {/* Plate + info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                {isAnomalous ? (
                                    <div className="flex items-center gap-1 text-yellow-400">
                                        <AlertTriangle size={12} />
                                        <span className="text-xs font-bold">SIN LECTURA</span>
                                    </div>
                                ) : (
                                    <span className="font-mono text-sm font-bold text-foreground tracking-wider">
                                        {event.plateDetected}
                                    </span>
                                )}
                                <Badge variant="outline" className={cn(
                                    "text-[9px] px-1.5 py-0",
                                    event.decision === "GRANT" ? "border-emerald-500/50 text-emerald-400" : "border-red-500/50 text-red-400"
                                )}>
                                    {event.decision === "GRANT" ? "OK" : "DENY"}
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2 mt-1">
                                {logoUrl && (
                                    <Image src={logoUrl} alt={meta.Marca || ""} width={16} height={16} className="rounded-sm opacity-70" />
                                )}
                                {meta.Marca && <span className="text-[10px] text-muted-foreground">{meta.Marca}</span>}
                                {event.user?.name && (
                                    <span className="text-[10px] text-blue-400 truncate">{event.user.name}</span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                <TimeAgo timestamp={event.timestamp} />
                                {event.device?.name && <span>• {event.device.name}</span>}
                            </div>
                        </div>
                    </div>
                </div>
            </EventDetailsDialog>
        );
    };

    return (
        <TooltipProvider>
            <div className="h-full flex flex-col bg-background text-foreground">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/10">
                            <Car size={22} className="text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">Monitor LPR</h1>
                            <p className="text-xs text-muted-foreground">Reconocimiento de matrículas en tiempo real</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Connection status */}
                        <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                            isConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        )}>
                            <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
                            {isConnected ? "LIVE" : "OFFLINE"}
                        </div>

                        {/* Quick stats */}
                        <div className="flex items-center gap-3 pl-1">
                            <span className="flex items-center gap-1.5 text-xs"><Activity size={13} className="text-blue-400" /><span className="text-muted-foreground">Hoy</span><span className="font-bold text-foreground">{stats.total}</span></span>
                            <span className="flex items-center gap-1 text-xs"><CheckCircle2 size={13} className="text-emerald-400" /><span className="font-semibold text-emerald-400">{stats.grants}</span></span>
                            <span className="flex items-center gap-1 text-xs"><XCircle size={13} className="text-red-400" /><span className="font-semibold text-red-400">{stats.denies}</span></span>
                            <span className="text-[10px] text-muted-foreground hidden xl:inline">{filteredEvents.length} en buffer</span>
                        </div>
                        <div className="w-px h-5 bg-border" />

                        {/* Decision filter */}
                        <div className="flex bg-card rounded-lg p-0.5">
                            {(["ALL", "GRANT", "DENY"] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setActiveFilter(f)}
                                    className={cn(
                                        "px-3 py-1 text-xs rounded-md transition-all",
                                        activeFilter === f ? "bg-blue-500 text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {f === "ALL" ? "Todos" : f === "GRANT" ? "Permitidos" : "Denegados"}
                                </button>
                            ))}
                        </div>

                        <Button variant="ghost" size="icon" onClick={loadInitialData} className="text-muted-foreground hover:text-foreground">
                            <RefreshCw size={16} />
                        </Button>
                    </div>
                </div>

                {/* Three columns */}
                <div className="flex-1 grid grid-cols-3 divide-x divide-neutral-800 overflow-hidden">
                    {/* ENTRIES */}
                    <div className="flex flex-col overflow-hidden">
                        <LiveCam cam={entryCam} label="Entrada" title="Entradas" count={entryEvents.length} accent="emerald" icon={<LogIn size={13} className="text-emerald-400" />} pulseId={entryEvents[0]?.id} cap={entryEvents[0] ? {
                            img: getImageUrl(entryEvents[0].snapshotPath || entryEvents[0].imagePath),
                            plate: entryEvents[0].plateDetected,
                            sub: parseMeta(entryEvents[0].details).Marca || entryEvents[0].user?.name || "",
                            ok: entryEvents[0].decision === "GRANT",
                            anomalous: !entryEvents[0].plateDetected || ["NO_LEIDA", "unknown", "S/P"].includes(entryEvents[0].plateDetected || "")
                        } : null} />
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {entryEvents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                                    <Car size={24} className="mb-2 opacity-30" />
                                    <span className="text-xs">Sin entradas recientes</span>
                                </div>
                            ) : (
                                entryEvents.map(e => <VehicleCard key={e.id} event={e} />)
                            )}
                        </div>
                    </div>

                    {/* CENTER: Latest capture spotlight */}
                    <div className="flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* Spotlight: last event */}
                            {!filteredEvents[0] && (
                                <div className="p-4">
                                    <div className="relative w-full aspect-video rounded-xl overflow-hidden vid-surface border border-border flex items-center justify-center">
                                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/65 backdrop-blur-sm border border-blue-500/30 shadow-lg">
                                            <Camera size={13} className="text-blue-400" />
                                            <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">Última Captura</span>
                                        </div>
                                        <Camera size={36} className="text-muted-foreground/40" />
                                    </div>
                                </div>
                            )}
                            {filteredEvents[0] && (() => {
                                const ev = filteredEvents[0];
                                const meta = parseMeta(ev.details);
                                const imgUrl = getImageUrl(ev.snapshotPath || ev.imagePath);
                                const logoUrl = getCarLogo(meta.Marca);
                                const isAnomalous = ev.plateDetected === "NO_LEIDA" || ev.plateDetected === "unknown" || ev.plateDetected === "S/P" || !ev.plateDetected;

                                return (
                                    <div className="p-4">
                                        <div className="relative w-full aspect-video rounded-xl overflow-hidden vid-surface border border-border">
                                            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/65 backdrop-blur-sm border border-blue-500/30 shadow-lg pointer-events-none">
                                                <Camera size={13} className="text-blue-400" />
                                                <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">Última Captura</span>
                                            </div>
                                            {imgUrl ? (
                                                <Image src={imgUrl} alt="Captura" fill sizes="500px" className="object-cover" onLoad={(e) => (e.currentTarget as HTMLImageElement).setAttribute("data-ready", "1")} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-card">
                                                    <Camera size={40} className="text-muted-foreground" />
                                                </div>
                                            )}
                                            <div className="absolute top-3 left-3 z-10">
                                                <Badge className={cn("text-xs shadow-lg", ev.direction === "ENTRY" ? "bg-emerald-500" : "bg-orange-500")}>
                                                    {ev.direction === "ENTRY" ? "ENTRADA" : "SALIDA"}
                                                </Badge>
                                            </div>
                                            <div className="absolute top-3 right-3 z-10">
                                                <Badge className={cn("text-xs shadow-lg", ev.decision === "GRANT" ? "bg-emerald-600" : "bg-red-600")}>
                                                    {ev.decision === "GRANT" ? "PERMITIDO" : "DENEGADO"}
                                                </Badge>
                                            </div>
                                            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pb-3 pt-14">
                                                {isAnomalous ? (
                                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 rounded-lg border border-yellow-500/50 backdrop-blur-sm">
                                                        <AlertTriangle size={18} className="text-yellow-300" />
                                                        <span className="text-lg font-bold text-yellow-300">SIN LECTURA</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-block px-4 py-1.5 bg-black/50 rounded-lg border border-blue-400/40 backdrop-blur-sm">
                                                        <span className="font-mono text-3xl font-black tracking-[0.2em] text-white drop-shadow">
                                                            {ev.plateDetected}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                    {meta.Marca && (
                                                        <span className="flex items-center gap-1.5 text-sm text-white/90">
                                                            {logoUrl && <Image src={logoUrl} alt="" width={18} height={18} className="rounded" />}
                                                            {meta.Marca}
                                                        </span>
                                                    )}
                                                    {ev.user?.name && (<span className="text-sm font-medium text-blue-300">{ev.user.name}</span>)}
                                                    {ev.user?.unit?.name && (<span className="text-xs text-white/70">{ev.user.unit.name}</span>)}
                                                </div>
                                                <div className="text-xs text-white/70 mt-1">
                                                    <TimeAgo timestamp={ev.timestamp} /> • {ev.device?.name || "Dispositivo"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Recent list below spotlight */}
                            <div className="px-4 pb-2">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Capturas recientes</div>
                            </div>
                            {filteredEvents.slice(1, 15).map(e => <VehicleCard key={e.id} event={e} />)}
                        </div>
                    </div>

                    {/* EXITS */}
                    <div className="flex flex-col overflow-hidden">
                        <LiveCam cam={exitCam} label="Salida" title="Salidas" count={exitEvents.length} accent="orange" icon={<LogOut size={13} className="text-orange-400" />} pulseId={exitEvents[0]?.id} cap={exitEvents[0] ? {
                            img: getImageUrl(exitEvents[0].snapshotPath || exitEvents[0].imagePath),
                            plate: exitEvents[0].plateDetected,
                            sub: parseMeta(exitEvents[0].details).Marca || exitEvents[0].user?.name || "",
                            ok: exitEvents[0].decision === "GRANT",
                            anomalous: !exitEvents[0].plateDetected || ["NO_LEIDA", "unknown", "S/P"].includes(exitEvents[0].plateDetected || "")
                        } : null} />
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {exitEvents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                                    <Car size={24} className="mb-2 opacity-30" />
                                    <span className="text-xs">Sin salidas recientes</span>
                                </div>
                            ) : (
                                exitEvents.map(e => <VehicleCard key={e.id} event={e} />)
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
