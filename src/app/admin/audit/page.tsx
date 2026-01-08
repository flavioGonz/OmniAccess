"use client";

import { useEffect, useState } from "react";
import {
    getDevices,
} from "@/app/actions/devices";
import {
    syncHardwareLogs,
    syncHardwareCallLogs,
    getDeviceAccessEvents,
    previewHardwareLogs,
    previewHardwareCallLogs,
    getDeviceDoorlogs,
    getDeviceCalllogs
} from "@/app/actions/deviceMemory";
import { Button } from "@/components/ui/button";
import {
    ShieldCheck,
    RefreshCw,
    HardDrive,
    Database,
    Zap,
    DownloadCloud,
    Search,
    History,
    CheckCircle2,
    XCircle,
    Clock,
    User as UserIcon,
    ArrowRightLeft,
    Network,
    Globe,
    Activity,
    Lock,
    Unlock,
    Eye,
    ChevronRight,
    AlertCircle,
    Camera,
    ChevronDown,
    PhoneCall,
    DoorClosed
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

export default function AuditPage() {
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);

    // DB Logs Inspector State
    const [selectedDeviceLogs, setSelectedDeviceLogs] = useState<any | null>(null);
    const [dbLogs, setDbLogs] = useState<any[]>([]);
    const [dbLogsLimit, setDbLogsLimit] = useState(50);
    const [hardwareDoorLogs, setHardwareDoorLogs] = useState<any[]>([]);
    const [doorLogsOffset, setDoorLogsOffset] = useState(0);
    const [hardwareCallLogs, setHardwareCallLogs] = useState<any[]>([]);
    const [callLogsOffset, setCallLogsOffset] = useState(0);
    const [loadingDbLogs, setLoadingDbLogs] = useState(false);
    const [loadingHardwareLogs, setLoadingHardwareLogs] = useState(false);
    const [logsDialogOpen, setLogsDialogOpen] = useState(false);

    // Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [filterDecision, setFilterDecision] = useState<string>("ALL");
    const [filterType, setFilterType] = useState<string>("ALL");

    // Sync Preview State
    const [previewDevice, setPreviewDevice] = useState<any | null>(null);
    const [hardwarePreview, setHardwarePreview] = useState<any[]>([]);
    const [hardwareCallPreview, setHardwareCallPreview] = useState<any[]>([]);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const devs = await getDevices();
            setDevices(devs);
        } catch (error) {
            console.error("Error loading audit data:", error);
            toast.error("Error al cargar datos de auditoría");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenDbLogs = async (device: any) => {
        setSelectedDeviceLogs(device);
        setLogsDialogOpen(true);
        setLoadingDbLogs(true);
        setDbLogsLimit(50);
        setDoorLogsOffset(0);
        setCallLogsOffset(0);
        try {
            const logs = await getDeviceAccessEvents(device.id, 50);
            setDbLogs(logs);

            // Fetch hardware logs too for Akuvox
            if (device.brand === 'AKUVOX') {
                const hDoor = await getDeviceDoorlogs(device.id, 50, 0);
                const hCall = await getDeviceCalllogs(device.id, 50, 0);
                setHardwareDoorLogs(hDoor);
                setHardwareCallLogs(hCall);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error al obtener logs");
        } finally {
            setLoadingDbLogs(false);
        }
    };

    const handleLoadMoreLogs = async () => {
        if (!selectedDeviceLogs) return;
        setLoadingDbLogs(true);
        try {
            const newLimit = dbLogsLimit + 50;
            const newLogs = await getDeviceAccessEvents(selectedDeviceLogs.id, newLimit);
            setDbLogs(newLogs);
            setDbLogsLimit(newLimit);
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar más registros");
        } finally {
            setLoadingDbLogs(false);
        }
    };

    const handleLoadMoreHardwareDoorLogs = async () => {
        if (!selectedDeviceLogs) return;
        setLoadingHardwareLogs(true);
        try {
            const nextOffset = doorLogsOffset + 50;
            const moreLogs = await getDeviceDoorlogs(selectedDeviceLogs.id, 50, nextOffset);
            setHardwareDoorLogs(prev => [...prev, ...moreLogs]);
            setDoorLogsOffset(nextOffset);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingHardwareLogs(false);
        }
    };

    const handleLoadMoreHardwareCallLogs = async () => {
        if (!selectedDeviceLogs) return;
        setLoadingHardwareLogs(true);
        try {
            const nextOffset = callLogsOffset + 50;
            const moreLogs = await getDeviceCalllogs(selectedDeviceLogs.id, 50, nextOffset);
            setHardwareCallLogs(prev => [...prev, ...moreLogs]);
            setCallLogsOffset(nextOffset);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingHardwareLogs(false);
        }
    };

    const handleOpenPreview = async (device: any) => {
        setPreviewDevice(device);
        setPreviewDialogOpen(true);
        setLoadingPreview(true);
        try {
            const [doorPreview, callPreview] = await Promise.all([
                previewHardwareLogs(device.id),
                previewHardwareCallLogs(device.id)
            ]);
            setHardwarePreview(doorPreview);
            setHardwareCallPreview(callPreview);
        } catch (error) {
            console.error(error);
            toast.error("Error al consultar memoria del hardware");
            setPreviewDialogOpen(false);
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleSync = async (deviceId: string) => {
        setSyncing(deviceId);
        try {
            const [resDoor, resCall] = await Promise.all([
                syncHardwareLogs(deviceId),
                syncHardwareCallLogs(deviceId)
            ]);

            if (resDoor.success || resCall.success) {
                const total = (resDoor.count || 0) + (resCall.count || 0);
                toast.success(`Sincronizados ${total} eventos (Door: ${resDoor.count || 0}, Call: ${resCall.count || 0})`);
                if (selectedDeviceLogs) handleOpenDbLogs(selectedDeviceLogs);
                setPreviewDialogOpen(false);
            } else {
                toast.error("Error al sincronizar");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error al sincronizar con el dispositivo");
        } finally {
            setSyncing(null);
        }
    };

    const filteredDbLogs = dbLogs.filter(log => {
        const matchesSearch =
            (log.user?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.plateDetected || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.details || "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDecision = filterDecision === "ALL" || log.decision === filterDecision;
        const matchesType = filterType === "ALL" || log.accessType === filterType;

        return matchesSearch && matchesDecision && matchesType;
    });

    const filteredDoorLogs = hardwareDoorLogs.filter(log => {
        const matchesSearch =
            (log.Name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.Card || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.Event || "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDecision = filterDecision === "ALL" ||
            (filterDecision === "GRANT" && log.Status === "1") ||
            (filterDecision === "DENY" && log.Status === "0");

        return matchesSearch && matchesDecision;
    });

    const filteredCallLogs = hardwareCallLogs.filter(log => {
        const matchesSearch =
            (log.CallerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.CallerID || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.CalleeName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.CalleeID || "").toLowerCase().includes(searchQuery.toLowerCase());

        return matchesSearch;
    });

    return (
        <TooltipProvider>
            <div className="p-6 h-full flex flex-col space-y-8 animate-in fade-in duration-700 overflow-hidden">
                {/* Professional Header */}
                <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 p-4 rounded-3xl">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-inner group transition-all hover:scale-110">
                            <ShieldCheck className="text-blue-400 group-hover:rotate-[15deg] transition-transform duration-500" size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 uppercase tracking-tight">
                                Auditoría de Hardware
                            </h1>
                            <p className="text-sm text-neutral-500 font-medium tracking-tight">Control integral de registros locales y sincronización forzada.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={loadData}
                            disabled={loading}
                            className="bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white font-bold uppercase tracking-widest text-[10px] h-12 rounded-xl"
                        >
                            <RefreshCw size={14} className={cn("mr-2", loading && "animate-spin")} />
                            Actualizar
                        </Button>
                        <Button
                            onClick={() => toast.info("Función de pull masivo deshabilitada temporalmente por seguridad")}
                            disabled={loading}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black uppercase tracking-widest text-xs h-12 px-8 rounded-xl shadow-xl shadow-blue-900/20"
                        >
                            <Zap size={16} className="mr-2 fill-current" />
                            Pull Automático
                        </Button>
                    </div>
                </header>

                <div className="flex-1 bg-black/40 border border-white/5 rounded-3xl overflow-hidden flex flex-col mt-0 shadow-2xl backdrop-blur-sm">
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <Table>
                            <TableHeader className="bg-neutral-900/40 sticky top-0 z-10 backdrop-blur-md border-b border-white/5">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="text-neutral-500 font-black tracking-widest py-6 px-8 uppercase text-[10px]">Identificación & Marca</TableHead>
                                    <TableHead className="text-neutral-500 font-black tracking-widest uppercase text-[10px]">Direccionamiento IP</TableHead>
                                    <TableHead className="text-neutral-500 font-black tracking-widest uppercase text-[10px]">Ubicación & Punto</TableHead>
                                    <TableHead className="text-neutral-500 font-black tracking-widest uppercase text-[10px]">Estado de Sincro</TableHead>
                                    <TableHead className="text-right text-neutral-500 font-black tracking-widest pr-12 uppercase text-[10px]">Control de Auditoría</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {devices.map(dev => {
                                    const isOnline = (Date.now() - new Date(dev.lastOnlinePull || 0).getTime()) < 300000;
                                    const canSync = dev.brand === 'AKUVOX';

                                    return (
                                        <TableRow key={dev.id} className="border-white/5 hover:bg-white/[0.03] transition-all group">
                                            <TableCell className="py-6 px-8">
                                                <div className="flex items-center gap-5">
                                                    <div className="relative w-14 h-14 bg-neutral-950 rounded-2xl border border-white/10 flex items-center justify-center p-0 shadow-xl group-hover:scale-110 transition-transform overflow-hidden">
                                                        {dev.modelPhoto ? (
                                                            <img src={dev.modelPhoto} className="w-full h-full object-cover" alt="" />
                                                        ) : dev.brandLogo ? (
                                                            <img src={dev.brandLogo} className="w-full h-full object-contain p-2 opacity-60" alt="" />
                                                        ) : (
                                                            <Network className="text-neutral-700" size={24} />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-white text-[13px] uppercase tracking-tight leading-none mb-1.5">{dev.name}</p>
                                                        <div className="flex items-center gap-2">
                                                            <Badge className="bg-neutral-900 text-neutral-500 border-white/5 text-[8px] font-black uppercase tracking-widest h-5">
                                                                {dev.brand}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2 text-sm text-neutral-200 font-black font-mono">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                                                        {dev.ip}
                                                    </div>
                                                    <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest pl-3.5">API v2.0</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2 text-xs text-blue-400 font-black uppercase tracking-tight">
                                                        <Globe size={12} /> {dev.location || "Central"}
                                                    </div>
                                                    <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest pl-4.5">{dev.direction}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-neutral-900 border border-white/5 w-fit">
                                                        <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500")} />
                                                        <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{isOnline ? "CONECTADO" : "SIN CONEXIÓN"}</span>
                                                    </div>
                                                    <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-tighter pl-1">
                                                        {dev.lastOnlinePull ? new Date(dev.lastOnlinePull).toLocaleString() : 'PENDIENTE'}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-12">
                                                <div className="flex items-center justify-end gap-4">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                onClick={() => handleOpenDbLogs(dev)}
                                                                className="w-10 h-10 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all shadow-lg"
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-neutral-900 border-neutral-800 text-[10px] uppercase font-black tracking-widest text-white">
                                                            Ver Logs en DB
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                onClick={() => handleOpenPreview(dev)}
                                                                disabled={!canSync || syncing === dev.id}
                                                                className={cn(
                                                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg",
                                                                    canSync ? "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/20" : "bg-neutral-900 text-neutral-700 cursor-not-allowed border border-white/5"
                                                                )}
                                                            >
                                                                <DownloadCloud size={18} />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-neutral-900 border-neutral-800 text-[10px] uppercase font-black tracking-widest text-white">
                                                            Sincronizar Memoria
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Dialog: DB Logs Viewer */}
                <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
                    <DialogContent className="max-w-5xl h-[85vh] flex flex-col bg-neutral-950 border border-white/10 p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl">
                        <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-neutral-900/40 shrink-0">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                        <Database className="text-blue-400" size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <DialogTitle className="text-xl font-black text-white uppercase tracking-tight">Inspector de Eventos</DialogTitle>
                                        <DialogDescription className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">
                                            Historial para {selectedDeviceLogs?.name} • Registros en Tiempo Real
                                        </DialogDescription>
                                    </div>
                                </div>

                                <Tabs defaultValue="db" className="h-10">
                                    <TabsList className="bg-neutral-900 border border-white/5 p-1 h-10">
                                        <TabsTrigger value="db" className="text-[10px] px-5 font-black uppercase tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all">
                                            Base de Datos
                                        </TabsTrigger>
                                        {selectedDeviceLogs?.brand === 'AKUVOX' && (
                                            <>
                                                <TabsTrigger value="door" className="text-[10px] px-5 font-black uppercase tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all">
                                                    Doorlog
                                                </TabsTrigger>
                                                <TabsTrigger value="call" className="text-[10px] px-5 font-black uppercase tracking-widest data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all">
                                                    Calllog
                                                </TabsTrigger>
                                            </>
                                        )}
                                    </TabsList>
                                </Tabs>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Search and Filters Strip */}
                            <div className="px-6 py-3 border-b border-white/5 bg-black/40 flex flex-wrap items-center gap-4 shrink-0">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                                    <Input
                                        placeholder="Buscar por usuario, patente o detalle..."
                                        className="pl-10 h-10 bg-neutral-900 border-white/5 text-[11px] font-bold uppercase"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        className="h-10 bg-neutral-900 border border-white/5 rounded-xl px-3 text-[10px] font-black uppercase text-neutral-400 focus:outline-none"
                                        value={filterDecision}
                                        onChange={(e) => setFilterDecision(e.target.value)}
                                    >
                                        <option value="ALL">Todas las Decisiones</option>
                                        <option value="GRANT">Éxito</option>
                                        <option value="DENY">Denegado</option>
                                    </select>
                                    <select
                                        className="h-10 bg-neutral-900 border border-white/5 rounded-xl px-3 text-[10px] font-black uppercase text-neutral-400 focus:outline-none"
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value)}
                                    >
                                        <option value="ALL">Todos los Tipos</option>
                                        <option value="FACE">Facial</option>
                                        <option value="TAG">RFID / Tag</option>
                                        <option value="PLATE">Patente</option>
                                        <option value="PIN">Código PIN</option>
                                    </select>
                                </div>
                                <div className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-2">
                                    {filteredDbLogs.length} Resultados
                                </div>
                            </div>

                            <Tabs defaultValue="db" className="flex-1 flex flex-col min-h-0">
                                <TabsContent value="db" className="flex-1 h-full m-0 outline-none overflow-hidden">
                                    <div className="h-full overflow-auto custom-scrollbar">
                                        {loadingDbLogs ? (
                                            <div className="h-full flex flex-col items-center justify-center gap-4 opacity-50">
                                                <RefreshCw className="animate-spin text-blue-500" size={32} />
                                                <p className="text-[10px] font-black uppercase text-neutral-600 tracking-widest">Consultando DB...</p>
                                            </div>
                                        ) : filteredDbLogs.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30">
                                                <History size={48} />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Sin registros encontrados con estos filtros</p>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader className="bg-neutral-900/50 sticky top-0 z-10 border-b border-white/5 backdrop-blur-md">
                                                    <TableRow className="hover:bg-transparent border-none">
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4">Captura</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-left">Sujeto / Identidad</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-center">Tipo</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4">Fecha / Hora</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-right">Resultado</th>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredDbLogs.map((log) => (
                                                        <TableRow key={log.id} className="border-white/5 hover:bg-white/[0.02]">
                                                            <TableCell className="p-4">
                                                                <div className="w-14 h-14 rounded-xl bg-neutral-950 border border-white/10 flex items-center justify-center overflow-hidden shadow-inner group relative">
                                                                    {log.snapshotPath || log.imagePath ? (
                                                                        <img
                                                                            src={log.snapshotPath || log.imagePath}
                                                                            alt=""
                                                                            className="w-full h-full object-cover transition-transform group-hover:scale-125"
                                                                            onError={(e) => {
                                                                                const target = e.target as HTMLImageElement;
                                                                                target.style.display = 'none';
                                                                                target.parentElement?.querySelector('.fallback')?.classList.remove('hidden');
                                                                            }}
                                                                        />
                                                                    ) : null}
                                                                    <div className={cn("fallback flex items-center justify-center", (log.snapshotPath || log.imagePath) ? "hidden" : "")}>
                                                                        <Camera size={20} className="text-neutral-800" />
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="p-4">
                                                                <p className="text-[13px] font-black text-white uppercase tracking-tight">{log.user?.name || log.plateDetected || "No Identificado"}</p>
                                                                <p className="text-[9px] font-bold text-neutral-500 uppercase mt-0.5 max-w-[200px] truncate">{log.details}</p>
                                                            </TableCell>
                                                            <TableCell className="p-4 text-center">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <Badge className={cn(
                                                                        "text-[8px] font-black px-2 py-0.5 h-auto uppercase tracking-tighter",
                                                                        log.direction === 'ENTRY' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                                                    )}>
                                                                        {log.direction === 'ENTRY' ? 'Entrada' : 'Salida'}
                                                                    </Badge>
                                                                    <p className="text-[8px] font-black text-neutral-600 uppercase">{log.accessType}</p>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="p-4">
                                                                <div className="flex flex-col">
                                                                    <p className="text-[10px] font-black text-neutral-400 font-mono">{new Date(log.timestamp).toLocaleDateString()}</p>
                                                                    <p className="text-[12px] font-black text-white font-mono">{new Date(log.timestamp).toLocaleTimeString()}</p>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="p-4 text-right">
                                                                <div className={cn(
                                                                    "inline-flex px-3 py-1.5 rounded-xl text-[9px] font-black border uppercase tracking-widest",
                                                                    log.decision === 'GRANT' ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/20" : "bg-rose-600/10 text-rose-400 border-rose-500/20"
                                                                )}>
                                                                    {log.decision === 'GRANT' ? "ADMITIDO" : "DENEGADO"}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="door" className="flex-1 h-full m-0 outline-none overflow-hidden">
                                    <div className="h-full overflow-auto custom-scrollbar">
                                        {filteredDoorLogs.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30">
                                                <DoorClosed size={48} />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Sin coincidencias en el hardware</p>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader className="bg-neutral-900/50 sticky top-0 z-10 border-b border-white/5 backdrop-blur-md">
                                                    <TableRow className="border-none">
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-left">Sujeto / Identidad</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-center">Modo / Evento</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-right">Hora</th>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredDoorLogs.map((log, idx) => (
                                                        <TableRow key={idx} className="border-white/5 hover:bg-white/[0.02]">
                                                            <TableCell className="p-4">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 rounded-xl bg-neutral-950 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                                                        {log.PicUrl ? (
                                                                            <img
                                                                                src={`/api/proxy/device-image?deviceId=${selectedDeviceLogs?.id}&path=${encodeURIComponent(log.PicUrl)}`}
                                                                                alt=""
                                                                                className="w-full h-full object-cover"
                                                                                onError={(e) => {
                                                                                    const target = e.target as HTMLImageElement;
                                                                                    target.style.display = 'none';
                                                                                    target.parentElement?.querySelector('.fallback')?.classList.remove('hidden');
                                                                                }}
                                                                            />
                                                                        ) : null}
                                                                        <div className={cn("fallback flex items-center justify-center", log.PicUrl ? "hidden" : "")}>
                                                                            <Camera size={18} className="text-neutral-800" />
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[13px] font-black text-white uppercase tracking-tight">{log.Name || "Desconocido"}</p>
                                                                        <p className="text-[9px] font-bold text-neutral-600 uppercase mt-0.5">{log.Card || 'Sin ID'}</p>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="p-4 text-center">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <Badge variant="outline" className={cn(
                                                                        "text-[8px] font-black uppercase px-2 py-0.5",
                                                                        log.Status === "1" ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" : "text-rose-500 border-rose-500/20 bg-rose-500/5"
                                                                    )}>
                                                                        {log.Event || 'ACCESO'}
                                                                    </Badge>
                                                                    <p className="text-[8px] font-black text-neutral-700 uppercase tracking-widest">{log.Mode || 'BIO'}</p>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="p-4 text-right text-[10px] font-mono text-neutral-500">{log.Time}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                        {hardwareDoorLogs.length > 0 && hardwareDoorLogs.length % 50 === 0 && (
                                            <div className="p-8 flex justify-center border-t border-white/5 bg-black/20">
                                                <Button
                                                    onClick={handleLoadMoreHardwareDoorLogs}
                                                    disabled={loadingHardwareLogs}
                                                    variant="outline"
                                                    className="bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white font-bold uppercase tracking-widest text-[9px] h-10 px-8 rounded-xl"
                                                >
                                                    {loadingHardwareLogs ? <RefreshCw size={12} className="animate-spin mr-2" /> : <ChevronDown size={14} className="mr-2" />}
                                                    Cargar más logs de Hardware
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="call" className="flex-1 h-full m-0 outline-none overflow-hidden">
                                    <div className="h-full overflow-auto custom-scrollbar">
                                        {filteredCallLogs.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30">
                                                <PhoneCall size={48} />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Sin coincidencias de llamadas</p>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader className="bg-neutral-900/50 sticky top-0 z-10 border-b border-white/5 backdrop-blur-md">
                                                    <TableRow className="border-none">
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4">De</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4">Hacia</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-center">Estado</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-right">Hora / Duración</th>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredCallLogs.map((log, idx) => (
                                                        <TableRow key={idx} className="border-white/5 hover:bg-white/[0.02]">
                                                            <TableCell className="p-4">
                                                                <p className="text-[13px] font-black text-white uppercase tracking-tight">{log.CallerName || "EXTERNO"}</p>
                                                                <p className="text-[8px] font-bold text-neutral-600 uppercase">{log.CallerID}</p>
                                                            </TableCell>
                                                            <TableCell className="p-4">
                                                                <p className="text-[13px] font-black text-white uppercase tracking-tight">{log.CalleeName || "CONSERJERÍA"}</p>
                                                                <p className="text-[8px] font-bold text-neutral-600 uppercase">{log.CalleeID}</p>
                                                            </TableCell>
                                                            <TableCell className="p-4 text-center">
                                                                <Badge className="bg-neutral-950 border border-white/10 text-[8px] font-black uppercase tracking-widest text-blue-400 px-3 py-1.5 rounded-xl">
                                                                    {log.Result}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="p-4 text-right">
                                                                <p className="text-[10px] font-mono text-neutral-400">{log.Time}</p>
                                                                <p className="text-[12px] font-mono font-black text-white">{log.TalkTime}s</p>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                        {hardwareCallLogs.length > 0 && hardwareCallLogs.length % 50 === 0 && (
                                            <div className="p-8 flex justify-center border-t border-white/5 bg-black/20">
                                                <Button
                                                    onClick={handleLoadMoreHardwareCallLogs}
                                                    disabled={loadingHardwareLogs}
                                                    variant="outline"
                                                    className="bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white font-bold uppercase tracking-widest text-[9px] h-10 px-8 rounded-xl"
                                                >
                                                    {loadingHardwareLogs ? <RefreshCw size={12} className="animate-spin mr-2" /> : <ChevronDown size={14} className="mr-2" />}
                                                    Cargar más llamadas de Hardware
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        <DialogFooter className="p-5 bg-black/40 border-t border-white/5 shrink-0">
                            <Button onClick={() => setLogsDialogOpen(false)} className="bg-neutral-900 hover:bg-white hover:text-black border border-white/10 text-white font-black uppercase text-[10px] tracking-widest px-10 h-11 rounded-2xl transition-all">Cerrar Inspector</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Dialog: Sync Preview Comparison */}
                <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
                    <DialogContent className="max-w-5xl bg-neutral-950 border-neutral-800 p-0 overflow-hidden shadow-2xl rounded-3xl">
                        <DialogHeader className="p-8 pb-4 border-b border-white/5 bg-neutral-900/20">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                                    <ArrowRightLeft className="text-orange-400" size={24} />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight">Sincronización de Memoria</DialogTitle>
                                    <DialogDescription className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">
                                        Comparando hardware físico con base de datos para {previewDevice?.name}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="h-[450px] overflow-auto custom-scrollbar p-6">
                            {loadingPreview ? (
                                <div className="h-full flex flex-col items-center justify-center gap-6">
                                    <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.3em] animate-pulse">Escaneando memoria física...</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <Tabs defaultValue="door" className="h-full flex flex-col">
                                        <TabsList className="flex gap-2 p-1 bg-white/5 rounded-xl mb-6 w-fit h-auto">
                                            <TabsTrigger value="door" className="text-[10px] font-black uppercase px-4 py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white rounded-lg transition-all">Accesos ({hardwarePreview.length})</TabsTrigger>
                                            <TabsTrigger value="call" className="text-[10px] font-black uppercase px-4 py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white rounded-lg transition-all">Llamadas ({hardwareCallPreview.length})</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="door" className="flex-1 overflow-auto custom-scrollbar">
                                            <div className="grid grid-cols-3 gap-6 mb-8">
                                                <div className="bg-neutral-900/50 p-6 rounded-2xl border border-white/5">
                                                    <p className="text-[9px] font-black text-neutral-600 uppercase mb-2">Total en Memoria</p>
                                                    <p className="text-3xl font-black text-white">{hardwarePreview.length}</p>
                                                </div>
                                                <div className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/10">
                                                    <p className="text-[9px] font-black text-emerald-600 uppercase mb-2">Ya registrados</p>
                                                    <p className="text-3xl font-black text-emerald-400">{hardwarePreview.filter(p => p.exists).length}</p>
                                                </div>
                                                <div className="bg-blue-500/5 p-6 rounded-2xl border border-blue-500/10">
                                                    <p className="text-[9px] font-black text-blue-600 uppercase mb-2">Nuevos por importar</p>
                                                    <p className="text-3xl font-black text-blue-400">{hardwarePreview.filter(p => !p.exists).length}</p>
                                                </div>
                                            </div>

                                            <Table>
                                                <TableHeader className="bg-neutral-900/30 sticky top-0">
                                                    <TableRow className="border-white/5 hover:bg-transparent">
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4">Fecha / Hora (Hardware)</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4">Individuo</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4">Estado</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-right">Situación</th>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {hardwarePreview.map((log, idx) => (
                                                        <TableRow key={idx} className="border-white/5">
                                                            <TableCell className="p-4 text-xs font-mono font-bold text-neutral-400">{log.Time}</TableCell>
                                                            <TableCell className="p-4">
                                                                <p className="text-xs font-black text-white uppercase">{log.Name || log.Card || "DESCONOCIDO"}</p>
                                                                <p className="text-[9px] font-bold text-neutral-600 uppercase">{log.Mode || "BIO"}</p>
                                                            </TableCell>
                                                            <TableCell className="p-4">
                                                                <Badge variant="outline" className={cn(
                                                                    "text-[8px] font-black",
                                                                    log.Status === "1" ? "border-emerald-500/20 text-emerald-500" : "border-rose-500/20 text-rose-500"
                                                                )}>
                                                                    {log.Status === "1" ? "ADMITIDO" : "DENEGADO"}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="p-4 text-right">
                                                                {log.exists ? (
                                                                    <div className="flex items-center justify-end gap-2 text-emerald-500 text-[9px] font-black uppercase">
                                                                        <CheckCircle2 size={12} /> Persistido
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-end gap-2 text-blue-400 text-[9px] font-black uppercase animate-pulse">
                                                                        <AlertCircle size={12} /> Pendiente
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TabsContent>

                                        <TabsContent value="call" className="flex-1 overflow-auto custom-scrollbar">
                                            <div className="grid grid-cols-2 gap-6 mb-8">
                                                <div className="bg-neutral-900/50 p-6 rounded-2xl border border-white/5">
                                                    <p className="text-[9px] font-black text-neutral-600 uppercase mb-2">Total Llamadas</p>
                                                    <p className="text-3xl font-black text-white">{hardwareCallPreview.length}</p>
                                                </div>
                                                <div className="bg-blue-500/5 p-6 rounded-2xl border border-blue-500/10">
                                                    <p className="text-[9px] font-black text-blue-600 uppercase mb-2">Pendientes de Sincr.</p>
                                                    <p className="text-3xl font-black text-blue-400">{hardwareCallPreview.filter(p => !p.exists).length}</p>
                                                </div>
                                            </div>

                                            <Table>
                                                <TableHeader className="bg-neutral-900/30 sticky top-0">
                                                    <TableRow className="border-white/5 hover:bg-transparent">
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-left">Origen / Destino</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-center">Duración / Resultado</th>
                                                        <th className="text-[9px] font-black text-neutral-500 uppercase p-4 text-right">Estado</th>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {hardwareCallPreview.map((log, idx) => (
                                                        <TableRow key={idx} className="border-white/5">
                                                            <TableCell className="p-4">
                                                                <p className="text-xs font-black text-white uppercase">{log.CallerID} → {log.CalleeID}</p>
                                                                <p className="text-[9px] font-bold text-neutral-600 uppercase">{log.Time}</p>
                                                            </TableCell>
                                                            <TableCell className="p-4 text-center">
                                                                <p className="text-xs font-black text-white">{log.TalkTime}s</p>
                                                                <p className="text-[9px] font-bold text-neutral-600 uppercase">{log.Result}</p>
                                                            </TableCell>
                                                            <TableCell className="p-4 text-right">
                                                                {log.exists ? (
                                                                    <div className="flex items-center justify-end gap-2 text-emerald-500 text-[9px] font-black uppercase">
                                                                        <CheckCircle2 size={12} /> Persistido
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-end gap-2 text-blue-400 text-[9px] font-black uppercase animate-pulse">
                                                                        <AlertCircle size={12} /> Pendiente
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            )}
                        </div>
                        <DialogFooter className="p-8 bg-neutral-900/20 border-t border-white/5 gap-3 shrink-0">
                            <Button variant="ghost" onClick={() => setPreviewDialogOpen(false)} className="text-neutral-500 font-black uppercase text-[10px] tracking-widest px-6 h-12">Cancelar</Button>
                            <Button
                                disabled={loadingPreview || syncing === previewDevice?.id || (hardwarePreview.filter(p => !p.exists).length === 0 && hardwareCallPreview.filter(p => !p.exists).length === 0)}
                                onClick={() => handleSync(previewDevice?.id)}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest px-10 h-12 rounded-xl shadow-xl shadow-blue-500/20"
                            >
                                {syncing === previewDevice?.id ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Zap size={16} className="mr-2 fill-current" />}
                                {syncing === previewDevice?.id ? "Procesando..." : `Importar ${hardwarePreview.filter(p => !p.exists).length + hardwareCallPreview.filter(p => !p.exists).length} Registros`}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

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
        </TooltipProvider >
    );
}
