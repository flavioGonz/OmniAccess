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
    Building2
} from "lucide-react";
import { AccessEvent, User, Unit, Device } from "@prisma/client";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { EventDetailsDialog } from "@/components/dashboard/EventDetailsDialog";
import { cn } from "@/lib/utils";
import { getCarLogo } from "@/lib/car-logos";

type FullAccessEvent = AccessEvent & {
    user: (User & { unit: Unit | null, cara?: string | null }) | null;
    device: Device | null;
};

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
    const [unitFilter, setUnitFilter] = useState("");

    // Pagination State
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const ITEMS_PER_PAGE = 50;

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(0);
            loadData(0, true);
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [searchTerm, filterDecision, filterType, filterDirection, startDate, endDate, unitFilter]);

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
    /* 
        Nota: Usar setTimeout(..., 0) saca la ejecución de loadData del ciclo de renderizado 
        y previene el error 'Cannot update a component while rendering'.
    */

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
                unit: unitFilter,
                from: startDate ? new Date(startDate) : undefined,
                to: endDate ? new Date(endDate) : undefined
            });

            // @ts-ignore
            const { events: newEvents, total } = response;
            setTotalEvents(total);

            // @ts-ignore
            if (reset) {
                // @ts-ignore
                setEvents(newEvents);
            } else {
                // @ts-ignore
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

    const handleDownload = () => {
        const headers = ["ID", "Fecha", "Hora", "Patente", "Sujeto", "Lote", "Dispositivo", "Sentido", "Decisión"];
        const rows = events.map(e => [
            e.id,
            new Date(e.timestamp).toLocaleDateString(),
            new Date(e.timestamp).toLocaleTimeString(),
            e.plateDetected || "-------",
            e.user?.name || "Desconocido",
            e.user?.unit?.name || "Externo",
            e.device?.name || "Nodo LPR",
            e.device?.direction === "ENTRY" ? "Entrada" : "Salida",
            e.decision === "GRANT" ? "PERMITIDO" : "DENEGADO"
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `historial_accesos_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-700 h-full flex flex-col overflow-hidden">
            {/* Header Section - Blended with background */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 shadow-inner group transition-all hover:scale-110">
                        <History size={32} className="text-red-400 group-hover:rotate-[-45deg] transition-transform duration-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-rose-400 to-orange-400 uppercase tracking-tight">
                            Historial Maestro
                        </h1>
                        <p className="text-sm text-neutral-500 font-medium">
                            Eventos Procesados <span className="text-white font-bold">({totalEvents})</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {/* Date Filters */}
                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                        <div className="flex items-center gap-1.5 px-3">
                            <CalendarIcon size={14} className="text-neutral-500" />
                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Periodo</span>
                        </div>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-[11px] font-bold text-white focus:outline-none w-28 uppercase"
                        />
                        <span className="text-neutral-600 text-[11px]">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-[11px] font-bold text-white focus:outline-none w-28 uppercase"
                        />
                    </div>

                    {/* Unit/Lot Filter */}
                    <div className="relative">
                        <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <Input
                            placeholder="Lote / Unidad..."
                            value={unitFilter}
                            onChange={(e) => setUnitFilter(e.target.value)}
                            className="pl-9 bg-white/5 border-white/10 h-11 w-40 rounded-xl focus:ring-red-500/20 transition-all font-medium text-[11px] text-white uppercase"
                        />
                    </div>

                    {/* Search Input */}
                    <div className="relative lg:w-48">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                        <Input
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-white/5 border-white/10 h-11 rounded-xl focus:ring-red-500/20 transition-all font-medium text-[11px] text-white"
                        />
                    </div>

                    {/* Filter Type Group */}
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                        <button
                            onClick={() => setFilterType("ALL")}
                            className={cn(
                                "px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all",
                                filterType === "ALL" ? "bg-white/10 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300"
                            )}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterType("PLATE")}
                            className={cn(
                                "px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1.5",
                                filterType === "PLATE" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "text-neutral-500 hover:text-neutral-300"
                            )}
                        >
                            <Car size={10} />
                            LPR
                        </button>
                        <button
                            onClick={() => setFilterType("FACE")}
                            className={cn(
                                "px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1.5",
                                filterType === "FACE" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-neutral-500 hover:text-neutral-300"
                            )}
                        >
                            <UserIcon size={10} />
                            Facial
                        </button>
                    </div>

                    <button
                        onClick={handleDownload}
                        className="h-11 w-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white transition-all active:scale-90 shadow-lg"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </header>

            {/* Content Table Area - Transparent and fused with background */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <div className="h-full overflow-y-auto custom-scrollbar border-t border-white/5">
                    <Table>
                        <TableHeader className="bg-transparent sticky top-0 z-10 backdrop-blur-md border-b border-white/10">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="text-neutral-500 font-black tracking-widest py-6 px-4 uppercase text-[10px]">Captura & Identificación</TableHead>
                                <TableHead className="text-neutral-500 font-black tracking-widest uppercase text-[10px]">Vehículo / Detalles</TableHead>
                                <TableHead className="text-neutral-500 font-black tracking-widest uppercase text-[10px]">Sujeto & Unidad</TableHead>
                                <TableHead className="text-neutral-500 font-black tracking-widest uppercase text-[10px]">Punto de Acceso</TableHead>
                                <TableHead className="text-neutral-500 font-black tracking-widest uppercase text-[10px]">Tiempo</TableHead>
                                <TableHead className="text-right text-neutral-500 font-black tracking-widest pr-4 uppercase text-[10px]">Resultado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.length === 0 && !loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-40 text-neutral-700">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="p-8 bg-neutral-900 rounded-full border border-dashed border-neutral-800">
                                                <History size={64} className="opacity-10" />
                                            </div>
                                            <p className="text-xl font-bold uppercase tracking-tight">No hay registros que coincidan</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                events.map((evt, index) => {
                                    const isLast = index === events.length - 1;
                                    const details: any = {};
                                    if (evt.details) {
                                        evt.details.split(',').forEach(p => {
                                            const [k, v] = p.split(':').map(s => s.trim());
                                            if (k && v) details[k] = v;
                                        });
                                    }
                                    const logoUrl = getCarLogo(details.Marca);

                                    return (
                                        <EventDetailsDialog key={evt.id} event={evt}>
                                            <TableRow
                                                ref={isLast ? lastElementRef : null}
                                                className="border-white/5 hover:bg-white/[0.03] transition-all cursor-pointer group"
                                            >
                                                {/* Identification Section */}
                                                <TableCell className="py-4 px-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative w-16 h-10 rounded-lg overflow-hidden border border-white/10 bg-black shrink-0 shadow-2xl group-hover:border-blue-500/30 transition-all group-hover:scale-105 duration-500 text-white">
                                                            {(evt.snapshotPath || evt.user?.cara) ? (
                                                                <Image src={evt.snapshotPath || evt.user?.cara || ""} alt="Snapshot" fill sizes="64px" className="object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                                                                    <Camera size={16} className="text-neutral-700" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col gap-1">
                                                            {evt.accessType === "PLATE" ? (
                                                                <div className="flex flex-col bg-white border border-neutral-800 rounded-sm overflow-hidden min-w-[90px]">
                                                                    <div className="h-0.5 bg-blue-600 w-full" />
                                                                    <p className="text-[13px] font-black text-black tracking-widest uppercase px-2 py-0.5 text-center font-mono leading-none">
                                                                        {evt.plateDetected || "-------"}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <p className="font-mono text-sm font-black text-white tracking-widest uppercase">
                                                                    {evt.plateDetected || "-------"}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Vehicle Details */}
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-white rounded-lg border border-white/10 p-1 flex items-center justify-center shrink-0">
                                                            {logoUrl ? (
                                                                <div className="relative w-full h-full">
                                                                    <Image src={logoUrl} alt="Logo" fill sizes="40px" className="object-contain" />
                                                                </div>
                                                            ) : (
                                                                <Car size={18} className="text-neutral-300" />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <p className="font-black text-white text-xs uppercase tracking-tight">
                                                                {details.Marca || "Desconocido"}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {details.Color && (
                                                                    <div
                                                                        className="w-2 h-2 rounded-full border border-white/20"
                                                                        style={{ backgroundColor: details.Color.toLowerCase() === 'blanco' ? '#fff' : details.Color.toLowerCase() === 'negro' ? '#000' : details.Color }}
                                                                    />
                                                                )}
                                                                <span className="text-[10px] text-neutral-500 font-bold uppercase">
                                                                    {details.Color || '---'} • {details.Tipo || 'Vehículo'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* User Section */}
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                                            {evt.user?.cara ? (
                                                                <div className="relative w-full h-full rounded-full overflow-hidden">
                                                                    <Image src={evt.user.cara} alt="U" fill sizes="32px" className="object-cover" />
                                                                </div>
                                                            ) : (
                                                                <UserIcon size={14} className="text-neutral-600" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white uppercase text-xs tracking-tight">
                                                                {evt.user?.name || "Externo / Desconocido"}
                                                            </p>
                                                            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest mt-0.5">
                                                                {evt.user?.unit?.name || "Sin Unidad"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Access Point */}
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-neutral-300 uppercase tracking-tighter truncate max-w-[140px]">
                                                            {evt.device?.name || "Nodo LPR"}
                                                        </p>
                                                        <div className={cn(
                                                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-widest",
                                                            evt.device?.direction === 'ENTRY'
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                                        )}>
                                                            {evt.device?.direction === 'ENTRY' ? "ENTRADA" : "SALIDA"}
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Timestamp Section */}
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-white font-mono">
                                                            {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </span>
                                                        <p className="text-[9px] text-neutral-500 font-bold tracking-widest uppercase mt-0.5">
                                                            {new Date(evt.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                                        </p>
                                                    </div>
                                                </TableCell>

                                                {/* Result Status */}
                                                <TableCell className="text-right pr-4">
                                                    <div className={cn(
                                                        "inline-block w-24 py-1.5 rounded-lg font-black text-[10px] uppercase text-center tracking-tighter shadow-lg",
                                                        evt.decision === "GRANT"
                                                            ? "bg-emerald-600 text-white shadow-emerald-900/40 border border-emerald-500/30"
                                                            : "bg-red-600 text-white shadow-red-900/40 border border-red-500/30"
                                                    )}>
                                                        {evt.decision === "GRANT" ? "PERMITIDO" : "DENEGADO"}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        </EventDetailsDialog>
                                    );
                                })
                            )}
                            {loading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-6">
                                        <Loader2 className="mx-auto animate-spin text-neutral-500" />
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #262626;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
