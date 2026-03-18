"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getAccessEvents } from "@/app/actions/history";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    History,
    Search,
    Filter,
    Calendar as CalendarIcon,
    User as UserIcon,
    HardDrive,
    ArrowRightCircle,
    ArrowLeftCircle,
    Download,
    Camera,
    Loader2,
    Clock,
    Car,
    CreditCard,
    Building2,
    ArrowUpRight,
    ArrowDownLeft,
    Phone,
    MapPin,
    CheckCircle2,
    XCircle,
    X,
    MoreHorizontal,
    TrendingUp,
    ShieldAlert,
    Activity,
    Fingerprint,
    ScanFace,
    BadgeAlert,
    Cpu,
    Wifi
} from "lucide-react";
import { AccessEvent, User, Device } from "@prisma/client";
import Image from "next/image";
import { EventDetailsDialog } from "@/components/dashboard/EventDetailsDialog";
import { cn } from "@/lib/utils";
import { getCarLogo } from "@/lib/car-logos";
import { getVehicleBrandName } from "@/lib/hikvision-codes";
import { ExportHistoryDialog } from "@/components/history/ExportHistoryDialog";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { getSocketUrl } from "@/lib/socket-config";
import { getImagePath } from "@/lib/image-path";

const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `< 1m`;
};

const MotionTableRow = motion(TableRow);

type FullAccessEvent = any; // Using any to avoid complex Prisma type mismatches with server actions

export default function HistoryPage() {
    const [events, setEvents] = useState<FullAccessEvent[]>([]);
    const [totalEvents, setTotalEvents] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDecision, setFilterDecision] = useState<"ALL" | "GRANT" | "DENY">("ALL");
    const [filterType, setFilterType] = useState<"ALL" | "PLATE" | "FACE" | "TAG">("ALL");
    const [filterDirection, setFilterDirection] = useState<"ALL" | "ENTRY" | "EXIT">("ALL");

    // Advanced Filters
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

    // Pagination State
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const ITEMS_PER_PAGE = 50;

    // Refs for Socket.io to avoid stale closures
    const filtersRef = useRef({ searchTerm, filterDecision, filterType, filterDirection, startDate, endDate, page });
    useEffect(() => {
        filtersRef.current = { searchTerm, filterDecision, filterType, filterDirection, startDate, endDate, page };
    }, [searchTerm, filterDecision, filterType, filterDirection, startDate, endDate, page]);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(0);
            loadData(0, true);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, filterDecision, filterType, filterDirection, startDate, endDate]);

    // Infinite Scroll Observer
    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLTableRowElement) => {
        if (loading || !hasMore) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !loading && hasMore) {
                setPage(prev => {
                    const nextPage = prev + 1;
                    setTimeout(() => loadData(nextPage, false), 0);
                    return nextPage;
                });
            }
        });

        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    async function loadData(pageIndex: number, reset: boolean) {
        setLoading(true);
        try {
            const response = await getAccessEvents({
                take: ITEMS_PER_PAGE,
                skip: pageIndex * ITEMS_PER_PAGE,
                search: searchTerm,
                decision: filterDecision,
                type: filterType,
                direction: filterDirection,
                from: startDate ? new Date(startDate) : undefined,
                to: endDate ? new Date(endDate) : undefined
            });

            // @ts-ignore
            const { events: newEvents, total } = response;
            setTotalEvents(total);

            if (reset) {
                setEvents(newEvents);
            } else {
                setEvents(prev => {
                    const existingIds = new Set(prev.map(e => e.id));
                    const uniqueNewEvents = newEvents.filter((e: any) => !existingIds.has(e.id));
                    return [...prev, ...uniqueNewEvents];
                });
            }

            if (newEvents.length < ITEMS_PER_PAGE) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    // Socket.io Integration
    useEffect(() => {
        const socketUrl = getSocketUrl();
        const socket = io(socketUrl, {
            transports: ["websocket", "polling"],
        });

        socket.on("access_event", (event: FullAccessEvent) => {
            const { searchTerm, filterDecision, filterType, filterDirection, startDate, endDate, page } = filtersRef.current;

            const matchesSearch = !searchTerm ||
                (event.plateDetected?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (event.user?.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (event.device?.name?.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesDecision = filterDecision === "ALL" || event.decision === filterDecision;
            const matchesType = filterType === "ALL" || event.accessType === filterType;
            const matchesDirection = filterDirection === "ALL" || event.direction === filterDirection;

            const eventDate = new Date(event.timestamp);
            const matchesStartDate = !startDate || eventDate >= new Date(startDate);
            const matchesEndDate = !endDate || eventDate <= new Date(endDate);

            if (matchesSearch && matchesDecision && matchesType && matchesDirection && matchesStartDate && matchesEndDate) {
                setEvents(prev => {
                    if (prev.find(e => e.id === event.id)) return prev;
                    return [event, ...prev].slice(0, ITEMS_PER_PAGE * (page + 1));
                });
                setTotalEvents(prev => prev + 1);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const getImageUrl = (path: string | null | undefined): string => {
        return getImagePath(path) || "";
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-slate-100 font-sans selection:bg-[#8b5cf6]/30 overflow-x-hidden">
            {/* Main Content Area */}
            <div className="flex flex-col min-w-0">
                {/* Top Header Navigation */}
                <header className="h-20 flex items-center justify-between px-10 border-b border-[#262626] sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-20">
                    <div className="flex items-center gap-8 w-1/2">
                        <div className="relative w-full max-w-md group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#8b5cf6] transition-colors" size={18} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#141414] border-[#262626] rounded-full py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-[#8b5cf6] focus:border-[#8b5cf6] transition-all border outline-none placeholder:text-slate-600"
                                placeholder="Búsqueda global (Patente, Nombre, Terminal)..."
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-[#141414] border border-[#262626] rounded-full px-4 h-10">
                            <CalendarIcon size={14} className="text-slate-500" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent border-none text-[10px] font-bold text-white focus:outline-none w-24 uppercase appearance-none"
                            />
                            <span className="text-slate-600 text-[10px]">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent border-none text-[10px] font-bold text-white focus:outline-none w-24 uppercase appearance-none"
                            />
                        </div>
                        <button
                            onClick={() => setIsExportDialogOpen(true)}
                            className="flex items-center gap-2 px-6 h-10 bg-[#8b5cf6] text-white rounded-full text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-[#8b5cf6]/20 active:scale-95"
                        >
                            <Download size={18} />
                            <span>Exportar Logs</span>
                        </button>
                    </div>
                </header>

                <div className="p-10 flex flex-col gap-10">
                    {/* Key Metrics Hero Section */}
                    <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="col-span-1 flex flex-col gap-1">
                            <h2 className="text-5xl font-black tracking-tighter text-white">
                                {totalEvents.toLocaleString()}
                            </h2>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Total Autorizaciones</p>
                            <div className="flex items-center gap-2 text-[#8b5cf6] text-[10px] font-bold mt-2">
                                <TrendingUp size={14} />
                                <span>Monitoreo en tiempo real activo</span>
                            </div>
                        </div>
                        <div className="col-span-1 flex flex-col gap-1">
                            <h2 className="text-5xl font-black tracking-tighter text-white">0.02<span className="text-[#8b5cf6]">s</span></h2>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Latencia Media</p>
                            <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-bold mt-2">
                                <CheckCircle2 size={14} />
                                <span>Rendimiento Óptimo</span>
                            </div>
                        </div>
                        <div className="col-span-1 flex flex-col gap-1">
                            <h2 className="text-5xl font-black tracking-tighter text-white">0</h2>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Alertas Activas</p>
                            <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-bold mt-2">
                                <ShieldAlert size={14} />
                                <span>Sin amenazas detectadas</span>
                            </div>
                        </div>
                        <div className="col-span-1 flex flex-col gap-1">
                            <h2 className="text-5xl font-black tracking-tighter text-white">99.9%</h2>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Uptime del Sistema</p>
                            <div className="flex items-center gap-2 text-[#8b5cf6] text-[10px] font-bold mt-2">
                                <Wifi size={14} />
                                <span>Nodos sincronizados</span>
                            </div>
                        </div>
                    </section>

                    {/* Access History Table */}
                    <section className="flex flex-col gap-6">
                        <div className="flex items-center justify-between border-b border-[#262626] pb-4">
                            <div className="flex gap-8">
                                <button
                                    onClick={() => setFilterType("ALL")}
                                    className={cn(
                                        "text-sm font-black transition-all pb-4 border-b-2 uppercase tracking-tighter",
                                        filterType === "ALL" ? "border-[#8b5cf6] text-white" : "border-transparent text-slate-500 hover:text-white"
                                    )}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setFilterType("PLATE")}
                                    className={cn(
                                        "text-sm font-black transition-all pb-4 border-b-2 uppercase tracking-tighter",
                                        filterType === "PLATE" ? "border-[#8b5cf6] text-white" : "border-transparent text-slate-500 hover:text-white"
                                    )}
                                >
                                    LPR
                                </button>
                                <button
                                    onClick={() => setFilterType("FACE")}
                                    className={cn(
                                        "text-sm font-black transition-all pb-4 border-b-2 uppercase tracking-tighter",
                                        filterType === "FACE" ? "border-[#8b5cf6] text-white" : "border-transparent text-slate-500 hover:text-white"
                                    )}
                                >
                                    Rostros
                                </button>
                                <button
                                    onClick={() => setFilterType("TAG")}
                                    className={cn(
                                        "text-sm font-black transition-all pb-4 border-b-2 uppercase tracking-tighter",
                                        filterType === "TAG" ? "border-[#8b5cf6] text-white" : "border-transparent text-slate-500 hover:text-white"
                                    )}
                                >
                                    TAG/RFID
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Streaming Live Updates</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-slate-500 text-[10px] uppercase tracking-widest border-b border-[#262626]">
                                        <th className="py-4 font-bold">Timestamp</th>
                                        <th className="py-4 font-bold">Identidad</th>
                                        <th className="py-4 font-bold">Tipo de Evento</th>
                                        <th className="py-4 font-bold">Ubicación</th>
                                        <th className="py-4 font-bold">Estado</th>
                                        <th className="py-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#262626]/50">
                                    {events.length === 0 && !loading ? (
                                        <tr>
                                            <td colSpan={6} className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-20">
                                                    <History size={64} />
                                                    <p className="text-xl font-black uppercase tracking-tighter">Sin registros</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        events.map((evt, index) => {
                                            const isLast = index === events.length - 1;
                                            const isAuthorized = evt.decision === "GRANT";
                                            const details: any = {};
                                            if (evt.details) {
                                                evt.details.split(',').forEach((p: string) => {
                                                    const [k, v] = p.split(':').map((s: string) => s.trim());
                                                    if (k && v) details[k] = v;
                                                });
                                            }

                                            let brandName = details.Marca || "";
                                            if (brandName.startsWith("Brand ")) {
                                                brandName = getVehicleBrandName(brandName.replace("Brand ", ""));
                                            }

                                            return (
                                                <MotionTableRow
                                                    key={evt.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.02, duration: 0.3 }}
                                                    ref={isLast ? lastElementRef : null}
                                                    className="group hover:bg-[#141414]/50 transition-colors cursor-pointer"
                                                >
                                                    <td className="py-5">
                                                        <EventDetailsDialog event={evt}>
                                                            <div>
                                                                <p className="text-sm font-medium text-white">
                                                                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                </p>
                                                                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                                                                    {new Date(evt.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                </p>
                                                            </div>
                                                        </EventDetailsDialog>
                                                    </td>
                                                    <td className="py-5">
                                                        <EventDetailsDialog event={evt}>
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-lg bg-[#141414] border border-[#262626] flex items-center justify-center overflow-hidden shrink-0 group-hover:border-[#8b5cf6]/30 transition-colors">
                                                                    {(() => {
                                                                        const src = getImageUrl(evt.snapshotPath || evt.imagePath) || (evt.accessType !== 'PLATE' ? getImageUrl(evt.user?.cara) : "");
                                                                        if (src) {
                                                                            return <Image src={src} alt="Snapshot" width={40} height={40} className="w-full h-full object-cover" />;
                                                                        }
                                                                        return <Camera size={16} className="text-slate-700" />;
                                                                    })()}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-bold text-white uppercase tracking-tight">
                                                                            {evt.user?.name || (evt.accessType === 'PLATE' ? (evt.plateDetected || "S/M") : "Desconocido")}
                                                                        </p>
                                                                        {evt.accessType === 'PLATE' && evt.plateDetected && !evt.user?.name && (
                                                                            <span className="bg-white text-black text-[9px] font-black px-1.5 py-0.5 rounded-sm font-mono border-b-2 border-blue-600">
                                                                                {evt.plateDetected}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                                                        {evt.user?.unit?.name || (brandName ? brandName : "Visitante / Externo")}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </EventDetailsDialog>
                                                    </td>
                                                    <td className="py-5">
                                                        <EventDetailsDialog event={evt}>
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1.5 rounded-md bg-[#8b5cf6]/10 text-[#8b5cf6]">
                                                                    {evt.accessType === 'PLATE' ? <Car size={16} /> :
                                                                     evt.accessType === 'FACE' ? <ScanFace size={16} /> :
                                                                     <CreditCard size={16} />}
                                                                </div>
                                                                <span className="text-xs font-semibold uppercase tracking-tight text-slate-200">
                                                                    {evt.accessType === 'PLATE' ? 'LPR Scan' :
                                                                     evt.accessType === 'FACE' ? 'Facial' : 'TAG/RFID'}
                                                                </span>
                                                            </div>
                                                        </EventDetailsDialog>
                                                    </td>
                                                    <td className="py-5">
                                                        <EventDetailsDialog event={evt}>
                                                            <div className="flex flex-col gap-1">
                                                                <p className="text-xs text-slate-300 font-medium">
                                                                    {evt.device?.name || "Terminal 01"}
                                                                </p>
                                                                <div className={cn(
                                                                    "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest",
                                                                    evt.direction === 'ENTRY' ? "text-emerald-400" : "text-orange-400"
                                                                )}>
                                                                    {evt.direction === 'ENTRY' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                                                                    {evt.direction === 'ENTRY' ? 'ENTRADA' : 'SALIDA'}
                                                                </div>
                                                            </div>
                                                        </EventDetailsDialog>
                                                    </td>
                                                    <td className="py-5">
                                                        <EventDetailsDialog event={evt}>
                                                            <span className={cn(
                                                                "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border transition-all",
                                                                isAuthorized
                                                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 group-hover:bg-emerald-500/20"
                                                                    : "bg-rose-500/10 text-rose-500 border-rose-500/20 group-hover:bg-rose-500/20"
                                                            )}>
                                                                {isAuthorized ? 'Autorizado' : 'Denegado'}
                                                            </span>
                                                        </EventDetailsDialog>
                                                    </td>
                                                    <td className="py-5 text-right">
                                                        <EventDetailsDialog event={evt}>
                                                            <button className="text-slate-500 hover:text-[#8b5cf6] transition-colors p-2 rounded-lg hover:bg-[#8b5cf6]/10 active:scale-95">
                                                                <MoreHorizontal size={20} />
                                                            </button>
                                                        </EventDetailsDialog>
                                                    </td>
                                                </MotionTableRow>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination / Status */}
                        <div className="flex items-center justify-between pt-6 border-t border-[#262626]">
                            <p className="text-xs text-slate-500 font-medium">
                                Mostrando <span className="text-white font-bold">{events.length}</span> de <span className="text-white font-bold">{totalEvents.toLocaleString()}</span> entradas
                            </p>
                            <div className="flex gap-2">
                                {loading && (
                                    <div className="flex items-center gap-2 text-[#8b5cf6] font-bold text-[10px] uppercase tracking-widest mr-4">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Cargando más...</span>
                                    </div>
                                )}
                                <div className="flex gap-1.5">
                                    <button className="w-9 h-9 rounded-lg border border-[#262626] flex items-center justify-center text-slate-500 hover:text-white hover:border-[#8b5cf6] transition-all bg-[#141414]">
                                        <ArrowLeftCircle size={18} />
                                    </button>
                                    <button className="w-9 h-9 rounded-lg bg-[#8b5cf6] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-[#8b5cf6]/20">1</button>
                                    <button className="w-9 h-9 rounded-lg border border-[#262626] flex items-center justify-center text-slate-500 hover:text-white transition-all text-xs font-bold bg-[#141414]">2</button>
                                    <button className="w-9 h-9 rounded-lg border border-[#262626] flex items-center justify-center text-slate-500 hover:text-white hover:border-[#8b5cf6] transition-all bg-[#141414]">
                                        <ArrowRightCircle size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>


            <ExportHistoryDialog
                open={isExportDialogOpen}
                onOpenChange={setIsExportDialogOpen}
                filters={{
                    search: searchTerm,
                    decision: filterDecision,
                    type: filterType,
                    direction: filterDirection
                }}
            />

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #0a0a0a;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #262626;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #8b5cf6;
                }
            `}</style>
        </div>
    );
}
