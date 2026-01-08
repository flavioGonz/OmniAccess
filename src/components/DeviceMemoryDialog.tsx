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
    Image as ImageIcon
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
                        <div className="flex items-center justify-between gap-8">
                            <div className="flex-1 flex flex-col items-center gap-3">
                                <div className="p-4 rounded-full bg-neutral-900 border border-white/10">
                                    {isExport ? <Database size={20} className="text-neutral-400" /> : <HardDrive size={20} className="text-neutral-400" />}
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-1">{sourceName}</p>
                                    <p className="text-3xl font-black text-white">{sourceCount}</p>
                                    <p className="text-[10px] font-bold text-neutral-600 uppercase">Totales</p>
                                </div>
                            </div>

                            <div className="flex flex-col items-center text-neutral-600 gap-2">
                                <div className="flex items-center gap-1 opacity-50">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className={cn("w-1 h-1 rounded-full animate-ping", isExport ? "bg-orange-500" : "bg-blue-500")} style={{ animationDelay: `${i * 75}ms` }} />
                                    ))}
                                </div>
                                <div className={cn("p-3 rounded-xl border border-white/5", isExport ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500")}>
                                    {isExport ? <ArrowRightLeft size={20} /> : <DownloadCloud size={20} />}
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col items-center gap-3">
                                <div className="p-4 rounded-full bg-neutral-900 border border-white/10">
                                    {isExport ? <HardDrive size={20} className="text-neutral-400" /> : <Database size={20} className="text-neutral-400" />}
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-1">{targetName}</p>
                                    <p className={cn("text-3xl font-black", isExport ? "text-orange-400" : "text-blue-400")}>{targetDiff}</p>
                                    <p className="text-[10px] font-bold text-neutral-600 uppercase">{targetLabel}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 bg-neutral-900/30 border border-white/5 rounded-2xl p-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 bg-black/20 p-3 rounded-lg">
                                    <div className="w-1 bg-neutral-700 h-6 rounded-full"></div>
                                    <div>
                                        <p className="text-[9px] text-neutral-500 uppercase font-black mb-0.5">Rostros</p>
                                        <p className="text-xs font-bold text-neutral-300">{isExport ? `${dbStats.users}` : `${analysis.faces}`}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 bg-black/20 p-3 rounded-lg">
                                    <div className="w-1 bg-neutral-700 h-6 rounded-full"></div>
                                    <div>
                                        <p className="text-[9px] text-neutral-500 uppercase font-black mb-0.5">Tags</p>
                                        <p className="text-xs font-bold text-neutral-300">{isExport ? `${dbStats.tags}` : `${analysis.tags}`}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {!isExport && (
                        <div className="px-8 pb-4">
                            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">Asignar Unidad / Lote</label>
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
            <div className="absolute inset-0 bg-[#080808] z-50 flex flex-col items-center justify-center p-10 animate-in fade-in duration-300">
                {importStatus === 'importing' ? (
                    <div className="w-full max-w-md space-y-8 text-center">
                        <div className="mx-auto w-24 h-24 relative">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                            <div className="relative z-10 w-24 h-24 bg-neutral-900 rounded-full border-2 border-blue-500 flex items-center justify-center overflow-hidden">
                                {currentImport?.FaceUrl ? <img src={currentImport.FaceUrl} className="w-full h-full object-cover" /> : <span className="text-2xl font-black text-blue-500">{currentImport?.Name?.charAt(0)}</span>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight animate-pulse">Importando Identidad...</h3>
                            <p className="text-sm font-medium text-neutral-400">Procesando: <span className="text-blue-400 font-bold">{currentImport?.Name}</span></p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase text-neutral-500">
                                <span>Progreso ({processedCount} / {analysis.total})</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-md space-y-8 text-center">
                        <div className="mx-auto w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/20 text-green-500 mb-6">
                            <CheckCircle2 size={48} />
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Importación Completada</h3>
                            <p className="text-neutral-400 font-medium text-sm">Se han sincronizado las identidades correctamente.</p>
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
                                <p className="text-xs text-neutral-500 font-black uppercase mb-1">Fallos</p>
                                <p className="text-2xl text-red-500 font-black">{importStats.failed}</p>
                            </div>
                        </div>
                        <Button onClick={resetImport} className="w-full h-12 rounded-xl bg-white text-black font-black uppercase">Finalizar</Button>
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
            <DialogContent className="max-w-[95vw] lg:max-w-[1400px] 2xl:max-w-[1600px] bg-neutral-950 border-neutral-800 p-0 overflow-hidden shadow-2xl transition-all duration-300">
                {renderConfirmOverlay()}
                {renderImportOverlay()}

                {/* Fixed height (Compressed) and wider layout to avoid jumps */}
                <div className="flex flex-col lg:flex-row h-[700px] min-h-[600px] max-h-[85vh] overflow-hidden">
                    {/* PANEL IZQUIERDO */}
                    <div className="w-full lg:w-80 bg-[#0c0c0c] border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col relative group/sidebar">
                        <div className="relative w-full aspect-[4/5] bg-gradient-to-b from-neutral-900 to-black p-6 flex flex-col items-center justify-center overflow-hidden">
                            <div className="absolute top-8 inset-x-0 z-20 text-center">
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter leading-none drop-shadow-xl">{device.name}</h2>
                            </div>
                            <div className="relative w-full h-full flex items-center justify-center p-4 z-10 transition-transform duration-500 group-hover/sidebar:scale-[1.02] mt-4">
                                <img
                                    src={device.modelPhoto || device.brandLogo || "https://ui-avatars.com/api/?name=Dev&background=random"}
                                    alt={device.name}
                                    className="w-full h-full object-contain relative z-10 drop-shadow-2xl"
                                />
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-14 bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl flex items-center gap-1 px-3 py-1 opacity-0 translate-y-4 group-hover/sidebar:opacity-100 group-hover/sidebar:translate-y-0 transition-all duration-300 z-30 shadow-2xl">
                                    <Button size="icon" variant="ghost" onClick={() => setShowSync(!showSync)} className={cn("rounded-xl transition-all", showSync && "bg-blue-600 text-white")}>
                                        <UserPlus size={18} />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={loadFaces} disabled={loading} className="text-neutral-400 rounded-xl">
                                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                                    </Button>
                                    <div className="w-px h-6 bg-white/10 mx-1" />
                                    <Button size="icon" variant="ghost" onClick={handleDownloadAll} disabled={loading} className="text-neutral-400 rounded-xl"><DownloadCloud size={18} /></Button>
                                    <Button size="icon" variant="ghost" onClick={handleExportRequest} disabled={loading} className="text-neutral-400 rounded-xl hover:text-orange-400"><UploadCloud size={18} /></Button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 p-8 bg-[#0c0c0c] flex flex-col justify-end pb-8">
                            <div className="space-y-6">
                                <div className="bg-neutral-900/50 p-5 rounded-2xl border border-white/5 relative overflow-hidden group/stats hover:border-blue-500/30 transition-colors">
                                    <div className="flex justify-between items-end mb-2 relative z-10">
                                        <div>
                                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Capacidad Usada</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-white tracking-tight">{faces.length}</span>
                                                <span className="text-xs font-bold text-neutral-600">/ {device.brand === 'HIKVISION' ? '2048' : '20k'}</span>
                                            </div>
                                        </div>
                                        <div className={cn("p-2 rounded-lg", faces.length > 0 ? "bg-blue-500/10 text-blue-400" : "bg-neutral-800 text-neutral-600")}>
                                            <Users size={18} />
                                        </div>
                                    </div>
                                    <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden relative z-10">
                                        <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min((faces.length / (device.brand === 'HIKVISION' ? 2048 : 20000)) * 100, 100)}%` }} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-neutral-900/30 rounded-xl border border-white/5">
                                        <p className="text-[9px] text-neutral-500 font-bold uppercase mb-1">IP Address</p>
                                        <p className="text-xs font-mono font-medium text-neutral-300">{device.ip}</p>
                                    </div>
                                    <div className="p-3 bg-neutral-900/30 rounded-xl border border-white/5">
                                        <p className="text-[9px] text-neutral-500 font-bold uppercase mb-1">Auth Type</p>
                                        <p className="text-xs font-mono font-medium text-neutral-300">{device.authType || 'Standard'}</p>
                                    </div>
                                </div>
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
                                            <div className="flex flex-col items-center justify-center h-full text-neutral-600 gap-4">
                                                <Loader2 className="animate-spin" size={32} />
                                                <p className="text-[10px] font-black uppercase tracking-widest leading-none">Leyendo Memoria del Equipo...</p>
                                            </div>
                                        ) : filteredSystemUsers.map(u => (
                                            <div key={u.id} className="bg-neutral-900/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                                        <img src={u.cara} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-white uppercase tracking-tight">{u.name}</p>
                                                        <p className="text-[10px] text-neutral-500 font-bold uppercase">{u.unit?.name || "SIN UNIDAD"}</p>
                                                    </div>
                                                </div>
                                                <Button disabled={isSyncing === u.id} onClick={() => handleSync(u.id)} className="h-9 px-4 rounded-xl bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all">
                                                    {isSyncing === u.id ? <Loader2 className="animate-spin" size={12} /> : "Inyectar"}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col min-h-0 px-8 pb-8 space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Buscar en memoria..."
                                            value={faceSearch}
                                            onChange={(e) => setFaceSearch(e.target.value)}
                                            className="w-full h-10 pl-10 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white"
                                        />
                                    </div>
                                    <div className="border border-white/5 rounded-2xl overflow-hidden flex-1 flex flex-col bg-black/20">
                                        <div className="overflow-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left">
                                                <thead className="sticky top-0 bg-[#0a0a0a] text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                                                    <tr className="border-b border-white/5">
                                                        <th className="p-4">Índice</th>
                                                        <th className="p-4">Usuario</th>
                                                        <th className="p-4">ID / Tag</th>
                                                        <th className="p-4 text-center">Foto</th>
                                                        <th className="p-4 text-center">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {filteredFaces.slice((directoryPage - 1) * itemsPerPage, directoryPage * itemsPerPage).map((f, idx) => (
                                                        <tr key={f.ID} className="hover:bg-neutral-900/50 transition-colors">
                                                            <td className="p-4 text-[10px] font-mono text-neutral-600">#{(directoryPage - 1) * itemsPerPage + idx + 1}</td>
                                                            <td className="p-4 text-xs font-bold text-white uppercase">{f.Name}</td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-2">
                                                                    <Tag size={12} className="text-amber-500" />
                                                                    <span className="text-xs font-mono text-neutral-300">{f.CardCode || f.UserID || '-'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/5 mx-auto overflow-hidden">
                                                                    {f.FaceUrl ? <img src={f.FaceUrl} className="w-full h-full object-cover" /> : <User size={14} className="text-neutral-800 m-3" />}
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <DeleteConfirmDialog
                                                                    id={f.ID}
                                                                    title={`ELIMINAR: ${f.Name}`}
                                                                    onDelete={async () => {
                                                                        const success = await deleteDeviceFace(device.id, f.ID, f.UserID);
                                                                        if (!success) throw new Error("Fail");
                                                                    }}
                                                                    onSuccess={() => {
                                                                        setFaces(prev => prev.filter(item => item.ID !== f.ID));
                                                                        toast.success("Eliminado");
                                                                    }}
                                                                >
                                                                    <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-red-500"><Trash2 size={14} /></Button>
                                                                </DeleteConfirmDialog>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="p-4 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-neutral-600 uppercase">Página {directoryPage}</span>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="ghost" disabled={directoryPage === 1} onClick={() => setDirectoryPage(p => p - 1)} className="h-8 border border-white/5 text-[10px] font-black text-neutral-400">Anterior</Button>
                                                <Button size="sm" variant="ghost" disabled={filteredFaces.length <= directoryPage * itemsPerPage} onClick={() => setDirectoryPage(p => p + 1)} className="h-8 border border-white/5 text-[10px] font-black text-neutral-400">Siguiente</Button>
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
                                    <div className="p-8 pb-4 flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-6 flex-1">
                                            <h3 className="text-xl font-black text-white uppercase flex items-center gap-3">
                                                <History className="text-blue-500" size={20} /> Logs de Acceso
                                            </h3>
                                            <div className="relative max-w-sm flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="Filtrar por nombre..."
                                                    value={doorlogFilter}
                                                    onChange={(e) => {
                                                        setDoorlogFilter(e.target.value);
                                                        setDoorlogPage(1);
                                                    }}
                                                    className="w-full h-10 pl-10 bg-neutral-900 border border-white/5 rounded-xl text-[10px] uppercase font-black text-white focus:border-blue-500/50 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <Button onClick={loadLogs} disabled={loadingLogs} className="bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white h-10 px-6 rounded-xl text-[10px] font-black uppercase ml-4">
                                            <RefreshCw size={14} className={cn("mr-2", loadingLogs && "animate-spin")} /> {loadingLogs ? "Leyendo..." : "Actualizar"}
                                        </Button>
                                    </div>
                                    <div className="flex-1 mx-8 mb-8 border border-white/5 rounded-2xl overflow-hidden bg-black/20 flex flex-col min-h-0">
                                        <div className="overflow-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left text-[11px] min-w-[700px]">
                                                <thead className="bg-[#0a0a0a] sticky top-0 uppercase text-neutral-500 font-black border-b border-white/5">
                                                    <tr>
                                                        <th className="p-4 w-20 text-center">Captura</th>
                                                        <th className="p-4">Sujeto</th>
                                                        <th className="p-4">Timestamp</th>
                                                        <th className="p-4 text-center">Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {filteredDoorlogs.length === 0 ? (
                                                        <tr><td colSpan={4} className="p-8 text-center text-neutral-600 text-xs font-bold uppercase">Sin registros</td></tr>
                                                    ) : filteredDoorlogs.slice((doorlogPage - 1) * itemsPerPage, doorlogPage * itemsPerPage).map((log, i) => (
                                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                                            <td className="p-4 text-center">
                                                                {(log.PicUrl || log.PicPath || log.pic_url || log.snap_path || log.PicName || log.ImageUrl) ? (
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const path = log.PicUrl || log.PicPath || log.pic_url || log.snap_path || log.PicName || log.ImageUrl;
                                                                                        setSelectedLogImage(`http://${window.location.hostname}:10000/api/proxy/device-image?deviceId=${device.id}&path=${encodeURIComponent(path)}`);
                                                                                    }}
                                                                                    className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/5 overflow-hidden mx-auto hover:border-blue-500 block shadow-lg transition-all hover:scale-110"
                                                                                >
                                                                                    <img
                                                                                        src={`http://${window.location.hostname}:10000/api/proxy/device-image?deviceId=${device.id}&path=${encodeURIComponent(log.PicUrl || log.PicPath || log.pic_url || log.snap_path || log.PicName || log.ImageUrl)}`}
                                                                                        className="w-full h-full object-cover"
                                                                                        onError={(e) => { (e.target as any).src = "https://ui-avatars.com/api/?name=X&background=020202&color=444"; }}
                                                                                    />
                                                                                </button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent><p className="text-[10px] uppercase font-black">Ver Captura Ampliada</p></TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-lg border border-dashed border-white/10 flex items-center justify-center mx-auto text-[8px] font-black text-neutral-600 uppercase">
                                                                        {log.Type || log.Event || '-'}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex flex-col">
                                                                    <span className="font-black text-white uppercase text-xs leading-none mb-1">{log.Name || 'Desconocido'}</span>
                                                                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">{log.Card || log.CardSn || 'PORTEO'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 font-mono text-neutral-400 whitespace-nowrap">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black text-neutral-500">{log.Date || '-'}</span>
                                                                    <span className="text-xs font-black text-neutral-300">{log.Time || '-'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <span className={cn("text-[9px] font-black uppercase px-2.5 py-1 rounded-md border",
                                                                    log.Status === "0" || log.Status === 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400")}>
                                                                    {log.Status === "0" || log.Status === 0 ? "ACCESO OK" : "DENEGADO"}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="p-4 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-between shrink-0">
                                            <span className="text-[10px] font-bold text-neutral-600 uppercase">Página {doorlogPage} de {Math.max(1, Math.ceil(filteredDoorlogs.length / itemsPerPage))}</span>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="ghost" disabled={doorlogPage === 1} onClick={() => setDoorlogPage(p => p - 1)} className="h-8 border border-white/5 text-[10px] font-black text-neutral-400 hover:bg-white/5">Anterior</Button>
                                                <Button size="sm" variant="ghost" disabled={filteredDoorlogs.length <= doorlogPage * itemsPerPage} onClick={() => setDoorlogPage(p => p + 1)} className="h-8 border border-white/5 text-[10px] font-black text-neutral-400 hover:bg-white/5">Siguiente</Button>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="calllog" className="flex-1 flex flex-col min-h-0 m-0 overflow-hidden">
                                    <div className="p-8 pb-4 flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-6 flex-1">
                                            <h3 className="text-xl font-black text-white uppercase flex items-center gap-3">
                                                <Phone className="text-blue-500" size={20} /> Historial de Llamadas
                                            </h3>
                                            <div className="relative max-w-sm flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="Filtrar por nombre o IP..."
                                                    value={calllogFilter}
                                                    onChange={(e) => {
                                                        setCalllogFilter(e.target.value);
                                                        setCalllogPage(1);
                                                    }}
                                                    className="w-full h-10 pl-10 bg-neutral-900 border border-white/5 rounded-xl text-[10px] uppercase font-black text-white focus:border-blue-500/50 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <Button onClick={loadCallLogs} disabled={loadingCallLogs} className="bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white h-10 px-6 rounded-xl text-[10px] font-black uppercase ml-4">
                                            <RefreshCw size={14} className={cn("mr-2", loadingCallLogs && "animate-spin")} /> {loadingCallLogs ? "Consultando..." : "Actualizar"}
                                        </Button>
                                    </div>
                                    <div className="flex-1 mx-8 mb-8 border border-white/5 rounded-2xl overflow-hidden bg-black/20 flex flex-col min-h-0">
                                        <div className="overflow-auto flex-1 custom-scrollbar">
                                            <table className="w-full text-left text-[11px] min-w-[700px]">
                                                <thead className="bg-[#0a0a0a] sticky top-0 uppercase text-neutral-500 font-black border-b border-white/5">
                                                    <tr>
                                                        <th className="p-4">Timestamp</th>
                                                        <th className="p-4">Remoto / Alias</th>
                                                        <th className="p-4 text-center">Tipo</th>
                                                        <th className="p-4 text-center">Estado</th>
                                                        <th className="p-4 text-center">Duración</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {filteredCalllogs.length === 0 ? (
                                                        <tr><td colSpan={5} className="p-8 text-center text-neutral-600 text-xs font-bold uppercase">Sin registros</td></tr>
                                                    ) : filteredCalllogs.slice((calllogPage - 1) * itemsPerPage, calllogPage * itemsPerPage).map((log, i) => (
                                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                                            <td className="p-4 font-mono text-neutral-400 whitespace-nowrap">{log.Time}</td>
                                                            <td className="p-4 font-black text-white uppercase">{log.Name || log.Remote || 'Portería'}</td>
                                                            <td className="p-4 text-center">
                                                                {log.Type === "0" ? <PhoneIncoming size={14} className="text-blue-400 mx-auto" /> : <PhoneOutgoing size={14} className="text-emerald-400 mx-auto" />}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <span className={cn("text-[9px] font-black uppercase px-2 py-1 rounded-lg border",
                                                                    log.Status === "1" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400")}>
                                                                    {log.Status === "1" ? "OK" : "MISSED"}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-center font-mono text-neutral-500">{log.Duration || "0"}s</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="p-4 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-between shrink-0">
                                            <span className="text-[10px] font-bold text-neutral-600 uppercase">Página {calllogPage} de {Math.max(1, Math.ceil(filteredCalllogs.length / itemsPerPage))}</span>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="ghost" disabled={calllogPage === 1} onClick={() => setCalllogPage(p => p - 1)} className="h-8 border border-white/5 text-[10px] font-black text-neutral-400 hover:bg-white/5">Anterior</Button>
                                                <Button size="sm" variant="ghost" disabled={filteredCalllogs.length <= calllogPage * itemsPerPage} onClick={() => setCalllogPage(p => p + 1)} className="h-8 border border-white/5 text-[10px] font-black text-neutral-400 hover:bg-white/5">Siguiente</Button>
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
                                            <Trash2 size={24} className="rotate-45" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p className="text-[10px] font-black uppercase">Cerrar Visualización</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}