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
    LogOut,
    Truck,
    Bus,
    Bike
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EventDetailsDialog } from "@/components/dashboard/EventDetailsDialog";
import Image from "next/image";
import { AccessEvent, Device, Unit } from "@prisma/client";
import { getCarLogo } from "@/lib/car-logos";

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

    const plateCountsToday = useMemo(() => {
        const counts: Record<string, number> = {};
        events.forEach(e => {
            const key = e.plateDetected && e.plateDetected !== 'unknown' && e.plateDetected !== 'NO_LEIDA' ? e.plateDetected : (e.user?.id || 'sys');
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }, [events]);

    const calculateDuration = (currentEvent: FullAccessEvent) => {
        const plate = currentEvent.plateDetected;
        if (!plate || plate === 'unknown' || plate === 'NO_LEIDA') return null;

        const currentIndex = events.findIndex(e => e.id === currentEvent.id);
        if (currentIndex === -1) return null;

        const previousEvent = events.slice(currentIndex + 1).find(e =>
            e.plateDetected === plate &&
            e.direction !== currentEvent.direction // Ensure it's the opposite movement for accurate inside/outside
        );

        if (!previousEvent) return null;

        const ms = Math.abs(new Date(currentEvent.timestamp).getTime() - new Date(previousEvent.timestamp).getTime());
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        let duration = "";
        if (days > 0) duration = `${days}d ${hours % 24}h`;
        else if (hours > 0) duration = `${hours}h ${minutes % 60}m`;
        else if (minutes > 0) duration = `${minutes}m ${seconds % 60}s`;
        else duration = `${seconds}s`;

        return {
            label: currentEvent.direction === 'EXIT' ? 'DENTRO' : 'FUERA',
            value: duration,
            color: currentEvent.direction === 'EXIT' ? 'text-indigo-400' : 'text-orange-400'
        };
    };

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
        const plateKey = event.plateDetected && event.plateDetected !== 'unknown' && event.plateDetected !== 'NO_LEIDA' ? event.plateDetected : (event.user?.id || 'sys');
        const plateCount = plateCountsToday[plateKey] || 0;

        return (
            <EventDetailsDialog event={event}>
                <div className="p-4 hover:bg-white/5 cursor-pointer transition-all group border-b border-white/5 last:border-0 border-l-2 border-l-transparent hover:border-l-indigo-500">
                    <div className="flex items-center gap-3">
                        {/* LEFT: LOGO/ICON */}
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

                        {/* CENTER: PRIMARY DATA */}
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
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest truncate italic">
                                        {event.accessType === 'PLATE' ? (
                                            `${meta.Marca || ''} ${meta.Modelo || ''} ${meta.Tipo ? `• ${meta.Tipo}` : ''}`.trim() || 'Vehículo Detectado'
                                        ) : (
                                            event.user?.unit?.name || 'Acceso Manual'
                                        )}
                                    </p>
                                    {meta.Color && (
                                        <div className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: meta.Color.toLowerCase() === 'blanco' ? '#fff' : meta.Color.toLowerCase() === 'negro' ? '#000' : meta.Color }} />
                                    )}
                                </div>
                                {event.user?.name && event.accessType === "PLATE" && (
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-0.5">
                                        {event.user.name}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: DECISION & TIME */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-center gap-2">
                                {plateCount > 1 && event.plateDetected !== "NO_LEIDA" && event.plateDetected !== "unknown" && (
                                    <Badge className="bg-white/5 text-neutral-400 border-white/10 text-[9px] font-black px-1.5 h-5 flex items-center justify-center">
                                        {plateCount}x Hoy
                                    </Badge>
                                )}
                                <div className={cn(
                                    "w-24 py-1.5 rounded-lg font-black text-[10px] uppercase text-center tracking-tighter shadow-lg",
                                    event.decision === "GRANT"
                                        ? "bg-emerald-600 text-white shadow-emerald-900/40 border border-emerald-500/30"
                                        : "bg-red-600 text-white shadow-red-900/40 border border-red-500/30"
                                )}>
                                    {event.decision === "GRANT" ? "PERMITIDO" : "DENEGADO"}
                                </div>
                            </div>
                            <span className="text-[10px] font-mono text-neutral-500 font-bold">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        </div>
                    </div>
                </div>
            </EventDetailsDialog>
        );
    };

    const entryEvents = filteredEvents.filter(e => e.direction === 'ENTRY');
    const exitEvents = filteredEvents.filter(e => e.direction === 'EXIT');
    const captureEvents = filteredEvents.filter(e => e.imagePath || e.snapshotPath || e.user?.cara);

    return (
        <div className="h-full p-6 overflow-hidden animate-in fade-in duration-700">
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
                                            activeType === t ? "bg-white/10 text-indigo-400 border border-indigo-500/30" : "text-neutral-600 hover:text-neutral-400 hover:bg-white/5"
                                        )}
                                    >
                                        {t === 'ALL' ? <Zap size={12} /> : t === 'PLATE' ? <Car size={12} /> : t === 'FACE' ? <UserIcon size={12} /> : <CreditCard size={12} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                        {entryEvents.map(event => <EventItem key={event.id} event={event} />)}
                    </div>
                </div>

                {/* COLUMN 2: CAPTURAS */}
                <div className="flex flex-col h-full bg-neutral-900/60 border border-indigo-500/20 rounded-xl overflow-hidden shadow-xl scale-[1.02] z-10">
                    <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg"><Camera className="text-indigo-400" size={18} /></div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-tighter">Últimas Capturas</h3>
                                <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Evidencia Visual</p>
                            </div>
                        </div>
                        <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 font-black">{captureEvents.length}</Badge>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/40">
                        {captureEvents.map(event => {
                            const marca = event.details?.split(',').find(p => p.trim().startsWith('Marca:'))?.split(':')[1]?.trim();
                            const color = event.details?.split(',').find(p => p.trim().startsWith('Color:'))?.split(':')[1]?.trim();
                            let tipo = event.details?.split(',').find(p => p.trim().startsWith('Tipo:'))?.split(':')[1]?.trim()?.toUpperCase();
                            if (tipo === 'VEHICLE' || tipo === 'CAR') tipo = 'AUTO';
                            if (tipo === 'PICKUPTRUCK') tipo = 'PICKUP';

                            const logoUrl = getCarLogo(marca);
                            const getVehicleIcon = (t: string | undefined) => {
                                if (!t) return <Car size={14} />;
                                if (t.includes('VAN')) return <Bus size={14} />;
                                if (t.includes('TRUCK')) return <Truck size={14} />;
                                if (t.includes('BUS')) return <Bus size={14} />;
                                if (t.includes('MOTO')) return <Bike size={14} />;
                                return <Car size={14} />;
                            };

                            return (
                                <EventDetailsDialog key={event.id} event={event}>
                                    <div className={cn(
                                        "relative aspect-video rounded-2xl overflow-hidden border group cursor-pointer shadow-lg transition-all duration-500",
                                        event.decision === "GRANT" ? "border-emerald-500/30 shadow-emerald-900/20" : "border-red-500/30 shadow-red-900/20"
                                    )}>
                                        <Image
                                            src={event.imagePath || event.snapshotPath || event.user?.cara || "/placeholder-camera.jpg"}
                                            alt="Capture"
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-700"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                                        {/* Decision Overlay */}
                                        <div className="absolute bottom-3 right-3">
                                            <div className={cn(
                                                "min-w-[40px] h-10 flex flex-col items-center justify-center rounded-xl shadow-2xl backdrop-blur-md border",
                                                event.decision === "GRANT" ? "bg-emerald-500/80 border-emerald-400 text-white" : "bg-red-500/80 border-red-400 text-white"
                                            )}>
                                                {event.decision === "GRANT" ? <CheckCircle2 size={18} strokeWidth={3} /> : <XCircle size={18} strokeWidth={3} />}
                                                <span className="text-[7px] font-black mt-0.5">{event.decision === "GRANT" ? "AUT" : "DEN"}</span>
                                            </div>
                                        </div>

                                        {/* Plate Overlay */}
                                        <div className="absolute bottom-3 left-3 flex flex-col items-start">
                                            {(() => {
                                                const duration = calculateDuration(event);
                                                if (!duration) return null;
                                                return (
                                                    <div className="flex items-center gap-1.5 mb-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                                                        <Clock size={8} className={duration.color} />
                                                        <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">{duration.label}:</span>
                                                        <span className={cn("text-[8px] font-black uppercase tracking-tight", duration.color)}>{duration.value}</span>
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex flex-col bg-white border-2 border-neutral-800 rounded-sm overflow-hidden shadow-2xl min-w-[100px]">
                                                <div className="h-1 bg-blue-600 w-full" />
                                                <p className="text-[16px] font-black text-black tracking-[0.2em] uppercase px-3 py-0.5 text-center font-mono">
                                                    {event.accessType === "PLATE" ? (event.plateDetected === "NO_LEIDA" ? "S/P" : event.plateDetected) : event.user?.name}
                                                </p>
                                            </div>
                                            <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-[0.2em] mt-1 drop-shadow-lg">
                                                {event.device?.name} • {new Date(event.timestamp).toLocaleTimeString()}
                                            </p>
                                        </div>

                                        {/* Direction Badge */}
                                        <div className="absolute top-3 right-3">
                                            <Badge className={cn("text-[8px] font-black px-2 py-1 border-none", event.direction === 'ENTRY' ? "bg-indigo-600" : "bg-orange-600")}>
                                                {event.direction === 'ENTRY' ? "ENTRADA" : "SALIDA"}
                                            </Badge>
                                        </div>

                                        {/* Attributes Overlay */}
                                        <div className="absolute top-3 left-3 flex flex-col gap-2">
                                            {logoUrl && (
                                                <div className="bg-white rounded-lg p-1.5 shadow-2xl w-10 h-10 flex items-center justify-center">
                                                    <div className="relative w-7 h-7"><Image src={logoUrl} alt="Logo" fill className="object-contain" /></div>
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-1 items-start pl-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                                {color && (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full border border-white/40" style={{ backgroundColor: color.toLowerCase() === 'blanco' ? '#fff' : color.toLowerCase() === 'negro' ? '#000' : color }} />
                                                        <span className="text-[9px] font-black text-white uppercase tracking-wider">{color}</span>
                                                    </div>
                                                )}
                                                {tipo && (
                                                    <div className="flex items-center gap-1.5 text-white">
                                                        {getVehicleIcon(tipo)}
                                                        <span className="text-[9px] font-black uppercase tracking-wider">{tipo}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </EventDetailsDialog>
                            );
                        })}
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
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                        {exitEvents.map(event => <EventItem key={event.id} event={event} />)}
                    </div>
                </div>

            </div>
        </div>
    );
}
