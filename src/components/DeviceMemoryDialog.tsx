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
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
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
    HardDrive,
    ListChecks,
    History,
    Shield,
    Phone,
    PhoneIncoming,
    PhoneOutgoing,
    PhoneMissed,
    Image as ImageIcon,
    Calendar,
    X,
    Clock,
    Network,
    Activity,
    Eye
} from "lucide-react";
import {
    getDeviceFaces,
    deleteDeviceFace,
    syncUserToDevice,
    syncIdentityAction,
    exportAllToDevice,
    getDatabaseStats,
    getDeviceDoorlogs,
    getDeviceCalllogs
} from "@/app/actions/deviceMemory";
import { getUsers } from "@/app/actions/users";
import { getUnits } from "@/app/actions/units";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { DEVICE_MODELS, DRIVER_MODELS } from "@/lib/driver-models";

const BRAND_LOGOS: Record<string, string> = {
    HIKVISION: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Hikvision_logo.svg/2560px-Hikvision_logo.svg.png",
    AKUVOX: "https://www.akuvox.com/images/logo.png",
};

interface DeviceMemoryDialogProps {
    device: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DeviceMemoryDialog({ device, open, onOpenChange }: DeviceMemoryDialogProps) {
    // --- ESTADOS FUNDAMENTALES ---
    const [faces, setFaces] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [units, setUnits] = useState<any[]>([]);
    const [selectedUnitId, setSelectedUnitId] = useState<string>("none");
    const [doorlogs, setDoorlogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [calllogs, setCalllogs] = useState<any[]>([]);
    const [loadingCallLogs, setLoadingCallLogs] = useState(false);
    const [selectedLogImage, setSelectedLogImage] = useState<string | null>(null);

    // --- ESTADOS DE SINCRONIZACIÓN Y FILTROS ---
    const [showSync, setShowSync] = useState(false);
    const [systemUsers, setSystemUsers] = useState<any[]>([]);
    const [syncSearch, setSyncSearch] = useState("");
    const [isSyncing, setIsSyncing] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [faceSearch, setFaceSearch] = useState("");
    const [doorlogSearch, setDoorlogSearch] = useState("");
    const [doorlogFilter, setDoorlogFilter] = useState("ALL");
    const [calllogSearch, setCalllogSearch] = useState("");
    const [calllogFilter, setCalllogFilter] = useState("ALL");

    // --- ESTADOS DE PAGINACIÓN ---
    const [directoryPage, setDirectoryPage] = useState(1);
    const [doorlogPage, setDoorlogPage] = useState(1);
    const [calllogPage, setCalllogPage] = useState(1);
    const itemsPerPage = 6;

    // --- ESTADOS DE IMPORTACIÓN / EXPORTACIÓN MASIVA ---
    const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'completed'>('idle');
    const [analysis, setAnalysis] = useState({ total: 0, new: 0, existing: 0, tags: 0, faces: 0, doorlogs: 0, calllogs: 0 });
    const [progress, setProgress] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [currentImport, setCurrentImport] = useState<any>(null);
    const [importStats, setImportStats] = useState({ success: 0, faces: 0, tags: 0, failed: 0 });
    const [syncMode, setSyncMode] = useState<'import' | 'export' | null>(null);
    const [dbStats, setDbStats] = useState({ users: 0, tags: 0, plates: 0 });

    // --- CARGA DE DATOS ---
    const loadFaces = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getDeviceFaces(device.id);
            setFaces(data);
        } catch (err: any) {
            console.error(err);
            const errorMsg = `No se pudo conectar con el dispositivo: ${device.name}\nIP: ${device.ip || 'No configurada'}\n\nVerifique que el equipo esté encendido y en la misma red.`;
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const loadLogs = async () => {
        if (device.brand !== 'AKUVOX') return;
        setLoadingLogs(true);
        try {
            const data = await getDeviceDoorlogs(device.id);
            setDoorlogs(data);
        } catch (err) {
            console.error("Error loading logs:", err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const loadCallLogs = async () => {
        if (device.brand !== 'AKUVOX') return;
        setLoadingCallLogs(true);
        try {
            const data = await getDeviceCalllogs(device.id);
            setCalllogs(data);
        } catch (err) {
            console.error("Error loading call logs:", err);
        } finally {
            setLoadingCallLogs(false);
        }
    };

    const loadSystemUsers = async () => {
        const users = await getUsers();
        setSystemUsers(users);
    };

    useEffect(() => {
        if (open) {
            loadFaces();
            loadSystemUsers();
            getUnits().then(setUnits);
            if (device.brand === 'AKUVOX') {
                loadLogs();
                loadCallLogs();
            }
        }
    }, [open]);

    // --- HANDLERS DE ACCIÓN ---
    const handleSync = async (userId: string) => {
        setIsSyncing(userId);
        const promise = syncUserToDevice(device.id, userId);

        toast.promise(promise, {
            loading: 'Inyectando usuario y rostro al equipo...',
            success: (data) => {
                setTimeout(async () => {
                    await loadFaces();
                    setShowSync(false);
                }, 1000);
                return "Usuario inyectado correctamente";
            },
            error: "Error al sincronizar con el equipo"
        });

        try { await promise; } catch (err) { console.error(err); } finally { setIsSyncing(null); }
    };

    const handleDownloadAll = () => {
        const total = faces.length;
        if (total === 0 && doorlogs.length === 0 && calllogs.length === 0) {
            toast.error("No hay registros para descargar.");
            return;
        }

        let newUsers = 0, existing = 0, totalTags = 0, totalFaces = 0;
        faces.forEach(f => {
            const exists = systemUsers.some(u => u.name.toLowerCase() === f.Name?.toLowerCase());
            exists ? existing++ : newUsers++;
            if (f.HasTag) totalTags++;
            if (f.HasFace) totalFaces++;
        });

        setAnalysis({
            total,
            new: newUsers,
            existing,
            tags: totalTags,
            faces: totalFaces,
            doorlogs: doorlogs.length,
            calllogs: calllogs.length
        });
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
                setImportStats(prev => ({ ...prev, failed: prev.failed + 1 }));
            }
            setProgress(((i + 1) / total) * 100);
        }
        setImportStatus('completed');
        toast.success("Sincronización finalizada");
    };

    const startExport = async () => {
        setSyncMode(null);
        setLoading(true);
        try {
            const res = await exportAllToDevice(device.id);
            toast.success(`Completado: ${res.processed} usuarios sincronizados`);
            loadFaces();
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const resetImport = () => {
        setImportStatus('idle');
        setProgress(0);
        loadSystemUsers();
    };

    // --- RENDERIZADO DE COMPONENTES DE UI ---

    const renderConfirmOverlay = () => {
        if (!syncMode) return null;
        const isExport = syncMode === 'export';
        const title = isExport ? "Volcar Base de Datos a Equipo" : "Descargar Equipo a App";
        const sourceName = isExport ? "Base de Datos (App)" : "Memoria del Equipo";
        const targetName = isExport ? device.name : "Base de Datos (App)";
        const sourceCount = isExport ? dbStats.users : analysis.total;
        const targetDiff = isExport ? `~${dbStats.users}` : `+${analysis.new}`;
        const targetLabel = isExport ? "Identidades" : "Nuevos Usuarios";

        return (
            <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="w-full max-w-2xl bg-[#0c0c0c] border border-neutral-800 rounded-3xl shadow-2xl flex flex-col max-h-[90%] overflow-hidden">
                    <div className={cn("p-6 border-b border-white/5", isExport ? "bg-orange-500/5" : "bg-blue-500/5")}>
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

                    <div className="p-8 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between gap-8 mb-10">
                            <div className="flex-1 flex flex-col items-center gap-3">
                                <div className="p-4 rounded-full bg-neutral-900 border border-white/10 shadow-inner">
                                    {isExport ? <Database size={24} className="text-blue-500" /> : <HardDrive size={24} className="text-orange-500" />}
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mb-1">{sourceName}</p>
                                    <p className="text-4xl font-black text-white">{sourceCount}</p>
                                    <p className="text-[11px] font-bold text-neutral-600 uppercase">Identidades Detectadas</p>
                                </div>
                            </div>

                            <div className="flex flex-col items-center text-neutral-600 gap-3">
                                <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 border border-white/5 animate-pulse">
                                    <ArrowRightLeft size={16} className={isExport ? "text-orange-500" : "text-blue-500"} />
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col items-center gap-3">
                                <div className="p-4 rounded-full bg-neutral-900 border border-white/10 shadow-inner">
                                    {isExport ? <HardDrive size={24} className="text-orange-500" /> : <Database size={24} className="text-blue-500" />}
                                </div>
                                <div className="text-center">
                                    <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mb-1">{targetName}</p>
                                    <p className={cn("text-4xl font-black", isExport ? "text-orange-400" : "text-blue-400")}>{targetDiff}</p>
                                    <p className="text-[11px] font-bold text-neutral-600 uppercase">{targetLabel}</p>
                                </div>
                            </div>
                        </div>

                        {!isExport && (
                            <div className="space-y-6">
                                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                            <ListChecks size={14} /> Resumen de Diferencias
                                        </h4>
                                        <Badge className="bg-blue-500/20 text-blue-400 border-none text-[9px] font-black uppercase">{analysis.new} Novedades</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-neutral-950/50 p-4 rounded-xl border border-white/5">
                                            <p className="text-[9px] text-neutral-600 uppercase font-black mb-1">Rostros a Importar</p>
                                            <p className="text-xl font-black text-white">{analysis.faces}</p>
                                        </div>
                                        <div className="bg-neutral-950/50 p-4 rounded-xl border border-white/5">
                                            <p className="text-[9px] text-neutral-600 uppercase font-black mb-1">Tags / RFID</p>
                                            <p className="text-xl font-black text-white">{analysis.tags}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] px-1">Asignar a Residencia / Lote</label>
                                    <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                                        <SelectTrigger className="w-full bg-neutral-900/50 border-white/5 text-white h-14 rounded-2xl px-6 hover:bg-neutral-900 transition-all">
                                            <SelectValue placeholder="Seleccionar Unidad..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-2xl">
                                            <SelectItem value="none">Sin asignación (General / No Residente)</SelectItem>
                                            {units.map((u: any) => (
                                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {isExport && (
                            <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-6">
                                <div className="flex items-center gap-4 text-orange-400 mb-4">
                                    <AlertCircle size={20} />
                                    <h4 className="text-xs font-black uppercase tracking-widest">Advertencia de Sobrescritura</h4>
                                </div>
                                <p className="text-[11px] text-neutral-500 font-medium leading-relaxed uppercase">
                                    Esta acción volcará todos los usuarios de la base de datos local hacia el dispositivo.
                                    Los usuarios existentes en el equipo que no coincidan serán actualizados o mantenidos según la configuración del driver.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="p-5 bg-neutral-900 border-t border-white/5 flex gap-3">
                        <Button onClick={() => setSyncMode(null)} variant="ghost" className="flex-1 h-12 text-neutral-400 font-bold uppercase text-[10px]">Cancelar</Button>
                        <Button onClick={isExport ? startExport : startImport} className={cn("flex-[2] h-12 text-white font-black uppercase text-[10px]", isExport ? "bg-orange-600" : "bg-blue-600")}>
                            {isExport ? "Iniciar Volcado" : "Iniciar Importación"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const renderImportOverlay = () => {
        if (importStatus === 'idle') return null;
        return (
            <div className="absolute inset-0 bg-[#050505]/95 z-[60] flex flex-col items-center justify-center p-10 animate-in fade-in duration-500 backdrop-blur-md">
                {importStatus === 'importing' ? (
                    <div className="w-full max-w-md space-y-10 text-center">
                        <div className="relative mx-auto w-32 h-32">
                            <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping duration-[2000ms]" />
                            <div className="absolute inset-[-4px] border-2 border-dashed border-blue-500/20 rounded-full animate-spin duration-[8000ms]" />
                            <div className="relative z-10 w-full h-full bg-neutral-900 rounded-3xl border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl">
                                {currentImport?.FaceUrl ? (
                                    <img src={currentImport.FaceUrl} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <User size={40} className="text-blue-500/50 mb-1" />
                                        <span className="text-xs font-black text-neutral-600 uppercase tracking-tighter">Syncing</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-3">
                                <Loader2 className="animate-spin text-blue-500" size={24} />
                                Procesando Datos
                            </h3>
                            <p className="text-sm font-medium text-neutral-400">
                                Sincronizando: <span className="text-white font-black">{currentImport?.Name || '...'}</span>
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.2em]">Sincronización en curso</span>
                                <span className="text-xl font-black text-blue-500 italic">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/5 p-0.5">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            {/* Terminal Log */}
                            <div className="h-24 bg-black/40 rounded-xl border border-white/5 p-4 overflow-y-auto custom-scrollbar text-left font-mono text-[9px]">
                                <div className="space-y-1">
                                    <p className="text-blue-500/50 flex items-center gap-2">
                                        <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                                        Iniciando túnel seguro hacia {device.brand}...
                                    </p>
                                    <p className="text-neutral-500">[{new Date().toLocaleTimeString()}] Analizando {analysis.total} registros hardware.</p>
                                    {processedCount > 0 && (
                                        <p className="text-emerald-500/70 border-l border-emerald-500/30 pl-2">
                                            ✓ {currentImport?.Name || 'Objeto'} procesado ({processedCount}/{analysis.total})
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-center gap-12 pt-4">
                                <div className="text-center group">
                                    <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest group-hover:text-neutral-400 transition-colors">Completados</p>
                                    <p className="text-2xl font-black text-white">{processedCount}</p>
                                </div>
                                <div className="text-center group">
                                    <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest group-hover:text-neutral-400 transition-colors">Total Equipo</p>
                                    <p className="text-2xl font-black text-white">{analysis.total}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-md space-y-8 text-center animate-in zoom-in-95 duration-500">
                        <div className="mx-auto w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/20 text-emerald-500 mb-6 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
                            <CheckCircle2 size={48} />
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Finalizado con Éxito</h3>
                            <p className="text-neutral-500 font-medium text-sm">La base de datos local ha sido actualizada.</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-neutral-900/50 p-5 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-neutral-500 font-black uppercase mb-1">Total</p>
                                <p className="text-2xl text-white font-black">{importStats.success}</p>
                            </div>
                            <div className="bg-neutral-900/50 p-5 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-neutral-500 font-black uppercase mb-1">Rostros</p>
                                <p className="text-2xl text-blue-500 font-black">{importStats.faces}</p>
                            </div>
                            <div className="bg-neutral-900/50 p-5 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-neutral-500 font-black uppercase mb-1">Fallos</p>
                                <p className="text-2xl text-rose-500 font-black">{importStats.failed}</p>
                            </div>
                        </div>
                        <Button
                            onClick={resetImport}
                            className="w-full h-14 rounded-2xl bg-white hover:bg-neutral-200 text-black font-black uppercase tracking-widest text-xs transition-all shadow-xl"
                        >
                            Finalizar y Regresar
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    // --- FILTRADO DE TABLAS ---
    const filteredSystemUsers = systemUsers.filter(u =>
        u.name.toLowerCase().includes(syncSearch.toLowerCase()) ||
        u.unit?.name?.toLowerCase().includes(syncSearch.toLowerCase())
    );

    const filteredFaces = faces.filter(f => {
        const search = faceSearch.toLowerCase();
        return f.Name?.toLowerCase().includes(search) || f.UserID?.toLowerCase().includes(search) || f.CardCode?.toLowerCase().includes(search);
    });

    const filteredDoorlogs = doorlogs.filter(log =>
        (log.Name || '').toLowerCase().includes(doorlogFilter.toLowerCase())
    );

    const filteredCalllogs = calllogs.filter(log =>
        (log.Name || log.Remote || '').toLowerCase().includes(calllogFilter.toLowerCase())
    );

    // --- RENDERIZADO PRINCIPAL ---
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[98vw] lg:max-w-[1400px] 2xl:max-w-[1700px] bg-[#050505] border-white/5 p-0 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] transition-all duration-500 rounded-[2.5rem]">
                {renderConfirmOverlay()}
                {renderImportOverlay()}

                {/* Fixed height (Compressed) and wider layout to avoid jumps */}
                <div className="flex flex-col lg:flex-row h-[750px] min-h-[600px] max-h-[90vh] overflow-hidden">
                    {/* PANEL IZQUIERDO */}
                    <div className="w-full lg:w-[380px] bg-[#0a0a0a] border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col relative group/sidebar">
                        <div className="relative w-full aspect-[4/4.5] bg-[conic-gradient(from_0deg_at_50%_50%,#0c0c0c_0deg,#141414_360deg)] p-8 flex flex-col items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 bg-blue-500/[0.02] mix-blend-overlay" />

                            <div className="relative z-20 text-center space-y-2 mb-6">
                                <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[9px] font-black uppercase tracking-widest px-3">
                                    {device.brand} Terminal
                                </Badge>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{device.name}</h2>
                            </div>

                            <div className="relative w-full h-full flex items-center justify-center p-4 z-10 transition-all duration-700 group-hover/sidebar:scale-[1.05]">
                                <img
                                    src={
                                        device.modelPhoto ||
                                        DRIVER_MODELS[device.brand as keyof typeof DRIVER_MODELS]?.find((m: any) => m.value === device.deviceModel)?.photo ||
                                        DEVICE_MODELS[device.brand]?.[device.deviceType] ||
                                        DEVICE_MODELS[device.brand]?.DEFAULT ||
                                        BRAND_LOGOS[device.brand] ||
                                        "/placeholder-device.png"
                                    }
                                    alt={device.name}
                                    className="w-full h-full object-contain relative z-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                                />

                                {/* Overlay Controls */}
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover/sidebar:opacity-100 transition-all duration-500 flex items-center justify-center gap-3 z-30 rounded-[2rem] scale-90 group-hover/sidebar:scale-100 border border-white/10">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" onClick={() => setShowSync(!showSync)} className={cn("w-12 h-12 rounded-2xl transition-all shadow-xl", showSync ? "bg-blue-600 text-white" : "bg-neutral-900/80 text-white hover:bg-white hover:text-black")}>
                                                    <UserPlus size={22} />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="text-[10px] uppercase font-black">Inyectar Usuarios</TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" onClick={loadFaces} disabled={loading} className="w-12 h-12 bg-neutral-900/80 text-white hover:bg-white hover:text-black rounded-2xl transition-all shadow-xl">
                                                    <RefreshCw size={22} className={loading ? "animate-spin" : ""} />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="text-[10px] uppercase font-black">Refrescar Memoria</TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" onClick={handleDownloadAll} disabled={loading} className="w-12 h-12 bg-neutral-900/80 text-white hover:bg-white hover:text-black rounded-2xl transition-all shadow-xl">
                                                    <DownloadCloud size={22} />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent className="text-[10px] uppercase font-black">Importar Todo</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 p-8 pb-10 bg-[#0a0a0a] flex flex-col justify-between">
                            <div className="space-y-6">
                                <div className="bg-neutral-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group/stats hover:border-blue-500/30 transition-all">
                                    <div className="flex justify-between items-end mb-3 relative z-10">
                                        <div>
                                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5">Capacidad de Memoria</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-4xl font-black text-white tracking-tighter">{faces.length}</span>
                                                <span className="text-sm font-bold text-neutral-600">IDs Activos</span>
                                            </div>
                                        </div>
                                        <div className={cn("p-3 rounded-2xl", faces.length > 0 ? "bg-blue-500/10 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]" : "bg-neutral-800 text-neutral-600")}>
                                            <Users size={24} />
                                        </div>
                                    </div>
                                    <div className="w-full bg-neutral-800/50 h-2.5 rounded-full overflow-hidden relative z-10 border border-white/5 p-0.5">
                                        <div className="bg-gradient-to-r from-blue-600 to-indigo-400 h-full rounded-full transition-all duration-[1.5s] ease-out shadow-[0_0_10px_rgba(59,130,246,0.4)]" style={{ width: `${Math.min((faces.length / (device.brand === 'HIKVISION' ? 2048 : 20000)) * 100, 100)}%` }} />
                                    </div>
                                    <p className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.2em] mt-3 text-right">Límite Hardware: {device.brand === 'HIKVISION' ? '2,048' : '20,000'}</p>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <div className="p-4 bg-neutral-900 border border-white/5 rounded-[1.5rem] flex items-center justify-between group/ip hover:bg-neutral-800/50 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-500/5 rounded-xl">
                                                <Network size={16} className="text-blue-500" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-neutral-600 font-black uppercase mb-0.5 tracking-widest">Address IP / Host</p>
                                                <p className="text-sm font-mono font-black text-white/90">{device.ip}</p>
                                            </div>
                                        </div>
                                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Neural Health Widget */}
                            <div className="mt-6 space-y-4">
                                <div className="bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 border border-white/5 rounded-3xl p-5 backdrop-blur-md relative overflow-hidden group/health">
                                    <div className="absolute inset-0 bg-blue-500/[0.02] opacity-0 group-hover/health:opacity-100 transition-opacity" />
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-500/10 rounded-xl">
                                                <Activity size={18} className="text-emerald-500 animate-in zoom-in duration-700" />
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] block">Estado Neural</span>
                                                <span className="text-[9px] font-bold text-emerald-500/80 uppercase">Vincular Link Activo</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[8px] font-black text-neutral-600 uppercase block mb-1">Carga CPU</span>
                                            <span className="text-xs font-mono font-black text-white">4.2%</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 relative z-10">
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-neutral-600 uppercase">Integridad Memoria</span>
                                                <span className="text-sm font-black text-white">99.2%</span>
                                            </div>
                                            <div className="flex gap-0.5 h-3">
                                                {[1, 0.8, 0.9, 0.6, 1, 0.7, 0.9].map((h, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-1 bg-blue-500/40 rounded-full animate-pulse"
                                                        style={{ height: `${h * 100}%`, animationDelay: `${i * 150}ms` }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="h-1 bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 w-[99.2%] shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => onOpenChange(false)}
                                    variant="ghost"
                                    className="w-full h-12 rounded-2xl bg-neutral-900/50 hover:bg-neutral-900 text-neutral-500 font-black uppercase text-[10px] tracking-[0.2em] border border-white/5 transition-all"
                                >
                                    Cerrar Portal
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* PANEL DERECHO: TABS */}
                    <Tabs defaultValue="directory" className="flex-1 flex flex-col min-w-0 bg-[#080808] overflow-hidden">
                        <div className="p-8 pb-0 flex items-center justify-between border-b border-white/5">
                            <TabsList className="bg-neutral-900 border border-white/5 p-1 mb-[-1px]">
                                <TabsTrigger value="directory" className="text-[10px] font-black uppercase tracking-widest px-6 h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                                    <Users size={14} className="mr-2" /> Directorio Local
                                </TabsTrigger>
                                {device.brand === 'AKUVOX' && (
                                    <>
                                        <TabsTrigger value="doorlog" className="text-[10px] font-black uppercase tracking-widest px-6 h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                                            <History size={14} className="mr-2" /> Doorlog
                                        </TabsTrigger>
                                        <TabsTrigger value="calllog" className="text-[10px] font-black uppercase tracking-widest px-6 h-10 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                                            <Phone size={14} className="mr-2" /> Call Log
                                        </TabsTrigger>
                                    </>
                                )}
                            </TabsList>
                            <div className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-2">
                                <Shield size={14} className="text-emerald-500" /> Secure Access Active
                            </div>
                        </div>

                        {/* CONTENIDO DE DIRECTORIO */}
                        <TabsContent value="directory" className="flex-1 flex flex-col min-h-0 m-0 focus-visible:ring-0">
                            <DialogHeader className="p-8 pb-4">
                                <DialogTitle className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    {showSync ? <UserPlus className="text-blue-500" size={20} /> : <Users className="text-blue-500" size={20} />}
                                    {showSync ? "Inyección de Rostros" : `Directorio: ${device.name}`}
                                </DialogTitle>
                                <DialogDescription className="text-neutral-500 text-xs font-medium uppercase tracking-widest mt-1">
                                    {showSync ? "Sincroniza usuarios hacia el equipo" : "Listado de identidades en memoria física"}
                                </DialogDescription>
                            </DialogHeader>

                            {showSync ? (
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    <div className="px-8 pb-4">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Buscar usuario o unidad..."
                                                value={syncSearch}
                                                onChange={(e) => setSyncSearch(e.target.value)}
                                                className="w-full bg-neutral-900/50 border border-white/5 h-12 rounded-xl pl-12 text-sm text-white focus:border-blue-500/50 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-3 custom-scrollbar min-h-[500px]">
                                        {loading ? (
                                            <div className="flex flex-col items-center justify-center h-full text-neutral-700 gap-6">
                                                <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Consultando Memoria Hardware...</p>
                                            </div>
                                        ) : filteredSystemUsers.map(u => (
                                            <div key={u.id} className="bg-neutral-900/40 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between hover:bg-neutral-900 hover:border-blue-500/30 transition-all group/user">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden border border-white/10 shadow-2xl group-hover/user:scale-110 transition-transform duration-500">
                                                        <img src={u.cara || "https://ui-avatars.com/api/?name=" + u.name} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-base font-black text-white uppercase tracking-tight">{u.name}</p>
                                                        <div className="flex gap-2">
                                                            <Badge className="bg-neutral-800 text-neutral-400 text-[8px] font-black tracking-[0.1em]">{u.unit?.name || "PERSONAL"}</Badge>
                                                            {u.credentials?.some((c: any) => c.type === 'TAG') && <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[8px] font-black">RFID</Badge>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    disabled={isSyncing === u.id}
                                                    onClick={() => handleSync(u.id)}
                                                    className={cn(
                                                        "h-12 px-10 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all",
                                                        isSyncing === u.id ? "bg-neutral-800 text-neutral-500" : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:shadow-[0_0_40px_rgba(59,130,246,0.4)]"
                                                    )}
                                                >
                                                    {isSyncing === u.id ? <Loader2 className="animate-spin" size={18} /> : <span>Inyectar en Memoria</span>}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col min-h-0 px-8 pb-8 space-y-6">
                                    <div className="relative group/search">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within/search:text-blue-500 transition-colors" size={20} />
                                        <input
                                            type="text"
                                            placeholder="Filtrar por Nombre, ID o Tarjeta..."
                                            value={faceSearch}
                                            onChange={(e) => setFaceSearch(e.target.value)}
                                            className="w-full h-14 pl-14 pr-6 bg-neutral-900/50 border border-white/5 rounded-2xl text-[13px] font-bold text-white placeholder:text-neutral-600 focus:border-blue-500/30 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="border border-white/5 rounded-3xl overflow-hidden flex-1 flex flex-col bg-[#050505] shadow-2xl">
                                        <div className="overflow-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left border-separate border-spacing-0">
                                                <thead className="sticky top-0 z-10 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5">
                                                    <tr>
                                                        <th className="p-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Index</th>
                                                        <th className="p-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Identidad</th>
                                                        <th className="p-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center">Estado Sincr.</th>
                                                        <th className="p-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Credenciales</th>
                                                        <th className="p-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center">Snapshot</th>
                                                        <th className="p-5 text-[10px] font-black text-neutral-500 uppercase tracking-widest text-center">Gestionar</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.02]">
                                                    {filteredFaces.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="py-20 text-center">
                                                                <div className="flex flex-col items-center gap-4 opacity-20">
                                                                    <Users size={64} className="text-neutral-500" />
                                                                    <p className="text-[10px] font-black uppercase tracking-widest">No se encontraron identidades</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : filteredFaces.slice((directoryPage - 1) * itemsPerPage, directoryPage * itemsPerPage).map((f, idx) => (
                                                        <tr key={f.ID} className="group/row hover:bg-white/[0.02] transition-colors">
                                                            <td className="p-5">
                                                                <span className="text-[10px] font-mono font-black text-neutral-700">#{(directoryPage - 1) * itemsPerPage + idx + 1}</span>
                                                            </td>
                                                            <td className="p-5">
                                                                <p className="text-sm font-black text-white uppercase tracking-tight group-hover/row:text-blue-400 transition-colors">{f.Name}</p>
                                                                <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">ID: {f.ID}</p>
                                                            </td>
                                                            <td className="p-5 text-center">
                                                                <Badge className={cn(
                                                                    "text-[8px] font-black uppercase tracking-widest px-2",
                                                                    f.SyncStatus === 'IN_SYNC' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                                        f.SyncStatus === 'ONLY_HARDWARE' ? "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse" :
                                                                            "bg-neutral-800 text-neutral-500 border-white/5"
                                                                )}>
                                                                    {f.SyncStatus === 'IN_SYNC' ? 'Sincronizado' :
                                                                        f.SyncStatus === 'ONLY_HARDWARE' ? 'Solo Equipo' : 'Desconocido'}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex flex-col gap-1.5">
                                                                        {f.CardCode && (
                                                                            <div className="flex items-center gap-2 bg-neutral-900 px-2.5 py-1 rounded-lg border border-white/5">
                                                                                <Tag size={10} className="text-orange-500" />
                                                                                <span className="text-[10px] font-mono font-black text-neutral-300">{f.CardCode}</span>
                                                                            </div>
                                                                        )}
                                                                        {f.PIN && (
                                                                            <div className="flex items-center gap-2 bg-neutral-900 px-2.5 py-1 rounded-lg border border-white/5">
                                                                                <Shield size={10} className="text-blue-500" />
                                                                                <span className="text-[10px] font-mono font-black text-neutral-300">****</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-5">
                                                                <div className="w-12 h-12 rounded-[1rem] bg-neutral-900 border border-white/5 mx-auto overflow-hidden group-hover/row:scale-110 transition-transform duration-500 shadow-xl">
                                                                    {f.FaceUrl ? <img src={f.FaceUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-neutral-900"><User size={20} className="text-neutral-800" /></div>}
                                                                </div>
                                                            </td>
                                                            <td className="p-5 text-center">
                                                                <DeleteConfirmDialog
                                                                    id={f.ID}
                                                                    title={`ELIMINAR ACCESO: ${f.Name}`}
                                                                    onDelete={async () => {
                                                                        const success = await deleteDeviceFace(device.id, f.ID, f.UserID);
                                                                        if (!success) throw new Error("Fallo en la eliminación");
                                                                    }}
                                                                    onSuccess={() => {
                                                                        setFaces(prev => prev.filter(item => item.ID !== f.ID));
                                                                        toast.success("Rostro eliminado correctamente");
                                                                    }}
                                                                >
                                                                    <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-neutral-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all">
                                                                        <Trash2 size={18} />
                                                                    </Button>
                                                                </DeleteConfirmDialog>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="px-8 h-20 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-between shadow-2xl relative z-20">
                                            <div className="flex flex-col">
                                                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Página Actual</p>
                                                <p className="text-sm font-black text-white">{directoryPage} <span className="text-neutral-700 ml-1">de {Math.max(1, Math.ceil(filteredFaces.length / itemsPerPage))}</span></p>
                                            </div>
                                            <div className="flex gap-4">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={directoryPage === 1}
                                                    onClick={() => setDirectoryPage(p => p - 1)}
                                                    className="h-11 px-8 bg-neutral-900 border border-white/5 rounded-xl text-[10px] font-black uppercase text-neutral-400 hover:text-white transition-all shadow-xl"
                                                >
                                                    Previo
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={filteredFaces.length <= directoryPage * itemsPerPage}
                                                    onClick={() => setDirectoryPage(p => p + 1)}
                                                    className="h-11 px-8 bg-neutral-900 border border-white/5 rounded-xl text-[10px] font-black uppercase text-neutral-400 hover:text-white transition-all shadow-xl"
                                                >
                                                    Siguiente
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* TABS DE LOGS (AKUVOX ONLY) */}
                        {device.brand === 'AKUVOX' && (
                            <>
                                <TabsContent value="doorlog" className="flex-1 flex flex-col min-h-0 m-0 overflow-hidden">
                                    <div className="p-10 pb-6 flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-8 flex-1">
                                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                                                <History className="text-blue-500" size={28} /> Logs de Acceso
                                            </h3>
                                            <div className="relative max-w-sm flex-1 group/search">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within/search:text-blue-500 transition-colors" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por Sujeto..."
                                                    value={doorlogFilter}
                                                    onChange={(e) => {
                                                        setDoorlogFilter(e.target.value);
                                                        setDoorlogPage(1);
                                                    }}
                                                    className="w-full h-12 pl-12 pr-4 bg-neutral-900/50 border border-white/5 rounded-2xl text-[11px] uppercase font-black text-white focus:border-blue-500/20 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <Button onClick={loadLogs} disabled={loadingLogs} className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white h-12 px-8 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl">
                                            <RefreshCw size={16} className={cn("mr-2", loadingLogs && "animate-spin")} />
                                            {loadingLogs ? "Conectando..." : "Actualizar"}
                                        </Button>
                                    </div>
                                    <div className="flex-1 mx-10 mb-10 border border-white/5 rounded-[2.5rem] overflow-hidden bg-black/40 flex flex-col min-h-0 shadow-2xl relative">
                                        <div className="overflow-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left border-separate border-spacing-0">
                                                <thead className="bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-10 text-[10px] font-black text-neutral-600 uppercase tracking-widest border-b border-white/5">
                                                    <tr>
                                                        <th className="p-6 w-24 text-center">Bio-Info</th>
                                                        <th className="p-6">Sujeto / Identidad</th>
                                                        <th className="p-6">Timestamp Hardware</th>
                                                        <th className="p-6 text-center">Estado Decisión</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.02]">
                                                    {filteredDoorlogs.length === 0 ? (
                                                        <tr><td colSpan={4} className="py-32 text-center opacity-20"><div className="flex flex-col items-center gap-4"><History size={48} /><p className="text-[10px] font-black uppercase tracking-[0.3em]">Sin registros históricos</p></div></td></tr>
                                                    ) : filteredDoorlogs.slice((doorlogPage - 1) * itemsPerPage, doorlogPage * itemsPerPage).map((log, i) => (
                                                        <tr key={i} className="group/log hover:bg-white/[0.02] transition-colors">
                                                            <td className="p-6 text-center">
                                                                {(log.PicUrl || log.PicPath || log.pic_url || log.snap_path || log.PicName || log.ImageUrl) ? (
                                                                    <div
                                                                        onClick={() => {
                                                                            const path = log.PicUrl || log.PicPath || log.pic_url || log.snap_path || log.PicName || log.ImageUrl;
                                                                            setSelectedLogImage(`http://${window.location.hostname}:10000/api/proxy/device-image?deviceId=${device.id}&path=${encodeURIComponent(path)}`);
                                                                        }}
                                                                        className="relative w-16 h-16 rounded-2xl bg-neutral-900 border border-white/5 overflow-hidden mx-auto cursor-pointer group/thumb hover:ring-2 hover:ring-blue-500/50 hover:ring-offset-2 hover:ring-offset-black shadow-2xl transition-all duration-500"
                                                                    >
                                                                        <img
                                                                            src={`http://${window.location.hostname}:10000/api/proxy/device-image?deviceId=${device.id}&path=${encodeURIComponent(log.PicUrl || log.PicPath || log.pic_url || log.snap_path || log.PicName || log.ImageUrl)}`}
                                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-110"
                                                                            onError={(e) => { (e.target as any).src = "https://ui-avatars.com/api/?name=X&background=020202&color=444"; }}
                                                                        />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                                                            <Eye size={16} className="text-white" />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-16 h-16 rounded-2xl border border-dashed border-white/5 flex items-center justify-center mx-auto text-[8px] font-black text-neutral-600 uppercase bg-neutral-900/30">
                                                                        {log.Type || log.Event || 'Log'}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-6">
                                                                <div className="flex flex-col gap-1.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                                        <span className="font-black text-white uppercase text-base tracking-tight leading-none group-hover/log:text-blue-400 transition-colors">{log.Name || 'Sujeto Externo'}</span>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <span className="text-[9px] font-black text-blue-500/80 uppercase tracking-widest bg-blue-500/5 px-2 py-0.5 rounded-lg border border-blue-500/10">{log.Card || log.CardSn || 'MÉTODO VIRTUAL'}</span>
                                                                        <Badge className="text-[8px] font-black text-neutral-500 uppercase tracking-widest bg-neutral-950/80 border-white/5">HARDWARE ID: {log.LogID || 'N/A'}</Badge>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-6">
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <Calendar size={12} className="text-neutral-700" />
                                                                        <span className="text-[11px] font-black text-neutral-400 uppercase tracking-tighter">{log.Date || '-'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Clock size={12} className="text-blue-500/40" />
                                                                        <span className="text-sm font-mono font-black text-white">{log.Time || '-'}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-6 text-center">
                                                                <div className={cn(
                                                                    "inline-flex flex-col items-center gap-1.5 px-6 py-2 rounded-[1.25rem] border transition-all duration-500",
                                                                    log.Status === "0" || log.Status === 0
                                                                        ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400 group-hover/log:bg-emerald-500/10"
                                                                        : "bg-rose-500/5 border-rose-500/10 text-rose-400 group-hover/log:bg-rose-500/10"
                                                                )}>
                                                                    <div className={cn("w-1.5 h-1.5 rounded-full", log.Status === "0" || log.Status === 0 ? "bg-emerald-400 animate-pulse" : "bg-rose-400")} />
                                                                    <span className="text-[9px] font-black uppercase tracking-[0.1em]">{log.Status === "0" || log.Status === 0 ? "Admitido" : "Rechazado"}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="h-20 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-between px-10 shrink-0">
                                            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Página {doorlogPage} de {Math.max(1, Math.ceil(filteredDoorlogs.length / itemsPerPage))}</p>
                                            <div className="flex gap-3">
                                                <Button size="sm" variant="ghost" disabled={doorlogPage === 1} onClick={() => setDoorlogPage(p => p - 1)} className="h-11 px-8 bg-neutral-900 border border-white/5 rounded-xl text-[10px] font-black uppercase text-neutral-400 hover:text-white transition-all shadow-xl">Anterior</Button>
                                                <Button size="sm" variant="ghost" disabled={filteredDoorlogs.length <= doorlogPage * itemsPerPage} onClick={() => setDoorlogPage(p => p + 1)} className="h-11 px-8 bg-neutral-900 border border-white/5 rounded-xl text-[10px] font-black uppercase text-neutral-400 hover:text-white transition-all shadow-xl">Siguiente</Button>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="calllog" className="flex-1 flex flex-col min-h-0 m-0 overflow-hidden">
                                    <div className="p-10 pb-6 flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-8 flex-1">
                                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                                                <Phone className="text-blue-500" size={28} /> Historial de Llamadas
                                            </h3>
                                            <div className="relative max-w-sm flex-1 group/search">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within/search:text-blue-500 transition-colors" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Filtrar Llamada..."
                                                    value={calllogFilter}
                                                    onChange={(e) => {
                                                        setCalllogFilter(e.target.value);
                                                        setCalllogPage(1);
                                                    }}
                                                    className="w-full h-12 pl-12 pr-4 bg-neutral-900/50 border border-white/5 rounded-2xl text-[11px] uppercase font-black text-white focus:border-blue-500/20 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <Button onClick={loadCallLogs} disabled={loadingCallLogs} className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white h-12 px-8 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl">
                                            <RefreshCw size={16} className={cn("mr-2", loadingCallLogs && "animate-spin")} />
                                            {loadingCallLogs ? "Consultando..." : "Actualizar"}
                                        </Button>
                                    </div>
                                    <div className="flex-1 mx-10 mb-10 border border-white/5 rounded-[2.5rem] overflow-hidden bg-black/40 flex flex-col min-h-0 shadow-2xl relative">
                                        <div className="overflow-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left border-separate border-spacing-0">
                                                <thead className="bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-10 text-[10px] font-black text-neutral-600 uppercase tracking-widest border-b border-white/5">
                                                    <tr>
                                                        <th className="p-6">Timestamp / Fecha</th>
                                                        <th className="p-6">Interlocutor</th>
                                                        <th className="p-6 text-center">Sentido</th>
                                                        <th className="p-6 text-center">Estado Fin</th>
                                                        <th className="p-6 text-center">Duración</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/[0.02]">
                                                    {filteredCalllogs.length === 0 ? (
                                                        <tr><td colSpan={5} className="py-32 text-center opacity-20"><div className="flex flex-col items-center gap-4"><Phone size={48} /><p className="text-[10px] font-black uppercase tracking-[0.3em]">Sin llamadas registradas</p></div></td></tr>
                                                    ) : filteredCalllogs.slice((calllogPage - 1) * itemsPerPage, calllogPage * itemsPerPage).map((log, i) => (
                                                        <tr key={i} className="group/call hover:bg-blue-500/[0.02] transition-colors">
                                                            <td className="p-6">
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <Calendar size={12} className="text-neutral-700" />
                                                                        <span className="text-[10px] font-black text-neutral-400 uppercase">{log.Date || 'Hoy'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Clock size={12} className="text-blue-500/40" />
                                                                        <span className="text-sm font-mono font-black text-white">{log.Time}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-6">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="font-black text-white uppercase text-base tracking-tight group-hover/call:text-blue-400 transition-colors">
                                                                        {log.Name || log.Remote || 'Punto Remoto'}
                                                                    </span>
                                                                    <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">ID Destino: {log.Remote || 'Portería'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-6 text-center">
                                                                <div className={cn(
                                                                    "w-12 h-12 rounded-2xl flex flex-col items-center justify-center mx-auto transition-all duration-500 border border-transparent group-hover/call:border-white/5",
                                                                    log.Type === "0" ? "bg-blue-500/10 text-blue-500 group-hover/call:bg-blue-500/20" : "bg-emerald-500/10 text-emerald-500 group-hover/call:bg-emerald-500/20 group-hover/call:scale-110"
                                                                )}>
                                                                    {log.Type === "0" ? <PhoneIncoming size={20} /> : <PhoneOutgoing size={20} />}
                                                                    <span className="text-[7px] font-black mt-1 uppercase">{log.Type === "0" ? 'Entrante' : 'Saliente'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-6 text-center">
                                                                <div className={cn(
                                                                    "inline-flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all",
                                                                    log.Status === "1" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-rose-500/5 border-rose-500/20 text-rose-400"
                                                                )}>
                                                                    <div className={cn("w-1.5 h-1.5 rounded-full", log.Status === "1" ? "bg-emerald-400" : "bg-rose-400")} />
                                                                    <span className="text-[9px] font-black uppercase">{log.Status === "1" ? "Exitosa" : "No contestada"}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-6 text-center">
                                                                <div className="flex flex-col items-center bg-black/40 rounded-2xl p-3 border border-white/5 min-w-[80px]">
                                                                    <span className="text-xl font-mono font-black text-white italic tracking-tighter">{log.Duration || "0"}</span>
                                                                    <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Segundos</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="h-20 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-between px-10 shrink-0">
                                            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Página {calllogPage} de {Math.max(1, Math.ceil(filteredCalllogs.length / itemsPerPage))}</p>
                                            <div className="flex gap-3">
                                                <Button size="sm" variant="ghost" disabled={calllogPage === 1} onClick={() => setCalllogPage(p => p - 1)} className="h-11 px-8 bg-neutral-900 border border-white/5 rounded-xl text-[10px] font-black uppercase text-neutral-400 hover:text-white transition-all shadow-xl">Anterior</Button>
                                                <Button size="sm" variant="ghost" disabled={filteredCalllogs.length <= calllogPage * itemsPerPage} onClick={() => setCalllogPage(p => p + 1)} className="h-11 px-8 bg-neutral-900 border border-white/5 rounded-xl text-[10px] font-black uppercase text-neutral-400 hover:text-white transition-all shadow-xl">Siguiente</Button>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </>
                        )}
                    </Tabs>
                </div>

                {/* VISOR DE IMAGEN OVERLAY */}
                {selectedLogImage && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-8" onClick={() => setSelectedLogImage(null)}>
                        <div className="relative max-w-4xl bg-neutral-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                            <img src={selectedLogImage} className="max-w-full max-h-[85vh] object-contain shadow-2xl" />
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            className="absolute top-6 right-6 bg-black/60 hover:bg-black text-white rounded-2xl w-12 h-12 p-0 shadow-2xl backdrop-blur-md border border-white/10 transition-all hover:scale-110"
                                            onClick={() => setSelectedLogImage(null)}
                                        >
                                            <X size={24} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p className="text-[10px] font-black uppercase">Cerrar Visualización</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog >
    );
}