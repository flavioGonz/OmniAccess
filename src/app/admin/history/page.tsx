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
} from "lucide-react";
import { AccessEvent, User, Unit, Device } from "@prisma/client";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { EventDetailsDialog } from "@/components/dashboard/EventDetailsDialog";
import { cn } from "@/lib/utils";
import { getCarLogo } from "@/lib/car-logos";
import { getVehicleBrandName } from "@/lib/hikvision-codes";
import { ExportHistoryDialog } from "@/components/history/ExportHistoryDialog";

const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `< 1m`;
};

type FullAccessEvent = AccessEvent & {
    user: (User & { unit: { name: string } | null, cara?: string | null }) | null;
    device: Device | null;
    stayDuration?: number | null;
    previousDirection?: string | null;
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
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

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

    // Helper for image URLs
    const getImageUrl = (path: string | null | undefined): string => {
        if (!path) return "";
        if (path.startsWith('http') || path.startsWith('/')) return path;
        return `/api/files/${path}`;
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

                <div className="flex flex-wrap items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/5 shadow-2xl backdrop-blur-xl">
                    {/* Universal Search - Compact */}
                    <div className="relative w-52 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-red-400 transition-colors" size={12} />
                        <Input
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 bg-white/[0.03] border-white/5 h-9 rounded-lg focus:border-red-500/30 transition-all font-medium text-[10px] text-white placeholder:text-neutral-600 focus:ring-0"
                        />
                    </div>

                    {/* Date Filters - Compact */}
                    <div className="flex items-center gap-1 bg-white/[0.03] px-2 rounded-lg border border-white/5 h-9">
                        <CalendarIcon size={11} className="text-neutral-500" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent border-none text-[9px] font-bold text-white focus:outline-none w-20 uppercase appearance-none"
                        />
                        <span className="text-neutral-700 text-[10px]">-</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent border-none text-[9px] font-bold text-white focus:outline-none w-20 uppercase appearance-none"
                        />
                    </div>

                    {/* Filter Type Group - Compact */}
                    <div className="flex bg-white/[0.03] p-0.5 rounded-lg border border-white/5 h-9">
                        <button
                            onClick={() => setFilterType("ALL")}
                            className={cn(
                                "px-2 rounded text-[8px] font-bold uppercase transition-all",
                                filterType === "ALL" ? "bg-white/10 text-white" : "text-neutral-600 hover:text-neutral-300"
                            )}
                        >
                            Todo
                        </button>
                        <button
                            onClick={() => setFilterType("PLATE")}
                            className={cn(
                                "px-2 rounded text-[8px] font-bold uppercase transition-all flex items-center gap-1",
                                filterType === "PLATE" ? "bg-red-500/20 text-red-100" : "text-neutral-600 hover:text-neutral-300"
                            )}
                        >
                            <Car size={10} />
                            LPR
                        </button>
                        <button
                            onClick={() => setFilterType("FACE")}
                            className={cn(
                                "px-2 rounded text-[8px] font-bold uppercase transition-all flex items-center gap-1",
                                filterType === "FACE" ? "bg-emerald-500/20 text-emerald-100" : "text-neutral-600 hover:text-neutral-300"
                            )}
                        >
                            <UserIcon size={10} />
                            Face
                        </button>
                    </div>

                    {/* Filter Decision Group - Compact */}
                    <div className="flex bg-white/[0.03] p-0.5 rounded-lg border border-white/5 h-9">
                        <button
                            onClick={() => setFilterDecision("GRANT")}
                            className={cn(
                                "px-2 rounded text-[8px] font-bold uppercase transition-all flex items-center gap-1",
                                filterDecision === "GRANT" ? "bg-emerald-500/20 text-emerald-100" : "text-neutral-600 hover:text-neutral-300"
                            )}
                        >
                            <CheckCircle2 size={10} />
                            OK
                        </button>
                        <button
                            onClick={() => setFilterDecision("DENY")}
                            className={cn(
                                "px-2 rounded text-[8px] font-bold uppercase transition-all flex items-center gap-1",
                                filterDecision === "DENY" ? "bg-red-500/20 text-red-100" : "text-neutral-600 hover:text-neutral-300"
                            )}
                        >
                            <XCircle size={10} />
                            NO
                        </button>
                    </div>

                    {/* Filter Direction Group - Compact */}
                    <div className="flex bg-white/[0.03] p-0.5 rounded-lg border border-white/5 h-9">
                        <button
                            onClick={() => setFilterDirection("ENTRY")}
                            className={cn(
                                "px-2 rounded text-[8px] font-bold uppercase transition-all flex items-center gap-1",
                                filterDirection === "ENTRY" ? "bg-blue-500/20 text-blue-100" : "text-neutral-600 hover:text-neutral-300"
                            )}
                        >
                            <ArrowDownLeft size={10} />
                            In
                        </button>
                        <button
                            onClick={() => setFilterDirection("EXIT")}
                            className={cn(
                                "px-2 rounded text-[8px] font-bold uppercase transition-all flex items-center gap-1",
                                filterDirection === "EXIT" ? "bg-orange-500/20 text-orange-100" : "text-neutral-600 hover:text-neutral-300"
                            )}
                        >
                            <ArrowUpRight size={10} />
                            Out
                        </button>
                    </div>

                    {/* Clear Filters - Compact */}
                    {(searchTerm || filterType !== "ALL" || filterDecision !== "ALL" || filterDirection !== "ALL" || startDate || endDate) && (
                        <button
                            onClick={() => {
                                setSearchTerm("");
                                setFilterType("ALL");
                                setFilterDecision("ALL");
                                setFilterDirection("ALL");
                                setStartDate("");
                                setEndDate("");
                            }}
                            className="h-9 px-2 flex items-center gap-1 rounded-lg bg-neutral-800 border border-white/5 text-neutral-400 hover:text-white transition-all text-[8px] font-bold uppercase"
                        >
                            <X size={10} />
                        </button>
                    )}

                    {/* Export Button - Compact */}
                    <button
                        onClick={() => setIsExportDialogOpen(true)}
                        title="Exportar Reporte Excel"
                        className="h-9 w-9 flex items-center justify-center rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95 group ml-auto"
                    >
                        <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
                    </button>
                </div>
            </header>

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
                                <TableHead className="text-neutral-500 font-black tracking-widest uppercase text-[10px]">Estado / Tiempo</TableHead>
                                <TableHead className="text-neutral-500 font-black tracking-widest uppercase text-[10px]">Fecha</TableHead>
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

                                    // Retroactive fix for unmapped brands (e.g., "Brand 1123")
                                    let brandName = details.Marca || "Desconocido";
                                    if (brandName.startsWith("Brand ")) {
                                        const code = brandName.replace("Brand ", "");
                                        const mapped = getVehicleBrandName(code);
                                        if (mapped !== brandName) brandName = mapped;
                                    }

                                    const logoUrl = getCarLogo(brandName);
                                    const isCall = evt.plateDetected === 'CALL_START';
                                    const callDest = details['Llamada entrante a'];

                                    return (
                                        <EventDetailsDialog key={evt.id} event={evt}>
                                            <TableRow
                                                ref={isLast ? lastElementRef : null}
                                                className="border-white/5 hover:bg-white/[0.03] transition-all cursor-pointer group"
                                            >
                                                {/* Identification Section */}
                                                <TableCell className="py-3 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative w-12 h-8 rounded overflow-hidden border border-white/10 bg-black shrink-0 shadow-lg group-hover:border-blue-500/30 transition-all text-white">
                                                            {(evt.snapshotPath || evt.user?.cara) ? (
                                                                <Image src={getImageUrl(evt.snapshotPath) || getImageUrl(evt.user?.cara) || ""} alt="Snapshot" fill sizes="48px" className="object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-neutral-900">
                                                                    <Camera size={12} className="text-neutral-700" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-col gap-0.5">
                                                            {evt.accessType === "PLATE" ? (
                                                                <div className="flex flex-col bg-white border border-neutral-800 rounded-sm overflow-hidden min-w-[80px]">
                                                                    <div className="h-0.5 bg-blue-600 w-full" />
                                                                    <p className="text-[11px] font-black text-black tracking-widest uppercase px-1.5 py-0.5 text-center font-mono leading-none">
                                                                        {evt.plateDetected || "-------"}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <p className={cn("font-mono text-xs font-black tracking-widest uppercase", isCall ? "text-blue-400" : "text-white")}>
                                                                    {isCall ? "LLAMADA" : (evt.plateDetected || "-------")}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Vehicle Details - Solo para eventos de tipo PLATE */}
                                                <TableCell>
                                                    {evt.accessType === "PLATE" ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-white rounded border border-white/10 p-1 flex items-center justify-center shrink-0">
                                                                {logoUrl ? (
                                                                    <div className="relative w-full h-full">
                                                                        <Image src={logoUrl} alt="Logo" fill sizes="32px" className="object-contain" />
                                                                    </div>
                                                                ) : (
                                                                    isCall ? <Phone size={14} className="text-blue-400" /> : <Car size={14} className="text-neutral-300" />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <p className="font-black text-white text-[10px] uppercase tracking-tight">
                                                                    {isCall ? "Intercom" : brandName}
                                                                </p>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    {details.Color && (
                                                                        <div
                                                                            className="w-1.5 h-1.5 rounded-full border border-white/20"
                                                                            style={{ backgroundColor: details.Color.toLowerCase() === 'blanco' ? '#fff' : details.Color.toLowerCase() === 'negro' ? '#000' : details.Color }}
                                                                        />
                                                                    )}
                                                                    <span className="text-[9px] text-neutral-500 font-bold uppercase">
                                                                        {(() => {
                                                                            if (isCall) return "Comunicación";
                                                                            let t = details.Tipo || 'Vehículo';
                                                                            if (t.toUpperCase() === 'SUVMPV') t = 'SUV';
                                                                            if (t.toUpperCase() === 'VEHICLE') t = 'AUTO';
                                                                            if (t.toUpperCase() === 'PICKUPTRUCK') t = 'PICKUP';
                                                                            return t;
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center h-full">
                                                            <span className="text-[9px] text-neutral-600 uppercase font-bold">—</span>
                                                        </div>
                                                    )}
                                                </TableCell>

                                                {/* User Section - Mostrar foto del rostro identificado */}
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                                            {evt.user?.cara ? (
                                                                <div className="relative w-full h-full">
                                                                    <Image src={getImageUrl(evt.user.cara)} alt="U" fill sizes="28px" className="object-cover" />
                                                                </div>
                                                            ) : (
                                                                <UserIcon size={12} className="text-neutral-600" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className={cn(
                                                                "font-bold uppercase text-[10px] tracking-tight",
                                                                (evt.user?.name || details.Rostro) ? "text-indigo-400" : "text-neutral-500"
                                                            )}>
                                                                {evt.user?.name || details.Rostro || (isCall && callDest ? `Dest: ${callDest}` : "Externo")}
                                                            </p>
                                                            <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest mt-0.5">
                                                                {evt.user?.unit?.name || (evt.user?.name ? "Residente" : "Sin Unidad")}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>

                                                {/* Access Point */}
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-white/5 rounded-lg border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                                                            {evt.device?.brand === 'HIKVISION' ? (
                                                                <Image src="/logos/hikvision.png" alt="H" width={24} height={24} className="object-contain" />
                                                            ) : evt.device?.brand === 'AKUVOX' ? (
                                                                <Image src="/logos/akuvox.png" alt="A" width={24} height={24} className="object-contain" />
                                                            ) : (
                                                                <MapPin size={14} className="text-neutral-600" />
                                                            )}
                                                        </div>
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
                                                    </div>
                                                </TableCell>

                                                {/* Stay Duration / Context */}
                                                <TableCell>
                                                    {(evt as any).stayDuration ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className={cn(
                                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-widest w-fit",
                                                                (evt as any).previousDirection === 'ENTRY'
                                                                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                                                    : "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
                                                            )}>
                                                                {(evt as any).previousDirection === 'ENTRY' ? (
                                                                    <><ArrowDownLeft size={10} /> ESTUVO DENTRO</>
                                                                ) : (
                                                                    <><ArrowUpRight size={10} /> ESTUVO FUERA</>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-mono text-neutral-400 font-bold ml-1">
                                                                {formatDuration((evt as any).stayDuration)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[9px] text-neutral-700 font-black uppercase tracking-tighter">Primer Registro</span>
                                                    )}
                                                </TableCell>

                                                {/* Date & Time combined */}
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-neutral-300 font-mono">
                                                            {new Date(evt.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '')}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-neutral-500 font-mono">
                                                            {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </TableCell>

                                                {/* Result Status */}
                                                <TableCell className="text-right pr-4">
                                                    <div className="flex justify-end">
                                                        <div className={cn(
                                                            "w-24 py-1.5 rounded-lg font-black text-[10px] uppercase text-center tracking-tighter shadow-lg",
                                                            evt.decision === "GRANT"
                                                                ? "bg-emerald-600 text-white shadow-emerald-900/40 border border-emerald-500/30"
                                                                : "bg-red-600 text-white shadow-red-900/40 border border-red-500/30"
                                                        )}>
                                                            {evt.decision === "GRANT" ? "PERMITIDO" : "DENEGADO"}
                                                        </div>
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
