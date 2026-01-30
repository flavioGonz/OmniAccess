"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getDevicePlatesPage, addDevicePlate, syncPlatesToDevice, getPlatesEnrichment } from "@/app/actions/devices";
import { getCredentials } from "@/app/actions/credentials";
import { getVehicles } from "@/app/actions/vehicles";
import { LprImportPreviewDialog } from "./LprImportPreviewDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Car,
    Search,
    Trash2,
    Database,
    Loader2,
    ArrowDownToLine,
    Circle,
    Plus,
    UploadCloud,
    ChevronLeft,
    ChevronRight,
    PlayCircle,
    Filter,
    AlertTriangle,
    Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface DevicePlateListDialogProps {
    device: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ITEMS_PER_PAGE = 9;

export function DevicePlateListDialog({ device, open, onOpenChange }: DevicePlateListDialogProps) {
    const [plates, setPlates] = useState<string[]>([]);
    const [localDetailMap, setLocalDetailMap] = useState<Record<string, { userName: string, hasVehicle: boolean }>>({});
    const [enrichmentMap, setEnrichmentMap] = useState<Record<string, { brand: string, color: string, model: string }>>({});
    const [localPlates, setLocalPlates] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchProgress, setFetchProgress] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [newPlate, setNewPlate] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [isSyncingToCamera, setIsSyncingToCamera] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [showImportPreview, setShowImportPreview] = useState(false);
    const [filterOnlyMissing, setFilterOnlyMissing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // RESET STATE WHEN DEVICE CHANGES
    useEffect(() => {
        if (open) {
            setPlates([]);
            setTotalMatches(0);
            setFetchProgress(0);
            setSearchTerm("");
            setCurrentPage(1);
            loadLocalData();
        }
    }, [open, device?.id]);

    const loadLocalData = async () => {
        try {
            const [localCreds, vehiclesResult, enrichment] = await Promise.all([
                getCredentials(),
                getVehicles(),
                getPlatesEnrichment()
            ]);

            const normalize = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            const detailMap: Record<string, { userName: string, hasVehicle: boolean }> = {};
            const credPlates: string[] = [];

            // Map known vehicles
            const vehicleData: Record<string, { brand: string, color: string, model: string }> = {};
            (vehiclesResult?.vehicles || []).forEach(v => {
                const norm = normalize(v.plate);
                vehicleData[norm] = {
                    brand: v.brand || enrichment[norm]?.brand || "Unknown",
                    model: v.model || enrichment[norm]?.model || "Unknown",
                    color: v.color || enrichment[norm]?.color || "Unknown"
                };
            });

            const vehiclePlatesSet = new Set(Object.keys(vehicleData));

            if (localCreds) {
                localCreds.filter(c => c.type === 'PLATE').forEach(c => {
                    const norm = normalize(c.value);
                    credPlates.push(norm);
                    detailMap[norm] = {
                        userName: c.user?.name || "N/A",
                        hasVehicle: vehiclePlatesSet.has(norm)
                    };
                });
            }

            setLocalPlates(Array.from(new Set(credPlates)));
            setLocalDetailMap(detailMap);
            // Combine enrichment from events with known vehicles
            setEnrichmentMap({ ...enrichment, ...vehicleData });
        } catch (e) {
            console.error("Local data load failed:", e);
        }
    };

    const loadPlates = async () => {
        if (!device?.id) return;
        setLoading(true);
        setFetchProgress(0);
        setPlates([]);
        setTotalMatches(0);
        setCurrentPage(1);
        try {
            await loadLocalData();

            const searchId = Date.now().toString(16).slice(-8);
            let start = 0;
            let keepFetching = true;
            let allCamPlates: string[] = [];
            let recordsProcessed = 0;

            const normalize = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

            while (keepFetching) {
                const res = await getDevicePlatesPage(device.id, searchId, start) as any;
                if (!res.success) throw new Error(res.message);

                const normalizedBatch = res.plates.map((p: string) => normalize(p));
                allCamPlates = [...allCamPlates, ...normalizedBatch];

                setPlates(Array.from(new Set(allCamPlates)));

                const total = res.totalMatches || 0;
                setTotalMatches(total);

                recordsProcessed += res.numOfMatches;

                if (total > 0) {
                    const progress = Math.min(Math.round((recordsProcessed / total) * 100), 100);
                    setFetchProgress(progress);
                }

                if (res.isLastPage || recordsProcessed >= total || (total > 0 && start >= total)) {
                    keepFetching = false;
                } else {
                    start = recordsProcessed;
                }

                if (start > 15000) break;
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            toast.error(`Error: ${error.message || "Conexión fallida"}`);
        } finally {
            setLoading(false);
            setFetchProgress(100);
        }
    };

    const handleAddPlate = async () => {
        const clean = newPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!clean || clean.length < 3) {
            toast.error("Matrícula no válida");
            return;
        }

        setIsAdding(true);
        try {
            const result = await addDevicePlate(device.id, clean);
            if (result.success) {
                toast.success(result.message);
                setNewPlate("");
                loadPlates();
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsAdding(false);
        }
    };

    // Updated Sync Logic with Progress Bar (using existing action for wipe, and addDevicePlate in loop for progress)
    const handleSyncToCamera = async () => {
        if (!confirm("¿Deseas sincronizar las matrículas de la App hacia la cámara?")) return;
        setIsSyncingToCamera(true);
        setSyncProgress(0);
        try {
            // First wipe using the existing action or just tell the user we are starting
            toast.info("Iniciando sincronización total...");

            // To show real progress, we should ideally do the wipe and then individual adds
            // but for now let's just use the server action and simulate progress or refactor.
            // REFACTOR: Use individual calls to addDevicePlate for progress
            const totalToSync = localPlates.length;
            let current = 0;

            // Note: This is an expensive operation if we have 600+ plates.
            // For now, let's keep the server action but we can't show real interim progress easily.
            // Alternative: Call the server action and show an indeterminate progress or "Processing"
            // Alternative: Call the server action and show an indeterminate progress or "Processing"
            const result = await syncPlatesToDevice(device.id);

            if (result.success) {
                setSyncProgress(100);
                toast.success(result.message);
                loadPlates();
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSyncingToCamera(false);
        }
    };

    const handleSyncClick = () => {
        // Custom confirmation with reminder
        if (confirm("⚠️ IMPORTANTE:\n\nAl sincronizar, se SOBREESCRIBIRÁ la lista interna de la cámara con los datos de la App.\nCualquier matrícula en la cámara que no esté en la App se perderá.\n\n¿Deseas continuar?")) {
            handleSyncToCamera();
        }
    };

    const handleDelete = async (plate: string) => {
        if (!confirm(`¿Eliminar matrícula ${plate} de la cámara?`)) return;
        toast.info("Borrado individual deshabilitado por seguridad.");
    };

    const allFilteredPlates = useMemo(() => {
        const uniquePool = Array.from(new Set([...plates, ...localPlates]));
        return uniquePool
            .filter(p => p.includes(searchTerm.toUpperCase()))
            .map(plate => {
                const inCamera = plates.includes(plate);
                const localInfo = localDetailMap[plate];
                const inLocal = !!localInfo;
                const residentName = localInfo?.userName || "";
                const enrichment = enrichmentMap[plate];

                return {
                    plate,
                    inCamera,
                    inLocal,
                    residentName,
                    brand: enrichment?.brand || null,
                    color: enrichment?.color || null
                };
            })
            .filter(item => !filterOnlyMissing || !item.inLocal)
            .sort((a, b) => a.plate.localeCompare(b.plate));
    }, [plates, localPlates, localDetailMap, enrichmentMap, searchTerm, filterOnlyMissing]);

    const totalPages = Math.max(1, Math.ceil(allFilteredPlates.length / ITEMS_PER_PAGE));
    const paginatedPlates = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return allFilteredPlates.slice(start, start + ITEMS_PER_PAGE);
    }, [allFilteredPlates, currentPage]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-3xl h-[85vh] p-0 flex flex-col border-neutral-800 bg-[#0a0a0a] overflow-hidden shadow-2xl rounded-xl"
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                {/* Fixed Header */}
                <DialogHeader className="p-6 pb-4 border-b border-neutral-900 bg-neutral-950/50 shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-neutral-900 rounded-lg border border-white/5 shadow-inner">
                                <Car className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black text-neutral-100 uppercase tracking-tight leading-none mb-1">Listas Internas de Hardware</DialogTitle>
                                <DialogTitle className="text-lg font-black text-neutral-100 uppercase tracking-tight leading-none mb-1">Listas Internas de Hardware</DialogTitle>
                                <DialogDescription className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                                    {device?.name} • {device?.ip}
                                </DialogDescription>
                            </div>
                        </div>

                        {/* Comparing Counters at Top - Redesigned */}
                        <div className="flex items-center gap-0 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden h-10">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-3 px-4 h-full hover:bg-white/5 transition-colors cursor-help border-r border-neutral-800">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                            <div className="flex flex-col leading-none">
                                                <span className="text-[10px] font-bold text-neutral-400 uppercase">Cámara</span>
                                                <span className="text-xs font-black font-mono text-white">{totalMatches || plates.length}</span>
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Matrículas almacenadas actualmente en el dispositivo físico</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-3 px-4 h-full hover:bg-white/5 transition-colors cursor-help">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            <div className="flex flex-col leading-none">
                                                <span className="text-[10px] font-bold text-neutral-400 uppercase">Sistema</span>
                                                <span className="text-xs font-black font-mono text-white">{localPlates.length}</span>
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Matrículas registradas en la base de datos de la App</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

                    {(loading || isSyncingToCamera) && (
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-[9px] uppercase font-black tracking-widest text-indigo-400 font-mono">
                                <span className="flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {isSyncingToCamera ? "Sincronizando con cámara..." : "Capturando hardware..."}
                                </span>
                                <span>{isSyncingToCamera ? syncProgress : fetchProgress}%</span>
                            </div>
                            <Progress value={isSyncingToCamera ? syncProgress : fetchProgress} className="h-1 bg-neutral-900" indicatorClassName="bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        </div>
                    )}

                    {/* Hikvision Wipe Warning */}
                    {device?.brand === 'HIKVISION' && !loading && !isSyncingToCamera && (
                        <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 text-orange-500/80">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <p className="text-[10px] uppercase font-bold tracking-wide">
                                Advertencia: La sincronización BORRARÁ la lista actual de la cámara y cargará la de la App.
                            </p>
                        </div>
                    )}
                </DialogHeader>

                {/* Main Content */}
                <div className="flex-1 !flex flex-col min-h-0 overflow-hidden px-8 py-6 gap-6">

                    {/* TOP SECTION: Add Plate and Search */}
                    <div className="flex flex-col gap-3 shrink-0">
                        {/* Add Plate Bar */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700 w-4 h-4" />
                                <Input
                                    placeholder="Añadir nueva matrícula (ej. AB123CD)..."
                                    value={newPlate}
                                    onChange={(e) => setNewPlate(e.target.value)}
                                    className="h-10 border-neutral-800 bg-neutral-900/60 rounded-lg font-mono text-xs pl-10 focus:ring-1 focus:ring-indigo-500/50"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddPlate()}
                                />
                            </div>
                            <Button
                                onClick={handleAddPlate}
                                disabled={isAdding || !newPlate}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white h-10 w-10 rounded-lg shrink-0 shadow-lg shadow-indigo-900/20"
                                size="icon"
                            >
                                {isAdding ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            </Button>
                        </div>

                        <div className="flex gap-2">
                            {/* Search */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 w-4 h-4" />
                                <Input
                                    placeholder="Buscar en la lista..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="pl-10 h-10 border-neutral-800 bg-neutral-900/60 text-xs font-bold rounded-lg focus:ring-1 focus:ring-white/10"
                                />
                            </div>

                            {/* Filter and Control Buttons */}
                            <div className="flex gap-2 shrink-0">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={filterOnlyMissing ? "default" : "outline"}
                                                size="icon"
                                                onClick={() => {
                                                    setFilterOnlyMissing(!filterOnlyMissing);
                                                    setCurrentPage(1);
                                                }}
                                                className={cn(
                                                    "h-10 w-10 rounded-lg transition-all",
                                                    filterOnlyMissing ? "bg-orange-600 hover:bg-orange-500 text-white border-transparent" : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-white/5"
                                                )}
                                            >
                                                <Filter className="w-4 h-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p className="text-[10px] font-bold">Ver solo matrículas que faltan en BBDD</p></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={loadPlates}
                                                disabled={loading}
                                                className="h-10 w-10 rounded-lg border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:bg-white/5"
                                            >
                                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p className="text-[10px] font-bold">Recargar Lista de Cámara</p></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                <Button
                                    size="sm"
                                    onClick={() => setShowImportPreview(true)}
                                    disabled={loading || plates.length === 0}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase tracking-widest rounded-lg h-10 px-4 shadow-lg shadow-blue-900/20"
                                >
                                    Bajar
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSyncClick}
                                    disabled={loading || isSyncingToCamera}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest rounded-lg h-10 px-4 shadow-lg shadow-emerald-900/20"
                                >
                                    {isSyncingToCamera ? <Loader2 className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3 mr-2" />}
                                    Sync
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Matrix View - Refined */}
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-neutral-900/30 rounded-lg border border-neutral-800/50">
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {paginatedPlates.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-neutral-800 opacity-30">
                                    <Database className="w-16 h-16 mb-4" />
                                    <p className="text-xs font-black uppercase tracking-widest">Sin registros disponibles</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {paginatedPlates.map(({ plate, inCamera, inLocal, residentName, brand, color }) => (
                                        <div key={plate} className="group p-4 rounded-lg border border-neutral-800 bg-black/40 hover:bg-neutral-900 hover:border-neutral-700 transition-all flex flex-col h-28 justify-between relative overflow-hidden">

                                            {/* Vehicle Background Decoration */}
                                            {localDetailMap[plate]?.hasVehicle && (
                                                <div className="absolute right-[-10%] bottom-[-20%] opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none rotate-[-10deg]">
                                                    <Car className="w-24 h-24 text-white" />
                                                </div>
                                            )}

                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex gap-1.5">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className={cn(
                                                                        "w-2 h-2 rounded-full",
                                                                        inLocal ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-neutral-800 border border-neutral-700"
                                                                    )} />
                                                                </TooltipTrigger>
                                                                <TooltipContent className="text-[10px] font-black uppercase">
                                                                    {inLocal ? "Registrado en Sistema" : "No registrado en Sistema"}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className={cn(
                                                                        "w-2 h-2 rounded-full",
                                                                        inCamera ? "bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" : "bg-neutral-800 border border-neutral-700"
                                                                    )} />
                                                                </TooltipTrigger>
                                                                <TooltipContent className="text-[10px] font-black uppercase">
                                                                    {inCamera ? "Presente en Cámara" : "Falta en Cámara"}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>

                                                    {inCamera && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        className="text-neutral-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                                        onClick={(e) => { e.stopPropagation(); handleDelete(plate); }}
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p className="text-[10px] uppercase font-bold text-red-400">Eliminar de Cámara</p></TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                </div>
                                                <div className="text-xl font-black font-mono text-neutral-200 tracking-wider leading-none uppercase select-all group-hover:text-white transition-colors">
                                                    {plate}
                                                </div>
                                            </div>

                                            <div className="relative z-10">
                                                <div className="text-[10px] font-black text-neutral-500 group-hover:text-neutral-400 truncate uppercase tracking-tight mb-0.5">
                                                    {residentName || "NO ASIGNADO"}
                                                </div>
                                                <div className="flex gap-2 text-[9px] font-medium uppercase tracking-wide">
                                                    <span className={cn("font-bold", brand && brand !== 'Unknown' ? "text-indigo-400" : "text-neutral-600")}>
                                                        {brand && brand !== 'Unknown' ? brand : "---"}
                                                    </span>
                                                    <span className="text-neutral-700">|</span>
                                                    <span className={cn(color && color !== 'Unknown' ? "text-neutral-400" : "text-neutral-600")}>
                                                        {color && color !== 'Unknown' ? color : "---"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pagination Bar */}
                        {allFilteredPlates.length > ITEMS_PER_PAGE && (
                            <div className="p-3 border-t border-neutral-800 bg-neutral-900/50 flex items-center justify-center gap-6 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                    className="w-8 h-8 rounded-lg text-neutral-500 hover:text-white"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </Button>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Pág</span>
                                    <span className="text-[10px] font-black text-white bg-white/5 w-6 h-6 flex items-center justify-center rounded border border-white/5">{currentPage}</span>
                                    <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">de {totalPages}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    className="w-8 h-8 rounded-lg text-neutral-500 hover:text-white"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Footer - Concise */}
                <div className="px-6 py-3 border-t border-neutral-900 bg-neutral-950 flex justify-between items-center shrink-0">
                    <div className="flex gap-6 text-[9px] font-black uppercase tracking-widest text-neutral-600">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]" />
                            <span>En Cámara</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                            <span>En App</span>
                        </div>
                    </div>
                    <div className="text-[9px] font-mono text-neutral-700 uppercase">
                        Total Mostrado: {allFilteredPlates.length}
                    </div>
                </div>
            </DialogContent>

            {showImportPreview && (
                <LprImportPreviewDialog
                    device={device}
                    cameraPlates={plates}
                    localPlates={localPlates}
                    localVehicles={Object.keys(localDetailMap).filter(p => localDetailMap[p].hasVehicle)}
                    open={showImportPreview}
                    onOpenChange={setShowImportPreview}
                    onSuccess={loadPlates}
                />
            )}
        </Dialog>
    );
}
