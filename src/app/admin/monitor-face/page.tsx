"use client";

import { useEffect, useState, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessEvents, getEventsCountToday } from "@/app/actions/history";
import {
    ScanFace,
    CheckCircle2,
    XCircle,
    UserCheck,
    UserX,
    Shield,
    Activity,
    RefreshCw,
    DoorOpen,
    Clock,
    LogIn,
    LogOut,
    Camera,
    Zap,
    Wifi,
    Building2,
    Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EventDetailsDialog } from "@/components/dashboard/EventDetailsDialog";
import Image from "next/image";
import { AccessEvent, Device, Unit } from "@prisma/client";
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
            if (diff < 60) setLabel(`${diff}s`);
            else if (diff < 3600) setLabel(`${Math.floor(diff / 60)}m`);
            else if (diff < 86400) setLabel(`${Math.floor(diff / 3600)}h`);
            else setLabel(`${Math.floor(diff / 86400)}d`);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [timestamp]);
    return <span>{label}</span>;
}

export default function MonitorFace() {
    const [events, setEvents] = useState<FullAccessEvent[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeFilter, setActiveFilter] = useState<"ALL" | "GRANT" | "DENY">("ALL");
    const [isConnected, setIsConnected] = useState(false);

    const loadInitialData = async () => {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const data = await getAccessEvents({ take: 80, from: twentyFourHoursAgo, type: "FACE" });
            setEvents(data.events as FullAccessEvent[]);
        } catch (error) {
            console.error("Error loading face data:", error);
        }
    };

    useEffect(() => {
        loadInitialData();
        const socketUrl = getSocketUrl();
        const newSocket = io(socketUrl, { transports: ["websocket", "polling"] });
        newSocket.on("connect", () => setIsConnected(true));
        newSocket.on("disconnect", () => setIsConnected(false));
        newSocket.on("access_event", (event: FullAccessEvent) => {
            if (event.accessType !== "FACE") return;
            const eventTime = new Date(event.timestamp).getTime();
            const limit = Date.now() - 24 * 60 * 60 * 1000;
            if (eventTime < limit) return;
            setEvents((prev) => [event, ...prev].slice(0, 100));
        });
        setSocket(newSocket);
        return () => { newSocket.disconnect(); };
    }, []);

    const filteredEvents = useMemo(() => {
        return events.filter(e => activeFilter === "ALL" || e.decision === activeFilter);
    }, [events, activeFilter]);

    const entryEvents = useMemo(() => filteredEvents.filter(e => e.direction === "ENTRY"), [filteredEvents]);
    const exitEvents = useMemo(() => filteredEvents.filter(e => e.direction === "EXIT"), [filteredEvents]);

    const getImg = (path: string | null | undefined): string => getImagePath(path) || "";

    const parseMeta = (details: string | null) => {
        const meta: any = {};
        if (details) {
            details.split(',').forEach(p => {
                const [k, v] = p.split(':').map(s => s.trim());
                if (k && v) meta[k] = v;
            });
        }
        return meta;
    };

    // ─── FACE TILE — photo-first, no box, data overlaid ───
    const FaceTile = ({ event, size = "sm" }: { event: FullAccessEvent; size?: "sm" | "md" | "lg" }) => {
        const meta = parseMeta(event.details);
        const faceUrl = getImg(meta.FaceImage) || getImg(event.user?.cara);
        const snapUrl = getImg(event.snapshotPath || event.imagePath);
        const imgSrc = faceUrl || snapUrl;
        const similarity = meta.Similitud ? parseInt(meta.Similitud) : null;
        const personName = event.user?.name || meta.Rostro;
        const isRecognized = !!personName;
        const isDenied = event.decision !== "GRANT";

        const sizeClasses = {
            sm: "w-full",
            md: "w-full",
            lg: "w-full",
        };

        return (
            <EventDetailsDialog event={event} timeStatus={null}>
                <div className={cn(
                    "relative group cursor-pointer overflow-hidden rounded-md",
                    sizeClasses[size],
                )}>
                    {/* The face photo — fills the entire tile */}
                    <div className={cn(
                        "relative w-full overflow-hidden",
                        size === "lg" ? "aspect-[3/4]" : "aspect-square"
                    )}>
                        {imgSrc ? (
                            <Image
                                src={imgSrc}
                                alt={personName || "Rostro"}
                                fill
                                sizes={size === "lg" ? "300px" : size === "md" ? "180px" : "120px"}
                                className="object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                        ) : (
                            <div className="w-full h-full bg-card flex items-center justify-center">
                                <ScanFace size={size === "lg" ? 32 : 20} className="text-muted-foreground" />
                            </div>
                        )}

                        {/* Red pulsing overlay for DENIED */}
                        {isDenied && (
                            <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none" />
                        )}
                        {isDenied && (
                            <div className="absolute inset-0 border-2 border-red-500/60 rounded-md pointer-events-none" />
                        )}

                        {/* Top-left: decision indicator */}
                        <div className="absolute top-1 left-1 z-10">
                            {isDenied ? (
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse" />
                            ) : (
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                            )}
                        </div>

                        {/* Top-right: similarity badge */}
                        {similarity != null && similarity > 0 && (
                            <div className="absolute top-1 right-1 z-10">
                                <span className={cn(
                                    "text-[8px] font-black px-1 py-px rounded-sm backdrop-blur-sm",
                                    similarity >= 80 ? "bg-emerald-500/80 text-foreground" : similarity >= 60 ? "bg-amber-500/80 text-foreground" : "bg-red-500/80 text-foreground"
                                )}>
                                    {similarity}%
                                </span>
                            </div>
                        )}

                        {/* Bottom gradient overlay with data */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-6 pb-1.5 px-1.5 z-10">
                            <p className={cn(
                                "text-[10px] font-bold truncate leading-tight",
                                isRecognized ? "text-foreground" : "text-amber-400"
                            )}>
                                {personName || "Desconocido"}
                            </p>
                            <div className="flex items-center justify-between mt-0.5">
                                <span className="text-[8px] text-muted-foreground font-medium">
                                    <TimeAgo timestamp={event.timestamp} />
                                </span>
                                <span className="text-[8px] text-muted-foreground truncate max-w-[55%]">
                                    {event.device?.name}
                                </span>
                            </div>
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                </div>
            </EventDetailsDialog>
        );
    };

    // ─── SPOTLIGHT — latest detection, large format ───
    const SpotlightTile = ({ event }: { event: FullAccessEvent }) => {
        const meta = parseMeta(event.details);
        const faceUrl = getImg(meta.FaceImage) || getImg(event.user?.cara);
        const snapUrl = getImg(event.snapshotPath || event.imagePath);
        const imgSrc = faceUrl || snapUrl;
        const similarity = meta.Similitud ? parseInt(meta.Similitud) : null;
        const personName = event.user?.name || meta.Rostro;
        const isRecognized = !!personName;
        const isDenied = event.decision !== "GRANT";

        return (
            <EventDetailsDialog event={event} timeStatus={null}>
                <div className="relative group cursor-pointer overflow-hidden rounded-lg">
                    <div className="relative w-full aspect-[16/10] overflow-hidden">
                        {imgSrc ? (
                            <Image
                                src={imgSrc}
                                alt={personName || "Rostro"}
                                fill
                                sizes="600px"
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        ) : (
                            <div className="w-full h-full bg-card flex items-center justify-center">
                                <ScanFace size={48} className="text-muted-foreground" />
                            </div>
                        )}

                        {/* Red pulsing overlay for DENIED */}
                        {isDenied && (
                            <>
                                <div className="absolute inset-0 bg-red-600/15 animate-pulse pointer-events-none" />
                                <div className="absolute inset-0 border-2 border-red-500/50 rounded-lg pointer-events-none" />
                            </>
                        )}

                        {/* Reticle corners */}
                        <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-emerald-500/50 z-10" />
                        <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-emerald-500/50 z-10" />
                        <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-emerald-500/50 z-10" />
                        <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-emerald-500/50 z-10" />

                        {/* Match badge */}
                        {similarity != null && similarity > 0 && (
                            <div className="absolute top-3 right-10 z-10">
                                <span className={cn(
                                    "text-[11px] font-black px-2 py-0.5 rounded backdrop-blur-sm",
                                    similarity >= 80 ? "bg-emerald-500/90 text-foreground" : similarity >= 60 ? "bg-amber-500/90 text-foreground" : "bg-red-500/90 text-foreground"
                                )}>
                                    {similarity}% MATCH
                                </span>
                            </div>
                        )}

                        {/* Large bottom overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-12 pb-4 px-4 z-10">
                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                                            isDenied
                                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                        )}>
                                            {isDenied ? "Denegado" : "Autorizado"}
                                        </span>
                                        <span className={cn(
                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold",
                                            event.direction === "ENTRY"
                                                ? "bg-blue-500/15 text-blue-400"
                                                : "bg-orange-500/15 text-orange-400"
                                        )}>
                                            {event.direction === "ENTRY" ? <LogIn size={9} /> : <LogOut size={9} />}
                                            {event.direction === "ENTRY" ? "Entrada" : "Salida"}
                                        </span>
                                    </div>
                                    <h2 className={cn(
                                        "text-2xl font-black leading-tight",
                                        isRecognized ? "text-foreground" : "text-amber-400"
                                    )}>
                                        {personName || "Desconocido"}
                                    </h2>
                                    {event.user?.unit?.name && (
                                        <p className="text-xs text-blue-400/80 font-medium mt-0.5">{event.user.unit.name}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground font-mono">
                                        <TimeAgo timestamp={event.timestamp} />
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{event.device?.name}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </EventDetailsDialog>
        );
    };

    // ─── COLUMN COMPONENT ───
    const DirectionColumn = ({ title, icon: Icon, events, iconColor }: {
        title: string;
        icon: any;
        events: FullAccessEvent[];
        iconColor: string;
    }) => (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-3 px-1">
                <Icon size={14} className={iconColor} />
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">{title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">{events.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-180px)] pr-1 custom-scrollbar">
                {events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <ScanFace size={24} className="opacity-30 mb-2" />
                        <span className="text-[10px]">Sin detecciones</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                        {events.slice(0, 30).map(e => (
                            <FaceTile key={e.id} event={e} size="sm" />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
                        <ScanFace size={20} className="text-teal-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">Monitor Facial</h1>
                        <p className="text-[10px] text-muted-foreground">Reconocimiento en tiempo real</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border",
                        isConnected
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
                        {isConnected ? "LIVE" : "OFFLINE"}
                    </div>

                    <div className="flex items-center gap-1 bg-muted/40 rounded-md p-1 border border-border/30">
                        {(["ALL", "GRANT", "DENY"] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={cn(
                                    "px-3 py-1.5 rounded text-xs font-semibold transition-all",
                                    activeFilter === f
                                        ? (f === "GRANT" ? "bg-emerald-600 text-foreground" : f === "DENY" ? "bg-red-600 text-foreground" : "bg-violet-600 text-foreground")
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {f === "ALL" ? "Todos" : f === "GRANT" ? "Permitidos" : "Denegados"}
                            </button>
                        ))}
                    </div>

                    <button onClick={loadInitialData} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* 3-Column Layout */}
            <div className="flex-1 grid grid-cols-[1fr_2fr_1fr] gap-4 p-4 overflow-hidden">
                {/* ENTRADA */}
                <DirectionColumn
                    title="Entrada"
                    icon={LogIn}
                    events={entryEvents}
                    iconColor="text-blue-400"
                />

                {/* CENTER — Spotlight + Recent Grid */}
                <div className="flex flex-col gap-3 overflow-hidden">
                    {filteredEvents[0] && (
                        <SpotlightTile event={filteredEvents[0]} />
                    )}

                    <div className="flex items-center gap-2 px-1">
                        <Zap size={12} className="text-violet-400" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Capturas Recientes</span>
                        <span className="ml-auto text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">{filteredEvents.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredEvents.length <= 1 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                <ScanFace size={32} className="opacity-20 mb-2" />
                                <span className="text-xs">Esperando detecciones...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-5 gap-1.5">
                                {filteredEvents.slice(1, 31).map(e => (
                                    <FaceTile key={e.id} event={e} size="sm" />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* SALIDA */}
                <DirectionColumn
                    title="Salida"
                    icon={LogOut}
                    events={exitEvents}
                    iconColor="text-orange-400"
                />
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.08);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.15);
                }
            `}</style>
        </div>
    );
}
