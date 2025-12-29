"use client";

import { useEffect, useState, useMemo } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessEvents, getEventsCountToday } from "@/app/actions/history";
import {
    Activity,
    Car,
    User as UserIcon,
    CreditCard,
    DoorOpen,
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
    LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EventDetailsDialog } from "@/components/dashboard/EventDetailsDialog";
import Image from "next/image";
import { AccessEvent, User, Device, Unit } from "@prisma/client";
import { getCarLogo } from "@/lib/car-logos";

interface FullAccessEvent extends AccessEvent {
    user: (User & { unit: Unit | null, cara?: string | null }) | null;
    device: Device | null;
}

export default function AccessDashboard() {
    const [events, setEvents] = useState<FullAccessEvent[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeFilter, setActiveFilter] = useState<"ALL" | "GRANT" | "DENY">("ALL");
    const [activeType, setActiveType] = useState<"ALL" | "PLATE" | "FACE" | "TAG" | "DOOR">("ALL");
    const [stats, setStats] = useState({ total: 0, grants: 0, denies: 0 });

    const loadInitialData = async () => {
        try {
            const data = await getAccessEvents({ take: 50 });
            setEvents(data.events as FullAccessEvent[]);

            const todayStats = await getEventsCountToday();
            setStats(todayStats);
        } catch (error) {
            console.error("Error loading data:", error);
        }
    };

    useEffect(() => {
        loadInitialData();

        const socketUrl = `http://${window.location.hostname}:10000`;
        console.log("🔌 Connecting to socket:", socketUrl);

        const newSocket = io(socketUrl, {
            transports: ["websocket", "polling"],
        });

        newSocket.on("connect", () => console.log("✅ Socket connected"));

        newSocket.on("access_event", (event: FullAccessEvent) => {
            console.log("📥 New access event received:", event);
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
            if (activeFilter !== "ALL" && e.decision !== activeFilter) return false;
            if (activeType !== "ALL" && e.accessType !== activeType) return false;
            return true;
        });
    }, [events, activeFilter, activeType]);

    const successRate = stats.total > 0 ? ((stats.grants / stats.total) * 100).toFixed(1) : 0;

    // Derived columns
    const entryEvents = filteredEvents.filter(e => e.direction === 'ENTRY');
    const exitEvents = filteredEvents.filter(e => e.direction === 'EXIT');
    const captureEvents = filteredEvents.filter(e => e.plateImagePath || e.snapshotPath || e.user?.cara);

    const EventItem = ({ event }: { event: FullAccessEvent }) => {
        const typeConfig = {
            PLATE: { icon: Car, color: "blue", label: "LPR", bgClass: "bg-blue-500/10", textClass: "text-blue-400" },
            FACE: { icon: UserIcon, color: "purple", label: "FACE", bgClass: "bg-purple-500/10", textClass: "text-purple-400" },
            TAG: { icon: CreditCard, color: "amber", label: "RFID", bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
            DOOR: { icon: DoorOpen, color: "emerald", label: "DOOR", bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" }
        };

        const config = typeConfig[event.accessType as keyof typeof typeConfig] || typeConfig.TAG;
        const TypeIcon = config.icon;

        // Extract LPR metadata
        const meta: any = {};
        if (event.accessType === 'PLATE' && event.details) {
            event.details.split(',').forEach(p => {
                const [k, v] = p.split(':').map(s => s.trim());
                if (k && v) meta[k] = v;
            });
        }
        const logoUrl = getCarLogo(meta.Marca);

        return (
            <EventDetailsDialog event={event}>
                <div className="p-4 hover:bg-white/5 cursor-pointer transition-all group border-b border-white/5 last:border-0 border-l-2 border-l-transparent hover:border-l-indigo-500">
                    <div className="flex items-center gap-3">
                        <div className={cn("rounded-lg shrink-0 flex items-center justify-center p-1.5", "bg-white border border-white/10 shadow-sm", "w-11 h-11")}>
                            {logoUrl ? (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={logoUrl}
                                        alt="B"
                                        fill
                                        sizes="44px"
                                        className="object-contain"
                                    />
                                </div>
                            ) : (
                                <div className={cn("w-full h-full rounded flex items-center justify-center", config.bgClass)}>
                                    <TypeIcon size={18} className={config.textClass} />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    {event.accessType === "PLATE" ? (
                                        <div className="flex flex-col bg-white border border-neutral-800 rounded-sm overflow-hidden min-w-[80px] mt-0.5">
                                            <div className="h-0.5 bg-blue-600 w-full" />
                                            <p className="text-[12px] font-black text-black tracking-widest uppercase px-2 py-0.5 text-center font-mono leading-none">
                                                {event.plateDetected === "NO_LEIDA" ? "S/P" : event.plateDetected}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-black text-white truncate tracking-tight uppercase">
                                            {event.user?.name || event.plateDetected || "ID: " + event.id.slice(-4)}
                                        </p>
                                    )}
                                    {meta.Color && event.accessType !== "PLATE" && (
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.Color.toLowerCase() === 'blanco' ? '#fff' : meta.Color.toLowerCase() === 'negro' ? '#000' : meta.Color }} />
                                    )}
                                </div>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1 truncate italic">
                                    {event.accessType === 'PLATE' ? (
                                        `${meta.Marca || ''} ${meta.Modelo || ''} ${meta.Tipo ? `• ${meta.Tipo}` : ''}`.trim() || 'Vehículo Detectado'
                                    ) : (
                                        event.user?.unit?.name || 'Acceso Manual'
                                    )}
                                </p>
                            </div>
                            <span className="text-[10px] font-mono text-neutral-500 mt-1.5 block">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        </div>
                        <div className="flex items-center ml-2">
                            <div className={cn(
                                "w-24 py-2 rounded-lg font-black text-[10px] uppercase text-center tracking-tighter shadow-lg",
                                event.decision === "GRANT"
                                    ? "bg-emerald-600 text-white shadow-emerald-900/40 border border-emerald-500/30"
                                    : "bg-red-600 text-white shadow-red-900/40 border border-red-500/30"
                            )}>
                                {event.decision === "GRANT" ? "PERMITIDO" : "DENEGADO"}
                            </div>
                        </div>
                    </div>
                </div>
            </EventDetailsDialog>
        );
    };

    return (
        <div className="h-full p-6 overflow-hidden animate-in fade-in duration-700">
            {/* Main 3-Column Layout - Forced 3 columns with equal width and full height */}
            <div className="grid grid-cols-3 gap-6 h-full">

                {/* COLUMN 1: ENTRADAS */}
                <div className="flex flex-col h-full bg-neutral-900/40 border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                    <div className="p-5 border-b border-indigo-500/20 bg-indigo-500/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500 font-black text-white flex items-center justify-center text-xs shadow-lg shadow-indigo-900/40 italic">IN</div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-tighter">Entradas</h3>
                                    <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">Flujo de Ingreso</p>
                                </div>
                            </div>
                            <Badge className="bg-indigo-500 text-white font-black text-[10px]">{entryEvents.length}</Badge>
                        </div>

                        {/* Iconic Filter Strip */}
                        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
                            <Filter size={11} className="text-neutral-600 shrink-0 mx-1" />
                            <div className="flex-1 flex justify-center gap-1 border-x border-white/5 px-2">
                                {(["ALL", "GRANT", "DENY"] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setActiveFilter(f)}
                                        className={cn(
                                            "w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                                            activeFilter === f
                                                ? (f === 'GRANT' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40' : f === 'DENY' ? 'bg-red-500 text-white shadow-lg shadow-red-900/40' : 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/40')
                                                : "text-neutral-600 hover:text-neutral-400 hover:bg-white/5"
                                        )}
                                        title={f === 'ALL' ? 'Todos' : f === 'GRANT' ? 'Autorizados' : 'Denegados'}
                                    >
                                        {f === 'ALL' ? <Activity size={12} /> : f === 'GRANT' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1 pr-1">
                                {(["ALL", "PLATE", "FACE", "TAG"] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setActiveType(t)}
                                        className={cn(
                                            "w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                                            activeType === t
                                                ? "bg-white/10 text-indigo-400 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.1)]"
                                                : "text-neutral-600 hover:text-neutral-400 hover:bg-white/5"
                                        )}
                                        title={t}
                                    >
                                        {t === 'ALL' ? <Zap size={12} /> : t === 'PLATE' ? <Car size={12} /> : t === 'FACE' ? <UserIcon size={12} /> : <CreditCard size={12} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                        {entryEvents.map(event => <EventItem key={event.id} event={event} />)}
                        {entryEvents.length === 0 && <div className="p-10 text-center text-neutral-600 font-bold text-[10px] uppercase tracking-widest mt-10">No hay entradas recientes</div>}
                    </div>
                </div>

                {/* COLUMN 2: ULTIMAS CAPTURAS (HIGHLIGHTS) */}
                <div className="flex flex-col h-full bg-neutral-900/60 border border-indigo-500/20 rounded-xl overflow-hidden shadow-indigo-900/20 shadow-xl scale-[1.02] z-10">
                    <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg"><Camera className="text-indigo-400" size={18} /></div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-tighter">Últimas Capturas</h3>
                                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Evidencia Visual</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-indigo-400 animate-pulse">LIVE</span>
                            <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 font-black">{captureEvents.length}</Badge>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/40">
                        {captureEvents.map(event => (
                            <EventDetailsDialog key={event.id} event={event}>
                                <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 group cursor-pointer shadow-lg hover:border-indigo-500/50 transition-all duration-500">
                                    <Image
                                        src={event.plateImagePath || event.snapshotPath || event.user?.cara || "/placeholder-camera.jpg"}
                                        alt="Access Capture"
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        priority={events.indexOf(event) < 3}
                                        className="object-cover group-hover:scale-110 transition-transform duration-1000"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col w-fit">
                                                {/* Mercosur-style plate look */}
                                                <div className="flex flex-col bg-white border-2 border-neutral-800 rounded-sm overflow-hidden shadow-2xl drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] min-w-[100px]">
                                                    <div className="h-1 bg-blue-600 w-full" />
                                                    <p className="text-[16px] font-black text-black tracking-[0.2em] uppercase px-3 py-0.5 text-center font-mono">
                                                        {event.accessType === "PLATE" ? event.plateDetected : event.user?.name}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-[0.2em] mt-1 drop-shadow-lg">
                                                {event.device?.name} • {new Date(event.timestamp).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <div className={cn(
                                            "w-6 h-6 flex items-center justify-center rounded-lg shadow-2xl",
                                            event.decision === "GRANT" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                                        )}>
                                            {event.decision === "GRANT" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                        </div>
                                    </div>

                                    {/* Direction indicator on capture - Larger with icon */}
                                    <div className="absolute top-3 right-3">
                                        <Badge className={cn(
                                            "text-[9px] font-black px-3 py-1.5 border-none shadow-2xl flex items-center gap-2",
                                            event.direction === 'ENTRY' ? "bg-indigo-600/90" : "bg-orange-600/90"
                                        )}>
                                            {event.direction === 'ENTRY' ? (
                                                <>
                                                    <LogIn size={12} />
                                                    <span>ENTRADA</span>
                                                </>
                                            ) : (
                                                <>
                                                    <LogOut size={12} />
                                                    <span>SALIDA</span>
                                                </>
                                            )}
                                        </Badge>
                                    </div>

                                    {/* Brand & Color Overlay - Together in the top-left corner */}
                                    {event.accessType === 'PLATE' && event.details && (() => {
                                        const marca = event.details.split(',').find(p => p.trim().startsWith('Marca:'))?.split(':')[1]?.trim();
                                        const color = event.details.split(',').find(p => p.trim().startsWith('Color:'))?.split(':')[1]?.trim();
                                        const logoUrl = getCarLogo(marca);
                                        return (
                                            <div className="absolute top-3 left-3 flex flex-col gap-2 z-20">
                                                {logoUrl && (
                                                    <div className="bg-white rounded-lg p-2 border border-white/10 shadow-2xl flex items-center justify-center w-[44px] h-[44px]">
                                                        <div className="relative w-7 h-7 flex items-center justify-center">
                                                            <Image
                                                                src={logoUrl}
                                                                alt={marca || "Logo"}
                                                                fill
                                                                sizes="28px"
                                                                className="object-contain"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                {color && (
                                                    <div
                                                        className="px-2 py-1 rounded-lg border border-white/10 shadow-xl flex items-center justify-center text-center min-w-[44px]"
                                                        style={{
                                                            backgroundColor: color.toLowerCase() === 'blanco' ? '#ffffff' :
                                                                color.toLowerCase() === 'negro' ? '#111111' :
                                                                    color.toLowerCase() === 'plata' || color.toLowerCase() === 'plateado' ? '#C0C0C0' :
                                                                        color.toLowerCase() === 'gray' || color.toLowerCase() === 'gris' || color.toLowerCase() === 'plata' ? '#808080' : color,
                                                            color: (color.toLowerCase() === 'blanco' || color.toLowerCase() === 'plata' || color.toLowerCase() === 'plateado') ? '#000' : '#fff'
                                                        }}
                                                    >
                                                        <span className="text-[8px] font-black uppercase tracking-tighter drop-shadow-sm line-clamp-1">{color}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </EventDetailsDialog>
                        ))}
                        {captureEvents.length === 0 && <div className="p-10 text-center text-neutral-600 font-bold text-[10px] uppercase tracking-widest mt-20">Esperando flujos...</div>}
                    </div>
                </div>

                {/* COLUMN 3: SALIDAS */}
                <div className="flex flex-col h-full bg-neutral-900/40 border border-white/5 rounded-xl overflow-hidden shadow-2xl">
                    <div className="p-5 border-b border-orange-500/20 bg-orange-500/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-600 font-black text-white flex items-center justify-center text-xs shadow-lg shadow-orange-900/40 italic">OUT</div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-tighter">Salidas</h3>
                                    <p className="text-[9px] text-orange-400 font-bold uppercase tracking-widest">Flujo de Egreso</p>
                                </div>
                            </div>
                            <Badge className="bg-orange-600 text-white font-black text-[10px]">{exitEvents.length}</Badge>
                        </div>

                        {/* Iconic Filter Strip */}
                        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
                            <Filter size={11} className="text-neutral-600 shrink-0 mx-1" />
                            <div className="flex-1 flex justify-center gap-1 border-x border-white/5 px-2">
                                {(["ALL", "GRANT", "DENY"] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setActiveFilter(f)}
                                        className={cn(
                                            "w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                                            activeFilter === f
                                                ? (f === 'GRANT' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/40' : f === 'DENY' ? 'bg-red-500 text-white shadow-lg shadow-red-900/40' : 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/40')
                                                : "text-neutral-600 hover:text-neutral-400 hover:bg-white/5"
                                        )}
                                        title={f === 'ALL' ? 'Todos' : f === 'GRANT' ? 'Autorizados' : 'Denegados'}
                                    >
                                        {f === 'ALL' ? <Activity size={12} /> : f === 'GRANT' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1 pr-1">
                                {(["ALL", "PLATE", "FACE", "TAG"] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setActiveType(t)}
                                        className={cn(
                                            "w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                                            activeType === t
                                                ? "bg-white/10 text-orange-400 border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.1)]"
                                                : "text-neutral-600 hover:text-neutral-400 hover:bg-white/5"
                                        )}
                                        title={t}
                                    >
                                        {t === 'ALL' ? <Zap size={12} /> : t === 'PLATE' ? <Car size={12} /> : t === 'FACE' ? <UserIcon size={12} /> : <CreditCard size={12} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                        {exitEvents.map(event => <EventItem key={event.id} event={event} />)}
                        {exitEvents.length === 0 && <div className="p-10 text-center text-neutral-600 font-bold text-[10px] uppercase tracking-widest mt-10">No hay salidas recientes</div>}
                    </div>
                </div>

            </div>
        </div>
    );
}
