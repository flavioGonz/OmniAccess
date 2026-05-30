"use client";

import { useEffect, useState, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessEvents, getEventsCountToday } from "@/app/actions/history";
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

export default function MonitorLPR() {
    const [events, setEvents] = useState<FullAccessEvent[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeFilter, setActiveFilter] = useState<"ALL" | "GRANT" | "DENY">("ALL");
    const [stats, setStats] = useState({ total: 0, grants: 0, denies: 0 });
    const [isConnected, setIsConnected] = useState(false);

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

                {/* Stats bar */}
                <div className="px-6 py-3 border-b border-border/50 flex items-center gap-6 shrink-0">
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-blue-400" />
                        <span className="text-xs text-muted-foreground">Hoy:</span>
                        <span className="text-sm font-bold text-foreground">{stats.total}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <span className="text-sm font-semibold text-emerald-400">{stats.grants}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <XCircle size={14} className="text-red-400" />
                        <span className="text-sm font-semibold text-red-400">{stats.denies}</span>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground">
                        {filteredEvents.length} eventos en buffer
                    </div>
                </div>

                {/* Three columns */}
                <div className="flex-1 grid grid-cols-3 divide-x divide-neutral-800 overflow-hidden">
                    {/* ENTRIES */}
                    <div className="flex flex-col overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 shrink-0 bg-emerald-500/5">
                            <LogIn size={14} className="text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Entradas</span>
                            <Badge variant="outline" className="ml-auto text-[10px] border-emerald-500/30 text-emerald-400">{entryEvents.length}</Badge>
                        </div>
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
                        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 shrink-0 bg-blue-500/5">
                            <Camera size={14} className="text-blue-400" />
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Última Captura</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* Spotlight: last event */}
                            {filteredEvents[0] && (() => {
                                const ev = filteredEvents[0];
                                const meta = parseMeta(ev.details);
                                const imgUrl = getImageUrl(ev.snapshotPath || ev.imagePath);
                                const logoUrl = getCarLogo(meta.Marca);
                                const isAnomalous = ev.plateDetected === "NO_LEIDA" || ev.plateDetected === "unknown" || ev.plateDetected === "S/P" || !ev.plateDetected;

                                return (
                                    <div className="p-4">
                                        {/* Big image */}
                                        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-card border border-border mb-4">
                                            {imgUrl ? (
                                                <Image src={imgUrl} alt="Captura" fill sizes="400px" className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Camera size={40} className="text-muted-foreground" />
                                                </div>
                                            )}
                                            {/* Overlay: direction badge */}
                                            <div className="absolute top-3 left-3">
                                                <Badge className={cn(
                                                    "text-xs",
                                                    ev.direction === "ENTRY" ? "bg-emerald-500" : "bg-orange-500"
                                                )}>
                                                    {ev.direction === "ENTRY" ? "ENTRADA" : "SALIDA"}
                                                </Badge>
                                            </div>
                                            <div className="absolute top-3 right-3">
                                                <Badge className={cn(
                                                    "text-xs",
                                                    ev.decision === "GRANT" ? "bg-emerald-600" : "bg-red-600"
                                                )}>
                                                    {ev.decision === "GRANT" ? "PERMITIDO" : "DENEGADO"}
                                                </Badge>
                                            </div>
                                        </div>

                                        {/* Big plate */}
                                        <div className="text-center mb-4">
                                            {isAnomalous ? (
                                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
                                                    <AlertTriangle size={18} className="text-yellow-400" />
                                                    <span className="text-lg font-bold text-yellow-400">SIN LECTURA</span>
                                                </div>
                                            ) : (
                                                <div className="inline-block px-6 py-3 bg-card rounded-xl border border-blue-500/30">
                                                    <span className="font-mono text-3xl font-black tracking-[0.2em] text-foreground">
                                                        {ev.plateDetected}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Meta info */}
                                        <div className="space-y-2">
                                            {meta.Marca && (
                                                <div className="flex items-center gap-2 justify-center">
                                                    {logoUrl && <Image src={logoUrl} alt="" width={20} height={20} className="rounded" />}
                                                    <span className="text-sm text-muted-foreground">{meta.Marca}</span>
                                                </div>
                                            )}
                                            {ev.user?.name && (
                                                <div className="text-center text-sm text-blue-400 font-medium">{ev.user.name}</div>
                                            )}
                                            {ev.user?.unit?.name && (
                                                <div className="text-center text-xs text-muted-foreground">{ev.user.unit.name}</div>
                                            )}
                                            <div className="text-center text-xs text-muted-foreground">
                                                <TimeAgo timestamp={ev.timestamp} /> • {ev.device?.name || "Dispositivo"}
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
                        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 shrink-0 bg-orange-500/5">
                            <LogOut size={14} className="text-orange-400" />
                            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Salidas</span>
                            <Badge variant="outline" className="ml-auto text-[10px] border-orange-500/30 text-orange-400">{exitEvents.length}</Badge>
                        </div>
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
