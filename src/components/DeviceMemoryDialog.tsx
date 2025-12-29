"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
    Users,
    Trash2,
    RefreshCw,
    Database,
    UserPlus,
    CheckCircle2,
    AlertCircle,
    Loader2,
    DownloadCloud,
    Camera,
    Tag,
    Car,
    Server,
    ArrowRightLeft,
    UploadCloud,
    Search,
    User,
    HardDrive
} from "lucide-react";
import { getDeviceFaces, deleteDeviceFace, syncUserToDevice, importAllFromDevice, syncIdentityAction, exportAllToDevice, getDatabaseStats } from "@/app/actions/deviceMemory";
import { getUsers } from "@/app/actions/users";
import { getUnits } from "@/app/actions/units";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DeviceMemoryDialogProps {
    device: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

export function DeviceMemoryDialog({ device, open, onOpenChange }: DeviceMemoryDialogProps) {
    const [faces, setFaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [units, setUnits] = useState<any[]>([]);
    const [selectedUnitId, setSelectedUnitId] = useState<string>("none");

    // Sync state
    const [showSync, setShowSync] = useState(false);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [syncSearch, setSyncSearch] = useState("");
    const [isSyncing, setIsSyncing] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [faceSearch, setFaceSearch] = useState("");

    const loadFaces = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getDeviceFaces(device.id);
            setFaces(data);
        } catch (err: any) {
            console.error(err);
            const errorMsg = `
                No se pudo conectar con el dispositivo.
                
                Dispositivo: ${device.name}
                IP: ${device.ip || 'No configurada'}
                Marca: ${device.brand}
                
                Posibles causas:
                • El dispositivo está apagado
                • La IP es incorrecta
                • El dispositivo no está en la misma red
                • Firewall bloqueando la conexión
                • Credenciales incorrectas
                
                Verifica la conectividad con: ping ${device.ip}
            `;
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const loadSystemUsers = async () => {
        const users = await getUsers();
        // @ts-ignore
        setSystemUsers(users); // Allow all users (even with just tags/PIN)
    };

    useEffect(() => {
        if (open) {
            loadFaces();
            loadSystemUsers();
            getUnits().then(setUnits);
        }
    }, [open]);

    const handleSync = async (userId: string) => {
        setIsSyncing(userId);
        const promise = syncUserToDevice(device.id, userId);

        toast.promise(promise, {
            loading: 'Inyectando usuario y rostro al equipo...',
            success: (data) => {
                // Refresh list and go back to main view after a short delay
                setTimeout(async () => {
                    await loadFaces();
                    setShowSync(false);
                }, 1000);
                return "Usuario inyectado correctamente";
            },
            error: "Error al sincronizar con el equipo"
        });

        try {
            await promise;
        } catch (err) {
            console.error(err);
        } finally {
            setIsSyncing(null);
        }
    };

    // Old handleDelete removed


    // Import State
    const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'completed'>('idle');
    const [showConfirm, setShowConfirm] = useState(false);
    const [analysis, setAnalysis] = useState({ total: 0, new: 0, existing: 0, tags: 0, faces: 0 });
    const [progress, setProgress] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [currentImport, setCurrentImport] = useState<any>(null);
    const [importStats, setImportStats] = useState({ success: 0, faces: 0, tags: 0, failed: 0 });

    // Unified Sync Modal State
    const [syncMode, setSyncMode] = useState<'import' | 'export' | null>(null);
    const [dbStats, setDbStats] = useState({ users: 0, tags: 0, plates: 0 });

    const handleDownloadAll = () => {
        // 1. Analyze
        const total = faces.length;
        if (total === 0) {
            toast.error("No hay identidades para descargar.");
            return;
        }

        let newUsers = 0;
        let existing = 0;
        let totalTags = 0;
        let totalFaces = 0;

        faces.forEach(f => {
            const exists = systemUsers.some(u => u.name.toLowerCase() === f.Name.toLowerCase());
            if (!exists) newUsers++;
            else existing++;

            if (f.HasTag) totalTags++;
            if (f.HasFace) totalFaces++;
        });

        setAnalysis({ total, new: newUsers, existing, tags: totalTags, faces: totalFaces });
        setSyncMode('import');
    };

    const handleExportRequest = async () => {
        setLoading(true);
        try {
            const stats = await getDatabaseStats();
            setDbStats(stats);
            setSyncMode('export');
        } catch (error) {
            toast.error("Error al analizar base de datos");
        } finally {
            setLoading(false);
        }
    };

    const startImport = async () => {
        setSyncMode(null);
        setImportStatus('importing');
        setProgress(0);
        setProcessedCount(0);
        setImportStats({ success: 0, faces: 0, tags: 0, failed: 0 });

        const total = faces.length;

        for (let i = 0; i < total; i++) {
            setProcessedCount(i + 1);
            const item = faces[i];
            setCurrentImport(item);

            try {
                const result = await syncIdentityAction(device.id, item, selectedUnitId === 'none' ? undefined : selectedUnitId);
                if (result.success) {
                    setImportStats(prev => ({
                        success: prev.success + 1,
                        faces: prev.faces + (item.HasFace ? 1 : 0),
                        tags: prev.tags + (item.HasTag ? 1 : 0),
                        failed: prev.failed
                    }));
                }
            } catch (err) {
                console.error(err);
                setImportStats(prev => ({ ...prev, failed: prev.failed + 1 }));
            }

            await new Promise(r => setTimeout(r, 50));
            setProgress(((i + 1) / total) * 100);
        }

        setImportStatus('completed');
        toast.success("Sincronización finalizada correctamente");
    };

    const startExport = async () => {
        setSyncMode(null);
        setLoading(true);
        try {
            const res = await exportAllToDevice(device.id);
            const successMsg = device.brand === 'HIKVISION'
                ? `Sincronización Completada: ${res.processed} usuarios (${res.tags} matrículas)`
                : `Sincronización Completada: ${res.processed} usuarios (${res.faces} caras, ${res.tags} tags)`;
            toast.success(successMsg);
            loadFaces();
        } catch (e: any) {
            toast.error("Error al volcar datos: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const renderConfirmOverlay = () => {
        if (!syncMode) return null;

        const isExport = syncMode === 'export';
        const title = isExport ? "Volcar Base de Datos a Equipo" : "Descargar Equipo a App";
        const sourceName = isExport ? "Base de Datos (App)" : "Memoria del Equipo";
        const targetName = isExport ? device.name : "Base de Datos (App)";
        const sourceCount = isExport ? dbStats.users : analysis.total;

        const targetDiff = isExport ? `~${dbStats.users}` : `+${analysis.new}`;
        const targetLabel = isExport ? "Identidades a Sincronizar" : "Nuevos Usuarios";

        return (
            <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-2xl bg-[#0c0c0c] border border-neutral-800 rounded-3xl shadow-2xl flex flex-col max-h-[90%] overflow-hidden">
                    {/* Header */}
                    <div className={cn("p-6 border-b border-white/5 shrink-0", isExport ? "bg-orange-500/5" : "bg-blue-500/5")}>
                        <div className="flex items-center gap-5">
                            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", isExport ? "bg-orange-600" : "bg-blue-600")}>
                                {isExport ? <UploadCloud size={28} /> : <DownloadCloud size={28} />}
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">{title}</h3>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border", isExport ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-blue-500/10 border-blue-500/20 text-blue-400")}>
                                        {isExport ? "Modo Sobrescritura" : "Modo Importación Inteligente"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Body */}
                    <div className="p-8 overflow-y-auto custom-scrollbar">
                        {/* Comparison Visual */}
                        <div className="flex items-center justify-between gap-4 sm:gap-8">
                            {/* Source */}
                            <div className="flex-1 flex flex-col items-center gap-3">
                                <div className="p-3 sm:p-4 rounded-full bg-neutral-900 border border-white/10">
                                    {isExport ? <Database size={20} className="text-neutral-400" /> : <HardDrive size={20} className="text-neutral-400" />}
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-1">{sourceName}</p>
                                    <p className="text-2xl sm:text-3xl font-black text-white">{sourceCount}</p>
                                    <p className="text-[10px] font-bold text-neutral-600 uppercase">Registros Totales</p>
                                </div>
                            </div>

                            {/* Arrow Animation */}
                            <div className="flex flex-col items-center text-neutral-600 gap-2">
                                <div className="flex items-center gap-1 opacity-50">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className={cn("w-1 h-1 rounded-full animate-ping", isExport ? "bg-orange-500" : "bg-blue-500")} style={{ animationDelay: `${i * 75}ms` }} />
                                    ))}
                                </div>
                                <div className={cn("p-2 sm:p-3 rounded-xl border border-white/5", isExport ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500")}>
                                    {isExport ? <ArrowRightLeft size={20} /> : <DownloadCloud size={20} />}
                                </div>
                            </div>

                            {/* Target */}
                            <div className="flex-1 flex flex-col items-center gap-3">
                                <div className="p-3 sm:p-4 rounded-full bg-neutral-900 border border-white/10">
                                    {isExport ? <HardDrive size={20} className="text-neutral-400" /> : <Database size={20} className="text-neutral-400" />}
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-1">{targetName}</p>
                                    <p className={cn("text-2xl sm:text-3xl font-black", isExport ? "text-orange-400" : "text-blue-400")}>{targetDiff}</p>
                                    <p className="text-[10px] font-bold text-neutral-600 uppercase">{targetLabel}</p>
                                </div>
                            </div>
                        </div>

                        {/* Stats Details */}
                        <div className="mt-8 bg-neutral-900/30 border border-white/5 rounded-2xl p-5">
                            <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2 opacity-50">
                                <Search size={12} /> Detalles de la Operación
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 bg-black/20 p-3 rounded-lg">
                                    <div className="w-1 bg-neutral-700 h-6 rounded-full"></div>
                                    <div>
                                        <p className="text-[9px] text-neutral-500 uppercase font-black mb-0.5">Rostros</p>
                                        <p className="text-xs font-bold text-neutral-300">
                                            {isExport ? `${dbStats.users} Usuarios` : `${analysis.faces} Detectados`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-black/20 p-3 rounded-lg">
                                    <div className="w-1 bg-neutral-700 h-6 rounded-full"></div>
                                    <div>
                                        <p className="text-[9px] text-neutral-500 uppercase font-black mb-0.5">Credenciales</p>
                                        <p className="text-xs font-bold text-neutral-300">
                                            {isExport ? `${dbStats.tags} Tags` : `${analysis.tags} Tags`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <p className="mt-4 text-[10px] text-neutral-500 font-medium text-center border-t border-white/5 pt-3">
                                {isExport
                                    ? "Se enviará la base de datos completa al dispositivo, actualizando registros existentes."
                                    : "Se descargarán las identidades y se crearán nuevos usuarios en el sistema si no existen."}
                            </p>
                        </div>
                    </div>

                    {/* Unit Selection for Import */}
                    {!isExport && (
                        <div className="px-8 pb-4">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                                Asignar Unidad / Lote (Opcional)
                            </label>
                            <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                                <SelectTrigger className="w-full bg-neutral-900 border-neutral-800 text-white h-10">
                                    <SelectValue placeholder="Seleccionar Unidad..." />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectItem value="none">Sin asignación (General)</SelectItem>
                                    {units.map((u: any) => (
                                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="p-5 bg-neutral-900 border-t border-white/5 flex gap-3 shrink-0">
                        <Button
                            onClick={() => setSyncMode(null)}
                            variant="ghost"
                            className="flex-1 h-12 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 font-bold uppercase tracking-widest text-[10px] border border-transparent hover:border-neutral-800"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={isExport ? startExport : startImport}
                            className={cn("flex-[2] h-12 rounded-xl text-white font-black uppercase tracking-widest text-[10px] shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99]",
                                isExport ? "bg-orange-600 hover:bg-orange-500" : "bg-blue-600 hover:bg-blue-500")}
                        >
                            {isExport ? <UploadCloud className="mr-2" size={16} /> : <DownloadCloud className="mr-2" size={16} />}
                            {isExport ? "Iniciar Volcado" : "Iniciar Importación"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const resetImport = () => {
        setImportStatus('idle');
        setProgress(0);
        setCurrentImport(null);
        loadSystemUsers(); // Refresh local list
    };

    // Render Logic Helper for Import Overlay
    const renderImportOverlay = () => {
        if (importStatus === 'idle') return null;

        return (
            <div className="absolute inset-0 bg-[#080808] z-50 flex flex-col items-center justify-center p-10 animate-in fade-in zoom-in-95 duration-300">
                {importStatus === 'importing' ? (
                    <div className="w-full max-w-md space-y-8 text-center">
                        <div className="mx-auto w-24 h-24 relative">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                            <div className="relative z-10 w-24 h-24 bg-neutral-900 rounded-full border-2 border-blue-500 flex items-center justify-center overflow-hidden">
                                {currentImport?.FaceUrl ? (
                                    <img src={currentImport.FaceUrl} alt={currentImport?.Name || 'Usuario'} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-2xl font-black text-blue-500">{currentImport?.Name?.charAt(0)}</span>
                                )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-[#080808] p-1.5 rounded-full border border-neutral-800">
                                {currentImport?.HasTag ? <Tag className="text-green-500" size={16} /> : <Users className="text-blue-500" size={16} />}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight animate-pulse">
                                Importando Identidad...
                            </h3>
                            <p className="text-sm font-medium text-neutral-400">
                                Procesando: <span className="text-blue-400 font-bold">{currentImport?.Name}</span>
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                <span>Progreso Global ({processedCount} / {analysis.total})</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                                <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 mb-1 justify-center">
                                    <Tag size={14} className="text-green-500" />
                                    <span className="text-[10px] font-black uppercase text-neutral-500">Tags</span>
                                </div>
                                <span className="text-xl font-black text-white">{importStats.tags}</span>
                            </div>
                            <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 mb-1 justify-center">
                                    <Camera size={14} className="text-blue-500" />
                                    <span className="text-[10px] font-black uppercase text-neutral-500">Fotos</span>
                                </div>
                                <span className="text-xl font-black text-white">{importStats.faces}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-md space-y-8 text-center animate-in slide-in-from-bottom-4">
                        <div className="mx-auto w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/20 text-green-500 mb-6">
                            <CheckCircle2 size={48} />
                        </div>

                        <div>
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Importación Completada</h3>
                            <p className="text-neutral-400 font-medium text-sm">Se han sincronizado las identidades con la base de datos local.</p>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
                                <p className="text-xs text-neutral-500 font-black uppercase mb-1">Total</p>
                                <p className="text-2xl text-white font-black">{importStats.success}</p>
                            </div>
                            <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
                                <p className="text-xs text-neutral-500 font-black uppercase mb-1">Rostros</p>
                                <p className="text-2xl text-blue-400 font-black">{importStats.faces}</p>
                            </div>
                            <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
                                <p className="text-xs text-neutral-500 font-black uppercase mb-1">Tags</p>
                                <p className="text-2xl text-green-400 font-black">{importStats.tags}</p>
                            </div>
                        </div>

                        <Button
                            onClick={resetImport}
                            className="w-full h-12 rounded-xl bg-white text-black font-black uppercase tracking-widest hover:bg-neutral-200"
                        >
                            Finalizar
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    const filteredUsers = systemUsers.filter(u =>
        u.name.toLowerCase().includes(syncSearch.toLowerCase()) ||
        u.unit?.name?.toLowerCase().includes(syncSearch.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl bg-neutral-950 border-neutral-800 p-0 overflow-hidden shadow-2xl">
                {renderConfirmOverlay()}
                {renderImportOverlay()}
                <div className="flex flex-col lg:flex-row h-[650px]">
                    {/* Left Panel: Device Info & Actions */}
                    <div className="w-full lg:w-96 bg-[#0c0c0c] border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col relative group/sidebar">
                        {/* Device Large Preview Region */}
                        <div className="relative w-full aspect-[4/5] bg-gradient-to-b from-neutral-900 to-black p-6 flex flex-col items-center justify-center overflow-hidden">
                            {/* Background decoration */}
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-transparent to-transparent pointer-events-none" />

                            {/* Centered Title Overhead */}
                            <div className="absolute top-8 inset-x-0 z-20 text-center pointer-events-none">
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-xl">{device.name}</h2>
                            </div>

                            {/* Main Device Image */}
                            <div className="relative w-full h-full flex items-center justify-center p-4 z-10 transition-transform duration-500 group-hover/sidebar:scale-[1.02] mt-4">
                                <img
                                    src={device.modelPhoto || "/placeholder-device.png"}
                                    alt={device.name}
                                    className="w-full h-full object-contain relative z-10 drop-shadow-2xl"
                                />

                                {/* Action Toolbar - Floating Glassmorphism */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-14 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-1 px-3 py-1 opacity-0 translate-y-4 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-y-0 transition-all duration-300 z-30 shadow-2xl">

                                    {/* Inject Face/Plate */}
                                    <div className="relative group/tooltip">
                                        <button
                                            onClick={() => setShowSync(!showSync)}
                                            className={`p-2.5 rounded-xl transition-all ${showSync ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`}
                                        >
                                            {device.brand === 'HIKVISION' ? <Car size={18} /> : <UserPlus size={18} />}
                                        </button>
                                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none shadow-xl scale-95 group-hover/tooltip:scale-100 origin-bottom">
                                            {device.brand === 'HIKVISION' ? 'Inyectar Matrícula' : 'Subir Usuario'}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#1a1a1a]"></div>
                                        </div>
                                    </div>

                                    {/* Refresh */}
                                    <div className="relative group/tooltip">
                                        <button
                                            onClick={loadFaces}
                                            disabled={loading}
                                            className={`p-2.5 rounded-xl transition-all text-neutral-400 hover:text-white hover:bg-white/10 ${loading ? 'animate-pulse' : ''}`}
                                        >
                                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                                        </button>
                                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none shadow-xl scale-95 group-hover/tooltip:scale-100 origin-bottom">
                                            Refrescar Datos
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#1a1a1a]"></div>
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="w-px h-6 bg-white/10 mx-1" />

                                    {/* Download All */}
                                    <div className="relative group/tooltip">
                                        <button
                                            onClick={handleDownloadAll}
                                            disabled={isDownloading || loading}
                                            className="p-2.5 rounded-xl transition-all text-neutral-400 hover:text-white hover:bg-white/10"
                                        >
                                            {isDownloading ? <Loader2 className="animate-spin" size={18} /> : <DownloadCloud size={18} />}
                                        </button>
                                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none shadow-xl scale-95 group-hover/tooltip:scale-100 origin-bottom">
                                            Descargar a App
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#1a1a1a]"></div>
                                        </div>
                                    </div>

                                    {/* Sync Database to Device */}
                                    <div className="relative group/tooltip">
                                        <button
                                            onClick={handleExportRequest}
                                            disabled={loading}
                                            className="p-2.5 rounded-xl transition-all text-neutral-400 hover:text-orange-400 hover:bg-orange-500/10"
                                        >
                                            <UploadCloud size={18} />
                                        </button>
                                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none shadow-xl scale-95 group-hover/tooltip:scale-100 origin-bottom">
                                            Volcar BD a Equipo
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#1a1a1a]"></div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                        </div>

                        {/* Usage Stats Section */}
                        <div className="flex-1 p-8 bg-[#0c0c0c] flex flex-col justify-end pb-8">

                            <div className="space-y-6">
                                {/* Capacity Bar */}
                                <div className="bg-neutral-900/50 p-5 rounded-2xl border border-white/5 relative overflow-hidden group/stats hover:border-blue-500/30 transition-colors">
                                    <div className="flex justify-between items-end mb-2 relative z-10">
                                        <div>
                                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Capacidad Usada</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-white tracking-tight">{faces.length}</span>
                                                <span className="text-xs font-bold text-neutral-600">/ {device.brand === 'HIKVISION' ? '2048' : '20k'}</span>
                                            </div>
                                        </div>
                                        <div className={`p-2 rounded-lg ${faces.length > 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-neutral-800 text-neutral-600'}`}>
                                            <Users size={18} />
                                        </div>
                                    </div>

                                    <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden relative z-10">
                                        <div
                                            className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-1000 ease-out"
                                            style={{ width: `${Math.min((faces.length / (device.brand === 'HIKVISION' ? 2048 : 20000)) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-neutral-900/30 rounded-xl border border-white/5">
                                        <p className="text-[9px] text-neutral-500 font-bold uppercase mb-1">IP Address</p>
                                        <p className="text-xs font-mono font-medium text-neutral-300">{device.ip}</p>
                                    </div>
                                    <div className="p-3 bg-neutral-900/30 rounded-xl border border-white/5">
                                        <p className="text-[9px] text-neutral-500 font-bold uppercase mb-1">Auth Type</p>
                                        <p className="text-xs font-mono font-medium text-neutral-300">{device.authType}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Right Panel: List / Sync View */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[#080808]">
                        <DialogHeader className="p-8 pb-4 border-b border-white/5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <DialogTitle className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                        {showSync ? <UserPlus className="text-blue-500" size={20} /> : <Users className="text-blue-500" size={20} />}
                                        {showSync
                                            ? (device.brand === 'HIKVISION' ? "Sincronización de Matrículas" : "Inyección de Rostros")
                                            : (device.brand === 'HIKVISION' ? `Listado LPR: ${device.name}` : `Directorio: ${device.name}`)}
                                    </DialogTitle>
                                    <DialogDescription className="text-neutral-500 text-xs font-medium uppercase tracking-widest mt-1">
                                        {showSync
                                            ? "Sincroniza usuarios del sistema hacia el equipo"
                                            : (device.brand === 'HIKVISION' ? "Matrículas almacenadas en la lista blanca de la cámara" : "Listado de identidades almacenadas físicamente")}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        {showSync ? (
                            <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950">
                                <div className="p-8 pb-0">
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Search className="text-neutral-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Buscar usuario o unidad..."
                                            value={syncSearch}
                                            onChange={(e) => setSyncSearch(e.target.value)}
                                            className="w-full bg-neutral-900/50 border border-white/5 h-12 rounded-xl pl-12 pr-4 text-sm font-medium text-white placeholder:text-neutral-600 focus:bg-neutral-900 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-900/10 transition-all outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-3">
                                    {filteredUsers.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-30">
                                            <AlertCircle size={32} />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">No se encontraron usuarios con rostros cargados</p>
                                        </div>
                                    ) : (
                                        filteredUsers.map(u => (
                                            <div key={u.id} className="bg-neutral-900/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
                                                        <img src={u.cara} alt={u.name} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-white uppercase tracking-tight">{u.name}</p>
                                                        <p className="text-[10px] text-neutral-500 font-bold uppercase">{u.unit?.name || "SIN UNIDAD"}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    disabled={isSyncing === u.id}
                                                    onClick={() => handleSync(u.id)}
                                                    className="h-9 px-4 rounded-xl bg-blue-600/10 text-blue-400 hover:bg-blue-600 text-[10px] font-black uppercase hover:text-white transition-all"
                                                >
                                                    {isSyncing === u.id ? <Loader2 className="animate-spin" size={12} /> : "Inyectar"}
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {loading && faces.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center space-y-4">
                                        <Loader2 className="animate-spin text-blue-500" size={32} />
                                        <p className="text-xs font-black text-neutral-600 uppercase tracking-widest">Leyendo memoria flash...</p>
                                    </div>
                                ) : error ? (
                                    <div className="h-full flex flex-col items-center justify-center space-y-4 text-center px-10">
                                        <AlertCircle className="text-red-500" size={40} />
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-white uppercase">Error de Conexión</p>
                                            <p className="text-xs text-neutral-500 leading-relaxed font-medium whitespace-pre-line">{error}</p>
                                        </div>
                                        <Button onClick={loadFaces} variant="link" className="text-blue-500 font-bold uppercase text-[10px]">Reintentar</Button>
                                    </div>
                                ) : faces.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center space-y-4">
                                        <Database className="text-neutral-800" size={48} />
                                        <p className="text-xs font-black text-neutral-700 uppercase tracking-[0.3em]">Memoria vacía</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Search Bar */}
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Buscar por nombre, ID o tag..."
                                                value={faceSearch}
                                                onChange={(e) => setFaceSearch(e.target.value)}
                                                className="w-full h-10 pl-10 pr-4 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50"
                                            />
                                        </div>

                                        {/* Table */}
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-white/5 bg-neutral-900/50">
                                                    <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center w-12">Index</th>
                                                    <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center w-20">Source</th>
                                                    <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest w-24">User ID</th>
                                                    <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Name</th>
                                                    {device.brand !== 'HIKVISION' && <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest w-20">PIN</th>}
                                                    <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest w-32">{device.brand === 'HIKVISION' ? 'Matrícula' : 'RF Card'}</th>
                                                    {device.brand !== 'HIKVISION' && <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center w-24">Foto</th>}
                                                    <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center w-20">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {faces
                                                    .filter(face => {
                                                        if (!faceSearch) return true;
                                                        const search = faceSearch.toLowerCase();
                                                        return (
                                                            face.Name?.toLowerCase().includes(search) ||
                                                            face.UserID?.toLowerCase().includes(search) ||
                                                            face.CardCode?.toLowerCase().includes(search)
                                                        );
                                                    })
                                                    .map((face, idx) => (
                                                        <tr key={face.ID} className="bg-transparent hover:bg-neutral-900/50 transition-colors group">
                                                            <td className="p-3 text-center">
                                                                <span className="text-[10px] font-mono text-neutral-600 font-bold">#{idx + 1}</span>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-800 text-neutral-400">
                                                                    <Server size={14} />
                                                                </div>
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="text-xs font-mono font-medium text-neutral-400">{face.UserID || "-"}</span>
                                                            </td>
                                                            <td className="p-3">
                                                                <span className="text-xs font-bold text-white uppercase tracking-tight pl-2">{face.Name}</span>
                                                            </td>
                                                            {device.brand !== 'HIKVISION' && (
                                                                <td className="p-3">
                                                                    <span className="text-xs font-mono text-neutral-500 tracking-wider">
                                                                        {face.PIN ? '••••' : '-'}
                                                                    </span>
                                                                </td>
                                                            )}
                                                            <td className="p-3">
                                                                {face.CardCode ? (
                                                                    <div className="flex items-center gap-2">
                                                                        {device.brand === 'HIKVISION' ? <Car size={12} className="text-blue-500" /> : <Tag size={12} className="text-amber-500" />}
                                                                        <span className="text-xs font-mono text-neutral-300">{face.CardCode}</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-neutral-700 text-xs">-</span>
                                                                )}
                                                            </td>
                                                            {device.brand !== 'HIKVISION' && (
                                                                <td className="p-3">
                                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-neutral-900 border border-white/5 transition-all text-neutral-500 overflow-hidden mx-auto">
                                                                        {face.FaceUrl ? (
                                                                            <img
                                                                                src={face.FaceUrl}
                                                                                alt={face.Name}
                                                                                className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer"
                                                                                onClick={() => window.open(face.FaceUrl, '_blank')}
                                                                            />
                                                                        ) : face.HasFace ? (
                                                                            <div className="group/face relative flex items-center justify-center w-full h-full bg-blue-500/10 text-blue-400">
                                                                                <User size={16} />
                                                                                <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover/face:opacity-100 transition-opacity" />
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[10px] font-black opacity-30">-</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            <td className="p-3 text-center">
                                                                <DeleteConfirmDialog
                                                                    id={face.ID}
                                                                    title={`ELIMINAR: ${face.Name}`}
                                                                    description="¿Seguro que deseas eliminar esta identidad del dispositivo?"
                                                                    onDelete={async () => {
                                                                        const success = await deleteDeviceFace(device.id, face.ID, face.UserID, face.UserCode);
                                                                        if (!success) {
                                                                            toast.error("No se pudo eliminar la identidad. Verifica la conexión.");
                                                                            throw new Error("Failed to delete");
                                                                        }
                                                                    }}
                                                                    onSuccess={() => {
                                                                        setFaces(prev => prev.filter(f => f.ID !== face.ID));
                                                                        toast.success("Identidad eliminada correctamente");
                                                                    }}
                                                                >
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 transition-all rounded-lg"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </Button>
                                                                </DeleteConfirmDialog>
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
