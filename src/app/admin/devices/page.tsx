"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
    getDevices,
    deleteDevice,
    testDeviceConnection,
    triggerDeviceRelay,
    getDeviceStats,
    syncPlatesToDevice
} from "@/app/actions/devices";
import { getAccessGroups } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Trash2,
    Plus,
    Server,
    Wifi,
    WifiOff,
    Settings2,
    Cpu,
    Globe,
    ArrowRightLeft,
    ShieldCheck,
    ArrowRightCircle,
    ArrowLeftCircle,
    Activity,
    Network,
    Camera,
    ScanFace,
    Search,
    Lock,
    Unlock,
    Database,
    Loader2,
    DoorOpen,
    DoorClosed,
    RefreshCw,
    Zap,
    Eye
} from "lucide-react";
import { io } from "socket.io-client";
import { Badge } from "@/components/ui/badge";
import { DeviceFormDialog } from "@/components/DeviceFormDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { DeviceMemoryDialog } from "@/components/DeviceMemoryDialog";
import { DevicePlateListDialog } from "@/components/DevicePlateListDialog";
import { AkuvoxActionUrlDialog } from "@/components/AkuvoxActionUrlDialog";
import { DRIVER_MODELS, DEVICE_MODELS } from "@/lib/driver-models";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, DownloadCloud, UploadCloud, Info } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const BRAND_CONFIG: Record<string, { label: string, color: string, bg: string, logoUrl: string }> = {
    HIKVISION: { label: "Hikvision", color: "#E4002B", bg: "bg-red-500/10", logoUrl: "/logos/hikvision.png" },
    AKUVOX: { label: "Akuvox", color: "#005BA4", bg: "bg-blue-500/10", logoUrl: "/logos/akuvox.png" },
    INTELBRAS: { label: "Intelbras", color: "#009639", bg: "bg-emerald-500/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Intelbras_logo.svg" },
    DAHUA: { label: "Dahua", color: "#ED1C24", bg: "bg-red-500/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Dahua_Technology_logo.svg" },
    ZKTECO: { label: "ZKTeco", color: "#0191D2", bg: "bg-sky-500/10", logoUrl: "https://www.zkteco.com/upload/201908/5d4d3c3f3f0f7.png" },
    AVICAM: { label: "Avicam", color: "#8E8E8E", bg: "bg-neutral-500/10", logoUrl: "" },
    MILESIGHT: { label: "Milesight", color: "#00AEEF", bg: "bg-cyan-500/10", logoUrl: "" },
    UNIFI: { label: "UniFi", color: "#0559C9", bg: "bg-blue-600/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Ubiquiti_Networks_logo.svg" },
    UNIVIEW: { label: "Uniview", color: "#005EB8", bg: "bg-blue-700/10", logoUrl: "https://www.uniview.com/etc/designs/uniview/logo.png" },
};


export default function DevicesPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [devices, setDevices] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [testingDevice, setTestingDevice] = useState<string | null>(null);
    const [triggeringRelay, setTriggeringRelay] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<Record<string, { success: boolean; message: string }>>({});
    const [deviceStats, setDeviceStats] = useState<Record<string, { faces: number; tags: number }>>({});
    const [managingMemory, setManagingMemory] = useState<any>(null);
    const [configActionUrl, setConfigActionUrl] = useState<any>(null);
    const [viewingLive, setViewingLive] = useState<any>(null);
    const [managingPlates, setManagingPlates] = useState<any>(null);

    const typeFilter = searchParams.get('type');

    const filteredDevices = devices.filter(d => {
        const matchesType = !typeFilter || d.deviceType === typeFilter;
        const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.location && d.location.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesType && matchesSearch;
    });

    useEffect(() => {
        loadData();

        // Socket Connection for Real-time Status
        const socket = io(`http://${window.location.hostname}:10000`);

        socket.on("device_status", (data) => {
            setDevices(prev => prev.map(d => {
                if (d.id === data.deviceId || d.mac === data.mac) {
                    return { ...d, doorStatus: data.doorStatus === 'open' ? 'OPEN' : 'CLOSED' };
                }
                return d;
            }));
        });

        socket.on("access_event", (event) => {
            console.log("📥 Live device event:", event);
            // Si el evento viene de uno de nuestros dispositivos, actualizamos su estado visual
            setDevices(prev => prev.map(d => {
                const deviceMac = d.mac?.replace(/:/g, '').toLowerCase();
                const eventMac = event.deviceMac?.replace(/:/g, '').toLowerCase();

                if (d.id === event.deviceId || (deviceMac && eventMac && deviceMac === eventMac)) {
                    // Si es un acceso concedido, simulamos la apertura de puerta visualmente
                    if (event.decision === "GRANT") {
                        setTimeout(() => {
                            setDevices(curr => curr.map(currD =>
                                currD.id === d.id ? { ...currD, doorStatus: 'CLOSED' } : currD
                            ));
                        }, 5000);
                        return { ...d, doorStatus: 'OPEN', lastEvent: event };
                    }
                    return { ...d, lastEvent: event };
                }
                return d;
            }));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [devData, groupData] = await Promise.all([getDevices(), getAccessGroups()]);
            setDevices(devData);
            setGroups(groupData as any[]);

            // Stats are no longer loaded automatically to prevent lag on entry
            // They will be loaded on demand or if the user clicks 'Refresh'
        } finally {
            setLoading(false);
        }
    }

    async function handleRefreshStats(deviceId: string) {
        try {
            const stats = await getDeviceStats(deviceId);
            setDeviceStats(prev => ({ ...prev, [deviceId]: stats }));
        } catch (error) {
            console.error("Failed to refresh stats:", error);
        }
    }

    async function handleTestConnection(id: string) {
        setTestingDevice(id);
        const result = await testDeviceConnection(id);
        setConnectionStatus(prev => ({ ...prev, [id]: result }));
        setTestingDevice(null);
    }

    async function handleTriggerRelay(id: string) {
        setTriggeringRelay(id);
        await triggerDeviceRelay(id);
        setTimeout(() => setTriggeringRelay(null), 3000); // Animation duration
    }

    async function handleSyncPlates(id: string) {
        setTriggeringRelay(id); // Use same state for loading feedback or add a new one
        const result = await syncPlatesToDevice(id);
        if (result.success) {
            await loadData();
        }
        setTriggeringRelay(null);
    }

    const setFilter = (type?: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (type) {
            params.set('type', type);
        } else {
            params.delete('type');
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-700">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-neutral-900/50 p-8 border border-neutral-800 rounded-3xl shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-inner group transition-all hover:scale-110">
                        <Network className="text-indigo-400 group-hover:rotate-[15deg] transition-transform duration-500" size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-blue-400 to-cyan-400 uppercase tracking-tight">
                            Arquitectura de Hardware
                        </h1>
                        <p className="text-sm text-neutral-500 font-medium">Gestión de nodos LPR, terminales biométricas y controladores de red.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="flex items-center gap-2 bg-neutral-950 p-2 rounded-2xl border border-white/5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilter()}
                            className={cn(
                                "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                !typeFilter ? "bg-white/10 text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300"
                            )}
                        >
                            Todos
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilter('LPR_CAMERA')}
                            className={cn(
                                "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                typeFilter === 'LPR_CAMERA' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-neutral-500 hover:text-neutral-300"
                            )}
                        >
                            Vision
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilter('FACE_TERMINAL')}
                            className={cn(
                                "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                typeFilter === 'FACE_TERMINAL' ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40" : "text-neutral-500 hover:text-neutral-300"
                            )}
                        >
                            Face AI
                        </Button>
                    </div>

                    <div className="relative flex-1 lg:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o IP..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 h-14 rounded-2xl pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-neutral-700"
                        />
                    </div>
                    <DeviceFormDialog groups={groups} onSuccess={loadData}>
                        <Button className="bg-gradient-to-r from-indigo-700 to-blue-700 text-white shadow-md shadow-indigo-950/20 font-black h-12 px-8 rounded-lg transition-all hover:brightness-110 active:scale-95 uppercase tracking-tighter text-xs shrink-0">
                            <Plus className="mr-3 h-5 w-5" /> Vincular Dispositivo
                        </Button>
                    </DeviceFormDialog>
                </div>
            </header>

            <div className="border border-neutral-800 rounded-xl overflow-hidden bg-[#0c0c0c] shadow-lg">
                <Table>
                    <TableHeader className="bg-[#0f0f0f]">
                        <TableRow className="border-neutral-800 hover:bg-transparent">
                            <TableHead className="text-neutral-400 font-black tracking-widest py-5 px-8 uppercase text-[10px]">Nodo de Acceso</TableHead>
                            <TableHead className="text-neutral-400 font-black tracking-widest uppercase text-[10px]">Marca y Modelo</TableHead>
                            <TableHead className="text-neutral-400 font-black tracking-widest uppercase text-[10px]">Protocolo / Red</TableHead>
                            <TableHead className="text-neutral-400 font-black tracking-widest text-center uppercase text-[10px]">Enlace</TableHead>
                            <TableHead className="text-neutral-400 font-black tracking-widest text-center uppercase text-[10px]">Estado</TableHead>
                            <TableHead className="text-right text-neutral-400 font-black tracking-widest pr-8 uppercase text-[10px]">Control & Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredDevices.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-32 text-neutral-700">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="p-8 bg-neutral-900 rounded-full border border-dashed border-neutral-800">
                                            <Server size={64} className="opacity-10" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xl font-bold uppercase tracking-tight">No se encontraron nodos</p>
                                            <p className="text-sm font-medium opacity-50">Intenta con otro término de búsqueda.</p>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {filteredDevices.map((dev) => {
                            const brand = BRAND_CONFIG[dev.brand] || { label: dev.brand, color: "#fff", bg: "bg-neutral-800" };
                            const isOpening = triggeringRelay === dev.id;

                            return (
                                <TableRow key={dev.id} className="border-neutral-800 hover:bg-white/5 transition-all group">
                                    <TableCell className="py-4 pl-8">
                                        <div className="flex items-center gap-5">
                                            {/* Vendor Logo & Model Image Group */}
                                            <div className="relative group/device">
                                                <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center p-2 border border-neutral-200/5 overflow-hidden">
                                                    <img
                                                        src={
                                                            dev.modelPhoto ||
                                                            DRIVER_MODELS[dev.brand as keyof typeof DRIVER_MODELS]?.find((m: any) => m.value === dev.deviceModel)?.photo ||
                                                            DEVICE_MODELS[dev.brand]?.[dev.deviceType] ||
                                                            DEVICE_MODELS[dev.brand]?.DEFAULT ||
                                                            brand.logoUrl ||
                                                            "/placeholder-device.png"
                                                        }
                                                        alt={brand.label}
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => {
                                                            const fallback = brand.logoUrl || "/placeholder-device.png";
                                                            if ((e.target as any).src !== fallback) {
                                                                (e.target as any).src = fallback;
                                                            }
                                                        }}
                                                    />
                                                    {dev.brandLogo && (
                                                        <div className="absolute bottom-0 right-0 w-6 h-6 bg-white rounded-lg p-0.5 border border-neutral-200 shadow-lg">
                                                            <img src={dev.brandLogo} alt="Brand" className="w-full h-full object-contain" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-black text-white text-lg tracking-tight leading-none">{dev.name}</p>
                                                    </div>

                                                    <div className="flex items-center gap-3 pt-1">
                                                        <div className={cn(
                                                            "px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all duration-500 border text-[9px] font-black uppercase tracking-wider",
                                                            dev.doorStatus === 'OPEN'
                                                                ? "bg-red-500 border-red-400 text-white animate-pulse"
                                                                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                        )}>
                                                            {dev.doorStatus === 'OPEN' ? (
                                                                <>
                                                                    <Unlock size={10} strokeWidth={3} /> PUERTA: ABIERTA
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Lock size={10} strokeWidth={3} /> PUERTA: CERRADA
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Quick Action: Open next to status */}
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        onClick={() => handleTriggerRelay(dev.id)}
                                                                        disabled={isOpening}
                                                                        size="icon"
                                                                        className={cn(
                                                                            "h-8 w-8 rounded-lg transition-all border relative overflow-hidden",
                                                                            isOpening
                                                                                ? "bg-emerald-500 border-emerald-400 text-white"
                                                                                : "bg-neutral-950 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 border-neutral-800 hover:border-emerald-500/30"
                                                                        )}
                                                                    >
                                                                        {isOpening ? <Unlock className="animate-bounce" size={14} /> : <Zap size={14} />}
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Accionar Relé</p></TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        {isOpening && (
                                                            <div className="flex items-center gap-2 text-blue-400 text-[9px] font-black uppercase tracking-wider animate-pulse">
                                                                <RefreshCw size={10} className="animate-spin" /> PROCESANDO...
                                                            </div>
                                                        )}

                                                        {dev.lastEvent && (
                                                            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-left-2 duration-500 pl-2 border-l border-white/5">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                                                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
                                                                        {dev.lastEvent.user?.name || dev.lastEvent.plateDetected || "SISTEMA"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 p-2 flex items-center justify-center overflow-hidden shrink-0">
                                                <img
                                                    src={dev.brandLogo || brand.logoUrl || "/placeholder-brand.png"}
                                                    alt={brand.label}
                                                    className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-500"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.src = "/placeholder-brand.png";
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-1">{brand.label}</p>
                                                <p className="text-[11px] font-black text-white uppercase tracking-tight">{dev.deviceModel || "Default"}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm text-neutral-200 font-black font-mono">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
                                                {dev.ip}
                                            </div>
                                            {dev.location ? (
                                                <p className="text-[10px] text-blue-400 font-black uppercase tracking-tight pl-3.5 group-hover:text-blue-300 transition-colors flex items-center gap-1.5">
                                                    <Globe size={10} /> {dev.location}
                                                </p>
                                            ) : (
                                                <p className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.2em] pl-3.5 group-hover:text-neutral-400 transition-colors">
                                                    MAC: {dev.mac || "UNSPECIFIED"}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-4">
                                            {/* PULL Connection (Server -> Device) */}
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <div className="flex flex-col items-center gap-1 group/pull cursor-help">
                                                            <div className={cn(
                                                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 border",
                                                                (dev.lastOnlinePull && (new Date().getTime() - new Date(dev.lastOnlinePull).getTime()) < 5 * 60 * 1000)
                                                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                                                    : "bg-neutral-900 border-neutral-800 text-neutral-700"
                                                            )}>
                                                                <DownloadCloud
                                                                    size={14}
                                                                    className={cn(
                                                                        (dev.lastOnlinePull && (new Date().getTime() - new Date(dev.lastOnlinePull).getTime()) < 5 * 60 * 1000) && "animate-pulse"
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="font-bold">Sincronización PULL (Servidor)</p>
                                                        <p className="text-xs text-neutral-400 text-center">Última: {dev.lastOnlinePull ? new Date(dev.lastOnlinePull).toLocaleTimeString() : 'Nunca'}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            {/* PUSH Connection (Device -> Server) */}
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <div className="flex flex-col items-center gap-1 group/push cursor-help">
                                                            <div className={cn(
                                                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 border",
                                                                (dev.lastOnlinePush && (new Date().getTime() - new Date(dev.lastOnlinePush).getTime()) < 5 * 60 * 1000)
                                                                    ? "bg-blue-500/10 border-blue-500/20 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                                                    : "bg-neutral-900 border-neutral-800 text-neutral-700"
                                                            )}>
                                                                <UploadCloud
                                                                    size={14}
                                                                    className={cn(
                                                                        (dev.lastOnlinePush && (new Date().getTime() - new Date(dev.lastOnlinePush).getTime()) < 5 * 60 * 1000) && "animate-bounce"
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="font-bold">Sincronización PUSH (Dispositivo)</p>
                                                        <p className="text-xs text-neutral-400 text-center">Última: {dev.lastOnlinePush ? new Date(dev.lastOnlinePush).toLocaleTimeString() : 'Nunca'}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {(() => {
                                            const now = new Date().getTime();
                                            const lastPull = dev.lastOnlinePull ? new Date(dev.lastOnlinePull).getTime() : 0;
                                            const lastPush = dev.lastOnlinePush ? new Date(dev.lastOnlinePush).getTime() : 0;

                                            // Diff calculation with math abs to handle slight clock skews
                                            const diffPull = Math.abs(now - lastPull);
                                            const diffPush = Math.abs(now - lastPush);

                                            // Online if seen in last 10 minutes (increased for stability)
                                            const isOnline = (lastPull > 0 && diffPull < 10 * 60 * 1000) ||
                                                (lastPush > 0 && diffPush < 10 * 60 * 1000);

                                            const lastSeenMsg = lastPull > lastPush
                                                ? `Sincro: ${new Date(lastPull).toLocaleTimeString()}`
                                                : lastPush > 0 ? `Evento: ${new Date(lastPush).toLocaleTimeString()}` : 'Sin datos';

                                            return (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border-2 cursor-help",
                                                                    isOnline
                                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                        : "bg-red-500/10 text-red-500 border-red-500/20"
                                                                )}
                                                            >
                                                                <span className={cn("w-1.5 h-1.5 rounded-full mr-2", isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                                                                {isOnline ? "ONLINE" : "OFFLINE"}
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="font-bold uppercase text-[10px]">{lastSeenMsg}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <div className="flex justify-end items-center gap-4">
                                            {/* Face/Tags Stats Badge - ONLY FOR NON-HIKVISION FACE TERMINALS */}
                                            {dev.deviceType === 'FACE_TERMINAL' && dev.brand !== 'HIKVISION' && (
                                                <div className="flex items-center gap-4 bg-neutral-950/50 p-1.5 rounded-xl border border-white/5 shadow-inner">
                                                    <div className="flex flex-col items-center bg-purple-500/5 border border-purple-500/10 rounded-lg px-2 py-1 min-w-[45px]">
                                                        <span className="text-[7px] text-purple-500/60 font-black uppercase tracking-widest leading-none mb-1">Faces</span>
                                                        <span className="text-[10px] font-mono font-black text-purple-400">
                                                            {deviceStats[dev.id]?.faces ?? "--"}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-center bg-amber-500/5 border border-amber-500/10 rounded-lg px-2 py-1 min-w-[45px]">
                                                        <span className="text-[7px] text-amber-500/60 font-black uppercase tracking-widest leading-none mb-1">Tags</span>
                                                        <span className="text-[10px] font-mono font-black text-amber-400">
                                                            {deviceStats[dev.id]?.tags ?? "--"}
                                                        </span>
                                                    </div>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleRefreshStats(dev.id)}
                                                                    className="h-7 w-7 rounded-md hover:bg-white/5 text-neutral-600 hover:text-white"
                                                                >
                                                                    <RefreshCw size={12} className={cn(loading ? "animate-spin" : "")} />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p className="text-[10px] uppercase font-black">Actualizar Estadísticas de Dispositivo</p></TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            )}

                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setViewingLive(dev)}
                                                            className="h-9 w-9 rounded-xl bg-neutral-900/50 text-neutral-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-neutral-800 hover:border-indigo-500/30 transition-all"
                                                        >
                                                            <Eye size={18} />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Ver en Vivo</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            {/* Dropdown for Secondary Actions */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5">
                                                        <MoreHorizontal size={16} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 bg-neutral-900 border-neutral-800 text-neutral-200">
                                                    <DropdownMenuLabel className="text-xs font-black uppercase tracking-widest text-neutral-500">Gestión</DropdownMenuLabel>

                                                    {dev.deviceType === 'FACE_TERMINAL' && (
                                                        <DropdownMenuItem onClick={() => setManagingMemory(dev)} className="cursor-pointer gap-2 text-xs font-bold hover:bg-white/5 hover:text-indigo-400 focus:bg-white/5 focus:text-indigo-400">
                                                            <Database size={14} /> Memoria Flash
                                                        </DropdownMenuItem>
                                                    )}

                                                    {dev.deviceType === 'LPR_CAMERA' && dev.brand === 'HIKVISION' && (
                                                        <DropdownMenuItem onClick={() => setManagingPlates(dev)} className="cursor-pointer gap-2 text-xs font-bold hover:bg-white/5 hover:text-blue-400 focus:bg-white/5 focus:text-blue-400">
                                                            <Database size={14} /> Lista Blanca LPR
                                                        </DropdownMenuItem>
                                                    )}

                                                    {dev.brand === 'AKUVOX' && (
                                                        <DropdownMenuItem onClick={() => setConfigActionUrl(dev)} className="cursor-pointer gap-2 text-xs font-bold hover:bg-white/5 hover:text-orange-400 focus:bg-white/5 focus:text-orange-400">
                                                            <Network size={14} /> Webhooks (Action URL)
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuSeparator className="bg-white/5" />

                                                    <DeviceFormDialog device={dev} groups={groups} onSuccess={loadData}>
                                                        <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs font-bold outline-none transition-colors hover:bg-white/5 hover:text-blue-400 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 gap-2">
                                                            <Settings2 size={14} /> Editar Configuración
                                                        </div>
                                                    </DeviceFormDialog>

                                                    <DropdownMenuSeparator className="bg-white/5" />

                                                    <DeleteConfirmDialog
                                                        id={dev.id}
                                                        title={dev.name}
                                                        description="Se eliminará este dispositivo."
                                                        onDelete={deleteDevice}
                                                        onSuccess={loadData}
                                                    >
                                                        <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs font-bold outline-none transition-colors hover:bg-red-500/10 hover:text-red-500 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 gap-2 text-red-400">
                                                            <Trash2 size={14} /> Eliminar
                                                        </div>
                                                    </DeleteConfirmDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow >
                            );
                        })}
                    </TableBody >
                </Table >
            </div >

            {managingMemory && (
                <DeviceMemoryDialog
                    device={managingMemory}
                    open={!!managingMemory}
                    onOpenChange={(v) => !v && setManagingMemory(null)}
                />
            )}

            {managingPlates && (
                <DevicePlateListDialog
                    device={managingPlates}
                    open={!!managingPlates}
                    onOpenChange={(v) => !v && setManagingPlates(null)}
                />
            )}

            {configActionUrl && (
                <AkuvoxActionUrlDialog
                    device={configActionUrl}
                    open={!!configActionUrl}
                    onOpenChange={(v) => !v && setConfigActionUrl(null)}
                />
            )}

            {viewingLive && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                    <Camera className="text-indigo-400" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight">{viewingLive.name}</h3>
                                    <p className="text-xs text-neutral-500 font-bold tracking-widest uppercase">{viewingLive.ip} • LIVE STREAM</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingLive(null)}
                                className="h-10 w-10 rounded-xl hover:bg-white/10 text-neutral-400"
                            >
                                <Plus className="rotate-45" size={24} />
                            </Button>
                        </div>
                        <div className="aspect-video bg-black flex items-center justify-center relative group">
                            <img
                                key={viewingLive.id}
                                src={`http://${window.location.hostname}:10000/api/live/${viewingLive.id}`}
                                alt="Live View"
                                className="max-w-full max-h-full object-contain"
                            />
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                <span className="flex h-3 w-3 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="text-[10px] font-black text-white uppercase tracking-widest drop-shadow-md">REC LIVE</span>
                            </div>
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Badge className="bg-neutral-950/80 backdrop-blur border-white/10 text-neutral-400 font-mono text-[10px]">
                                    MJPEG PROXY STREAM • 5 FPS
                                </Badge>
                            </div>
                        </div>
                        <div className="p-4 bg-neutral-950/50 flex justify-center gap-2">
                            <Button
                                onClick={() => setViewingLive(null)}
                                className="bg-neutral-800 hover:bg-neutral-700 text-white font-black px-8 rounded-xl h-11 uppercase text-xs"
                            >
                                Cerrar Visualización
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
