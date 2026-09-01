"use client";

import { useEffect, useState, useRef } from "react";
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
import { getEnabledModules, type ModuleId } from "@/app/actions/modules";
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

// Inline SVG data URIs for fallback images (avoid 404s for missing placeholder files)
const PLACEHOLDER_DEVICE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="8" fill="%23262626"/><path d="M24 14a4 4 0 100 8 4 4 0 000-8zm-6 14c0-2 4-3.1 6-3.1S30 26 30 28v1H18v-1z" fill="%23525252"/><rect x="14" y="32" width="20" height="3" rx="1.5" fill="%23525252"/></svg>')}`;
const PLACEHOLDER_BRAND = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="4" fill="%23262626"/><circle cx="16" cy="16" r="8" stroke="%23525252" stroke-width="1.5" fill="none"/><path d="M16 12v4l3 3" stroke="%23525252" stroke-width="1.5" stroke-linecap="round"/></svg>')}`;

const TYPE_META: Record<string, { label: string; color: string; activeClass: string }> = {
    LPR_CAMERA: { label: "LPR", color: "text-amber-400", activeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    FACE_TERMINAL: { label: "Face", color: "text-teal-400", activeClass: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
    QUEUE_COUNTER: { label: "Queue", color: "text-violet-400", activeClass: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
};

const BRAND_CONFIG: Record<string, { label: string, color: string, bg: string, logoUrl: string }> = {
    HIKVISION: { label: "Hikvision", color: "#E4002B", bg: "bg-red-500/10", logoUrl: "/logos/hikvision.png" },
    AKUVOX: { label: "Akuvox", color: "#005BA4", bg: "bg-blue-500/10", logoUrl: "/logos/akuvox.png" },
    INTELBRAS: { label: "Intelbras", color: "#009639", bg: "bg-emerald-500/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Intelbras_logo.svg" },
    DAHUA: { label: "Dahua", color: "#ED1C24", bg: "bg-red-500/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Dahua_Technology_logo.svg" },
    ZKTECO: { label: "ZKTeco", color: "#0191D2", bg: "bg-sky-500/10", logoUrl: "https://www.zkteco.com/upload/201908/5d4d3c3f3f0f7.png" },
    AVICAM: { label: "Avicam", color: "#8E8E8E", bg: "bg-muted/10", logoUrl: "" },
    MILESIGHT: { label: "Milesight", color: "#00AEEF", bg: "bg-cyan-500/10", logoUrl: "" },
    UNIFI: { label: "UniFi", color: "#0559C9", bg: "bg-blue-600/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Ubiquiti_Networks_logo.svg" },
    UNIVIEW: { label: "Uniview", color: "#005EB8", bg: "bg-blue-700/10", logoUrl: "https://www.uniview.com/etc/designs/uniview/logo.png" },
    BOSCH: { label: "Bosch", color: "#E20015", bg: "bg-red-500/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0e/Bosch-brand.svg" },
};


// go2rtc MP4-over-HTTP live video for Bosch cameras (WS/MSE falla por el proxy)
function BoschLiveVideo({ ip }: { ip: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        if (!ip) { setFailed(true); return; }
        const video = videoRef.current; if (!video) return;
        const streamName = `bosch_${ip.replace(/\./g, "_")}`;
        let tries = 0; let stopped = false;
        const start = () => { if (stopped) return; setFailed(false); video.src = `/go2rtc/api/stream.mp4?src=${encodeURIComponent(streamName)}&t=${Date.now()}`; video.play().catch(() => {}); };
        const onErr = () => { if (stopped) return; if (tries++ < 6) setTimeout(start, 1300); else setFailed(true); };
        const onProgress = () => { try { if (video.buffered.length) { const end = video.buffered.end(video.buffered.length - 1); if (end - video.currentTime > 2.5) video.currentTime = end; } } catch {} };
        video.addEventListener("error", onErr);
        video.addEventListener("progress", onProgress);
        start();
        return () => { stopped = true; video.removeEventListener("error", onErr); video.removeEventListener("progress", onProgress); video.pause(); video.removeAttribute("src"); video.load(); };
    }, [ip]);
    if (failed) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-neutral-400">
                <Camera size={32} className="mb-2 opacity-30" />
                <span className="text-xs">Reconectando…</span>
            </div>
        );
    }
    return <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-contain" />;
}

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
    const [modules, setModules] = useState<Record<ModuleId, boolean>>({
        MODULE_LPR: true,
        MODULE_FACE: true,
        MODULE_QUEUE: false,
    });

    const typeFilter = searchParams.get('type');

    // Build allowed device types based on active modules
    const allowedTypes: string[] = [];
    if (modules.MODULE_LPR) allowedTypes.push("LPR_CAMERA");
    if (modules.MODULE_FACE) allowedTypes.push("FACE_TERMINAL");
    if (modules.MODULE_QUEUE) allowedTypes.push("QUEUE_COUNTER");

    const filteredDevices = devices.filter(d => {
        // Only show devices whose type belongs to an active module
        if (!allowedTypes.includes(d.deviceType)) return false;
        const matchesType = !typeFilter || d.deviceType === typeFilter;
        const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.location && d.location.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesType && matchesSearch;
    });

    useEffect(() => {
        loadData();
        getEnabledModules().then(setModules);

        // Socket Connection for Real-time Status
        const socket = io(window.location.origin, { path: '/io/socket.io', transports: ['polling'] });

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
        <div className="p-6 space-y-4 animate-in fade-in duration-500">
            {/* Compact Header */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <Network className="text-indigo-400" size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-foreground tracking-tight">
                            Dispositivos
                        </h1>
                        <p className="text-[11px] text-muted-foreground">
                            {filteredDevices.length} dispositivo{filteredDevices.length !== 1 ? "s" : ""} {typeFilter ? `· ${TYPE_META[typeFilter]?.label || typeFilter}` : ""}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    {/* Module-aware filter tabs */}
                    <div className="flex items-center gap-1 bg-card/80 p-1 rounded-lg border border-border/60">
                        <button
                            onClick={() => setFilter()}
                            className={cn(
                                "h-8 px-3 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                                !typeFilter ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-muted-foreground hover:bg-accent"
                            )}
                        >
                            Todos
                        </button>
                        {allowedTypes.map(type => {
                            const meta = TYPE_META[type];
                            return (
                                <button
                                    key={type}
                                    onClick={() => setFilter(type)}
                                    className={cn(
                                        "h-8 px-3 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border border-transparent",
                                        typeFilter === type ? meta.activeClass : "text-muted-foreground hover:text-muted-foreground hover:bg-accent"
                                    )}
                                >
                                    {meta.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative flex-1 lg:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                        <input
                            type="text"
                            placeholder="Buscar dispositivo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-card/80 border border-border/60 h-9 rounded-lg pl-9 pr-3 text-xs font-medium focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 outline-none transition-all placeholder:text-muted-foreground text-foreground"
                        />
                    </div>
                    <DeviceFormDialog groups={groups} onSuccess={loadData}>
                        <Button className="bg-indigo-600 hover:bg-indigo-500 text-foreground font-bold h-9 px-4 rounded-lg transition-all active:scale-95 text-xs shrink-0 gap-1.5">
                            <Plus size={15} /> Nuevo
                        </Button>
                    </DeviceFormDialog>
                </div>
            </header>

            <div className="border border-border/60 rounded-lg overflow-hidden bg-background/50">
                <Table>
                    <TableHeader className="bg-card/60">
                        <TableRow className="border-border/60 hover:bg-transparent">
                            <TableHead className="text-muted-foreground font-semibold tracking-wide py-3 pl-5 uppercase text-[10px]">Dispositivo</TableHead>
                            <TableHead className="text-muted-foreground font-semibold tracking-wide uppercase text-[10px]">Marca / Modelo</TableHead>
                            <TableHead className="text-muted-foreground font-semibold tracking-wide uppercase text-[10px]">Red</TableHead>
                            <TableHead className="text-muted-foreground font-semibold tracking-wide text-center uppercase text-[10px]">Enlace</TableHead>
                            <TableHead className="text-muted-foreground font-semibold tracking-wide text-center uppercase text-[10px]">Estado</TableHead>
                            <TableHead className="text-right text-muted-foreground font-semibold tracking-wide pr-5 uppercase text-[10px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredDevices.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-20">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-5 bg-card/50 rounded-lg border border-dashed border-border">
                                            <Server size={36} className="text-muted-foreground" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-muted-foreground">No se encontraron dispositivos</p>
                                            <p className="text-xs text-muted-foreground">Intenta con otro término de búsqueda o agrega un dispositivo.</p>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {filteredDevices.map((dev) => {
                            const brand = BRAND_CONFIG[dev.brand] || { label: dev.brand, color: "#fff", bg: "bg-muted" };
                            const isOpening = triggeringRelay === dev.id;

                            return (
                                <TableRow key={dev.id} className="border-border/50 hover:bg-foreground/[0.04] transition-colors group">
                                    <TableCell className="py-3 pl-5">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className="w-11 h-11 rounded-md bg-white flex items-center justify-center p-1.5 border border-border/30 overflow-hidden">
                                                    <img
                                                        src={
                                                            dev.modelPhoto ||
                                                            DRIVER_MODELS[dev.brand as keyof typeof DRIVER_MODELS]?.find((m: any) => m.value === dev.deviceModel)?.photo ||
                                                            DEVICE_MODELS[dev.brand]?.[dev.deviceType] ||
                                                            DEVICE_MODELS[dev.brand]?.DEFAULT ||
                                                            brand.logoUrl ||
                                                            PLACEHOLDER_DEVICE
                                                        }
                                                        alt={brand.label}
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => {
                                                            const fallback = brand.logoUrl || PLACEHOLDER_DEVICE;
                                                            if ((e.target as any).src !== fallback) {
                                                                (e.target as any).src = fallback;
                                                            }
                                                        }}
                                                    />
                                                    {dev.brandLogo && (
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded p-0.5 border border-border shadow-sm">
                                                            <img src={dev.brandLogo} alt="Brand" className="w-full h-full object-contain" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div>
                                                    <p className="font-semibold text-foreground text-sm leading-none">{dev.name}</p>
                                                </div>

                                                    <div className="flex items-center gap-2 pt-0.5">
                                                        <div className={cn(
                                                            "px-2 py-0.5 rounded flex items-center gap-1 transition-all duration-500 border text-[9px] font-bold uppercase tracking-wide",
                                                            dev.doorStatus === 'OPEN'
                                                                ? "bg-red-500/15 border-red-500/30 text-red-400 animate-pulse"
                                                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                        )}>
                                                            {dev.doorStatus === 'OPEN' ? (
                                                                <><Unlock size={9} /> Abierta</>
                                                            ) : (
                                                                <><Lock size={9} /> Cerrada</>
                                                            )}
                                                        </div>

                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        onClick={() => handleTriggerRelay(dev.id)}
                                                                        disabled={isOpening}
                                                                        size="icon"
                                                                        className={cn(
                                                                            "h-6 w-6 rounded transition-all border",
                                                                            isOpening
                                                                                ? "bg-emerald-500 border-emerald-400 text-foreground"
                                                                                : "bg-card text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 border-border hover:border-emerald-500/30"
                                                                        )}
                                                                    >
                                                                        {isOpening ? <Unlock className="animate-bounce" size={11} /> : <Zap size={11} />}
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Accionar Relé</p></TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>

                                                        {isOpening && (
                                                            <span className="text-blue-400 text-[9px] font-semibold animate-pulse flex items-center gap-1">
                                                                <RefreshCw size={9} className="animate-spin" /> Procesando
                                                            </span>
                                                        )}

                                                        {dev.lastEvent && (
                                                            <span className="text-[9px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 animate-in fade-in duration-500">
                                                                {dev.lastEvent.user?.name || dev.lastEvent.plateDetected || "Sistema"}
                                                            </span>
                                                        )}
                                                    </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded bg-foreground/10 border border-border/40 p-1.5 flex items-center justify-center overflow-hidden shrink-0">
                                                <img
                                                    src={dev.brandLogo || brand.logoUrl || PLACEHOLDER_BRAND}
                                                    alt={brand.label}
                                                    className="max-w-full max-h-full object-contain"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.src = PLACEHOLDER_BRAND;
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{brand.label}</p>
                                                <p className="text-xs font-semibold text-foreground">{dev.deviceModel || "Default"}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-foreground font-mono font-medium">{dev.ip}</p>
                                            {dev.location ? (
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <Globe size={10} className="text-blue-400/70" /> {dev.location}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground font-mono">
                                                    {dev.mac || "—"}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <div className={cn(
                                                            "w-7 h-7 rounded flex items-center justify-center transition-all border",
                                                            (dev.lastOnlinePull && (new Date().getTime() - new Date(dev.lastOnlinePull).getTime()) < 5 * 60 * 1000)
                                                                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                                                                : "bg-card/50 border-border/50 text-muted-foreground"
                                                        )}>
                                                            <DownloadCloud size={13} />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="font-semibold text-xs">PULL</p>
                                                        <p className="text-[10px] text-muted-foreground">{dev.lastOnlinePull ? new Date(dev.lastOnlinePull).toLocaleTimeString() : 'Nunca'}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <div className={cn(
                                                            "w-7 h-7 rounded flex items-center justify-center transition-all border",
                                                            (dev.lastOnlinePush && (new Date().getTime() - new Date(dev.lastOnlinePush).getTime()) < 5 * 60 * 1000)
                                                                ? "bg-blue-500/10 border-blue-500/25 text-blue-400"
                                                                : "bg-card/50 border-border/50 text-muted-foreground"
                                                        )}>
                                                            <UploadCloud size={13} />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="font-semibold text-xs">PUSH</p>
                                                        <p className="text-[10px] text-muted-foreground">{dev.lastOnlinePush ? new Date(dev.lastOnlinePush).toLocaleTimeString() : 'Nunca'}</p>
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
                                                                    "text-[9px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded border cursor-help",
                                                                    isOnline
                                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                                                                        : "bg-red-500/10 text-red-400 border-red-500/25"
                                                                )}
                                                            >
                                                                <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5 inline-block", isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                                                                {isOnline ? "Online" : "Offline"}
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
                                    <TableCell className="text-right pr-5">
                                        <div className="flex justify-end items-center gap-2">
                                            {/* Face/Tags Stats Badge */}
                                            {dev.deviceType === 'FACE_TERMINAL' && dev.brand !== 'HIKVISION' && (
                                                <div className="flex items-center gap-2 bg-card/60 p-1 rounded-md border border-border/50">
                                                    <div className="flex flex-col items-center bg-purple-500/8 border border-purple-500/15 rounded px-1.5 py-0.5 min-w-[36px]">
                                                        <span className="text-[7px] text-purple-400/70 font-semibold uppercase tracking-wide leading-none">Faces</span>
                                                        <span className="text-[10px] font-mono font-semibold text-purple-400">
                                                            {deviceStats[dev.id]?.faces ?? "--"}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-center bg-amber-500/8 border border-amber-500/15 rounded px-1.5 py-0.5 min-w-[36px]">
                                                        <span className="text-[7px] text-amber-400/70 font-semibold uppercase tracking-wide leading-none">Tags</span>
                                                        <span className="text-[10px] font-mono font-semibold text-amber-400">
                                                            {deviceStats[dev.id]?.tags ?? "--"}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRefreshStats(dev.id)}
                                                        className="h-6 w-6 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                                                    >
                                                        <RefreshCw size={11} className={cn(loading ? "animate-spin" : "")} />
                                                    </Button>
                                                </div>
                                            )}

                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setViewingLive(dev)}
                                                            className="h-8 w-8 rounded-md bg-card/50 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 border border-border/50 hover:border-indigo-500/30 transition-all"
                                                        >
                                                            <Eye size={15} />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p>Ver en Vivo</p></TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent">
                                                        <MoreHorizontal size={15} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 bg-card border-border text-foreground">
                                                    <DropdownMenuLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Gestión</DropdownMenuLabel>

                                                    {dev.deviceType === 'FACE_TERMINAL' && (
                                                        <DropdownMenuItem onClick={() => setManagingMemory(dev)} className="cursor-pointer gap-2 text-xs font-bold hover:bg-accent hover:text-indigo-400 focus:bg-foreground/10 focus:text-indigo-400">
                                                            <Database size={14} /> Memoria Flash
                                                        </DropdownMenuItem>
                                                    )}

                                                    {dev.deviceType === 'LPR_CAMERA' && dev.brand === 'HIKVISION' && (
                                                        <DropdownMenuItem onClick={() => setManagingPlates(dev)} className="cursor-pointer gap-2 text-xs font-bold hover:bg-accent hover:text-blue-400 focus:bg-foreground/10 focus:text-blue-400">
                                                            <Database size={14} /> Lista Blanca LPR
                                                        </DropdownMenuItem>
                                                    )}

                                                    {dev.brand === 'AKUVOX' && (
                                                        <DropdownMenuItem onClick={() => setConfigActionUrl(dev)} className="cursor-pointer gap-2 text-xs font-bold hover:bg-accent hover:text-orange-400 focus:bg-foreground/10 focus:text-orange-400">
                                                            <Network size={14} /> Webhooks (Action URL)
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuSeparator className="bg-foreground/10" />

                                                    <DeviceFormDialog device={dev} groups={groups} onSuccess={loadData}>
                                                        <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs font-bold outline-none transition-colors hover:bg-accent hover:text-blue-400 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 gap-2">
                                                            <Settings2 size={14} /> Editar Configuración
                                                        </div>
                                                    </DeviceFormDialog>

                                                    <DropdownMenuSeparator className="bg-foreground/10" />

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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-lg w-full max-w-4xl overflow-hidden shadow-2xl">
                        <div className="px-5 py-3 border-b border-border/60 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/10 rounded-md border border-indigo-500/20">
                                    <Camera className="text-indigo-400" size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">{viewingLive.name}</h3>
                                    <p className="text-[10px] text-muted-foreground">{viewingLive.ip} · Live</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingLive(null)}
                                className="h-8 w-8 rounded-md hover:bg-accent text-muted-foreground"
                            >
                                <Plus className="rotate-45" size={18} />
                            </Button>
                        </div>
                        <div className="aspect-video vid-surface flex items-center justify-center relative group">
                            {viewingLive.brand === "BOSCH" ? (
                                <BoschLiveVideo ip={viewingLive.ip} />
                            ) : (
                                <img
                                    key={viewingLive.id}
                                    src={`/io/api/live/${viewingLive.id}`}
                                    alt="Live View"
                                    className="max-w-full max-h-full object-contain"
                                />
                            )}
                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                <span className="flex h-2.5 w-2.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                </span>
                                <span className="text-[9px] font-bold text-foreground uppercase tracking-wide drop-shadow-md">Live</span>
                            </div>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Badge className="bg-background/80 backdrop-blur border-border text-muted-foreground font-mono text-[9px]">
                                    {viewingLive.brand === "BOSCH" ? "go2rtc · MSE" : "MJPEG · 5 FPS"}
                                </Badge>
                            </div>
                        </div>
                        <div className="p-3 bg-background/50 flex justify-center">
                            <Button
                                onClick={() => setViewingLive(null)}
                                className="bg-muted hover:bg-muted text-foreground font-semibold px-6 rounded-md h-9 text-xs"
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
