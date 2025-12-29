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
import { cn } from "@/lib/utils";

const BRAND_CONFIG: Record<string, { label: string, color: string, bg: string, logoUrl: string }> = {
    HIKVISION: { label: "Hikvision", color: "#E4002B", bg: "bg-red-500/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Hikvision_logo.svg" },
    AKUVOX: { label: "Akuvox", color: "#005BA4", bg: "bg-blue-500/10", logoUrl: "https://shop.akuvox.it/skins/akuvox/customer/images/logo.png" },
    INTELBRAS: { label: "Intelbras", color: "#009639", bg: "bg-emerald-500/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Intelbras_logo.svg" },
    DAHUA: { label: "Dahua", color: "#ED1C24", bg: "bg-red-500/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Dahua_Technology_logo.svg" },
    ZKTECO: { label: "ZKTeco", color: "#0191D2", bg: "bg-sky-500/10", logoUrl: "https://www.zkteco.com/upload/201908/5d4d3c3f3f0f7.png" },
    AVICAM: { label: "Avicam", color: "#8E8E8E", bg: "bg-neutral-500/10", logoUrl: "" },
    MILESIGHT: { label: "Milesight", color: "#00AEEF", bg: "bg-cyan-500/10", logoUrl: "" },
    UNIFI: { label: "UniFi", color: "#0559C9", bg: "bg-blue-600/10", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Ubiquiti_Networks_logo.svg" },
    UNIVIEW: { label: "Uniview", color: "#005EB8", bg: "bg-blue-700/10", logoUrl: "https://www.uniview.com/etc/designs/uniview/logo.png" },
};

const DEVICE_MODELS: Record<string, Record<string, string>> = {
    AKUVOX: {
        FACE_TERMINAL: "https://www.akuvox.com/Upload/products/202103/17/20210317154215865.png", // A05
        DEFAULT: "https://www.akuvox.com/Upload/products/202005/18/20200518105739832.png"
    },
    HIKVISION: {
        LPR_CAMERA: "https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000002/S000000003/S000000023/OFR000025/M000000001/image/1.png",
        FACE_TERMINAL: "https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000002/S000000009/S000000001/OFR000142/M000038827/image/MinMoe-Face-Recognition-Terminal_Face-Recognition-Terminal_DS-K1T671 Series_1.png",
        DEFAULT: "https://www.hikvision.com/content/dam/hikvision/products/S000000001/S000000002/S000000003/S000000023/OFR000025/M000000001/image/1.png"
    },
    ZKTECO: {
        FACE_TERMINAL: "https://www.zkteco.com/upload/2019/12/30/1577689945722369.png",
        DEFAULT: "https://www.zkteco.com/upload/2019/12/30/1577689945722369.png"
    },
    DAHUA: {
        LPR_CAMERA: "https://material.dahuasecurity.com/uploads/image/20230227/29b9f7c00e6a4b1d9bf5b8f6c6d6c4d6.png",
        DEFAULT: "https://material.dahuasecurity.com/uploads/image/20230227/29b9f7c00e6a4b1d9bf5b8f6c6d6c4d6.png"
    }
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

            // Load stats for face terminals in parallel
            const faceTerminals = devData.filter(dev => dev.deviceType === 'FACE_TERMINAL');
            const statsResults = await Promise.all(
                faceTerminals.map(async (dev) => ({
                    id: dev.id,
                    stats: await getDeviceStats(dev.id)
                }))
            );

            const newStats = { ...deviceStats };
            statsResults.forEach(res => {
                newStats[res.id] = res.stats;
            });
            setDeviceStats(newStats);
        } finally {
            setLoading(false);
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
                        <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-xl shadow-indigo-900/30 font-black h-14 px-10 rounded-2xl transition-all hover:scale-105 active:scale-95 uppercase tracking-tighter text-sm shrink-0">
                            <Plus className="mr-3 h-6 w-6" /> Vincular
                        </Button>
                    </DeviceFormDialog>
                </div>
            </header>

            <div className="border border-neutral-800 rounded-3xl overflow-hidden bg-[#0c0c0c] shadow-2xl">
                <Table>
                    <TableHeader className="bg-neutral-900/80">
                        <TableRow className="border-neutral-800 hover:bg-transparent">
                            <TableHead className="text-neutral-400 font-black tracking-widest py-5 px-8 uppercase text-[10px]">Nodo de Acceso</TableHead>
                            <TableHead className="text-neutral-400 font-black tracking-widest uppercase text-[10px]">Protocolo / Red</TableHead>
                            <TableHead className="text-neutral-400 font-black tracking-widest uppercase text-[10px]">Lógica / Flujo</TableHead>
                            <TableHead className="text-neutral-400 font-black tracking-widest text-center uppercase text-[10px]">Enlace</TableHead>
                            <TableHead className="text-right text-neutral-400 font-black tracking-widest pr-8 uppercase text-[10px]">Control & Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredDevices.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-32 text-neutral-700">
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
                                    <TableCell className="py-6 pl-8">
                                        <div className="flex items-center gap-5">
                                            {/* Vendor Logo & Model Image Group */}
                                            <div className="relative group/device">
                                                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center p-2 shadow-sm border border-neutral-200/10 overflow-hidden">
                                                    <img
                                                        src={dev.modelPhoto || DEVICE_MODELS[dev.brand]?.[dev.deviceType] || DEVICE_MODELS[dev.brand]?.DEFAULT || brand.logoUrl || "/placeholder-device.png"}
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
                                                    <p className="font-black text-white text-lg tracking-tight leading-none">{dev.name}</p>

                                                    <div className="flex items-center gap-3 pt-1">
                                                        <div className={cn(
                                                            "px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all duration-500 border text-[9px] font-black uppercase tracking-wider",
                                                            dev.doorStatus === 'OPEN'
                                                                ? "bg-red-500 border-red-400 text-white animate-pulse"
                                                                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                        )}>
                                                            {dev.doorStatus === 'OPEN' ? (
                                                                <>
                                                                    <Unlock size={10} strokeWidth={3} /> BARRERA ARRIBA
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Lock size={10} strokeWidth={3} /> BARRERA BAJA
                                                                </>
                                                            )}
                                                        </div>

                                                        {isOpening && (
                                                            <div className="flex items-center gap-2 bg-blue-600 text-white text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider animate-pulse">
                                                                <RefreshCw size={10} className="animate-spin" /> ABRIENDO...
                                                            </div>
                                                        )}

                                                        {dev.lastEvent && (
                                                            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-left-2 duration-500">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                                                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
                                                                        CAPTURA: {dev.lastEvent.user?.name || dev.lastEvent.plateDetected || "SISTEMA"}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[8px] text-neutral-500 font-mono font-bold pl-3.5 flex items-center gap-1.5 tracking-tighter">
                                                                    <Activity size={10} className="text-neutral-700" />
                                                                    {new Date(dev.lastEvent.timestamp).toLocaleString('es-AR', {
                                                                        day: '2-digit',
                                                                        month: '2-digit',
                                                                        year: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                        second: '2-digit'
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
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
                                    <TableCell>
                                        <div className="flex items-center gap-6">
                                            <div className={cn(
                                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black border uppercase tracking-widest shadow-inner",
                                                dev.deviceType === 'FACE_TERMINAL'
                                                    ? "bg-indigo-500/5 text-indigo-400 border-indigo-500/10"
                                                    : dev.direction === 'ENTRY'
                                                        ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                                                        : "bg-blue-500/5 text-blue-400 border-blue-500/10"
                                            )}>
                                                {dev.deviceType === 'FACE_TERMINAL' ? (
                                                    <>
                                                        <Globe size={14} strokeWidth={2.5} />
                                                        {dev.location || "GENERAL"}
                                                    </>
                                                ) : (
                                                    <>
                                                        {dev.direction === 'ENTRY' ? <ArrowRightCircle size={14} strokeWidth={2.5} /> : <ArrowLeftCircle size={14} strokeWidth={2.5} />}
                                                        {dev.direction === 'ENTRY' ? "ENTRADA" : "SALIDA"}
                                                    </>
                                                )}
                                            </div>

                                            {dev.deviceType === 'FACE_TERMINAL' && (
                                                <div className="flex items-center gap-3 border-l border-white/5 pl-6">
                                                    <div className="flex flex-col items-center bg-purple-500/5 border border-purple-500/10 rounded-xl px-3 py-1.5 min-w-[50px]">
                                                        <span className="text-[8px] text-purple-500/60 font-black uppercase tracking-widest leading-none mb-1">Faces</span>
                                                        <span className="text-xs font-mono font-black text-purple-400">
                                                            {deviceStats[dev.id]?.faces ?? "0"}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-center bg-amber-500/5 border border-amber-500/10 rounded-xl px-3 py-1.5 min-w-[50px]">
                                                        <span className="text-[8px] text-amber-500/60 font-black uppercase tracking-widest leading-none mb-1">Tags</span>
                                                        <span className="text-xs font-mono font-black text-amber-400">
                                                            {deviceStats[dev.id]?.tags ?? "0"}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-4">
                                            {/* PULL Connection (Server -> Device) */}
                                            <div className="flex flex-col items-center gap-1 group/pull">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 border",
                                                    (dev.lastOnlinePull && (new Date().getTime() - new Date(dev.lastOnlinePull).getTime()) < 5 * 60 * 1000)
                                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                                        : "bg-neutral-900 border-neutral-800 text-neutral-700"
                                                )}>
                                                    <Server
                                                        size={14}
                                                        className={cn(
                                                            (dev.lastOnlinePull && (new Date().getTime() - new Date(dev.lastOnlinePull).getTime()) < 5 * 60 * 1000) && "animate-pulse"
                                                        )}
                                                    />
                                                </div>
                                                <span className="text-[7px] font-black uppercase tracking-widest text-neutral-600 group-hover/pull:text-neutral-400 transition-colors">Pull (Svr)</span>
                                            </div>

                                            {/* PUSH Connection (Device -> Server) */}
                                            <div className="flex flex-col items-center gap-1 group/push">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 border",
                                                    (dev.lastOnlinePush && (new Date().getTime() - new Date(dev.lastOnlinePush).getTime()) < 5 * 60 * 1000)
                                                        ? "bg-blue-500/10 border-blue-500/20 text-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                                        : "bg-neutral-900 border-neutral-800 text-neutral-700"
                                                )}>
                                                    <Activity
                                                        size={14}
                                                        className={cn(
                                                            (dev.lastOnlinePush && (new Date().getTime() - new Date(dev.lastOnlinePush).getTime()) < 5 * 60 * 1000) && "animate-bounce"
                                                        )}
                                                    />
                                                </div>
                                                <span className="text-[7px] font-black uppercase tracking-widest text-neutral-600 group-hover/push:text-neutral-400 transition-colors">Push (Dev)</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <div className="flex justify-end items-center gap-3">
                                            {/* Live View Button */}
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setViewingLive(dev)}
                                                className="h-10 w-10 rounded-xl border-neutral-800 bg-neutral-900/50 text-indigo-400 hover:bg-indigo-600 hover:border-indigo-400 transition-all shadow-lg"
                                                title="Ver en Vivo (Remoto)"
                                            >
                                                <Eye size={18} />
                                            </Button>

                                            {/* Relay Trigger Button */}
                                            <Button
                                                onClick={() => handleTriggerRelay(dev.id)}
                                                disabled={isOpening}
                                                className={cn(
                                                    "w-10 h-10 rounded-xl transition-all duration-500 shadow-lg border relative group/relay overflow-hidden",
                                                    isOpening
                                                        ? "bg-emerald-500 border-emerald-400 text-white"
                                                        : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600"
                                                )}
                                                title="Abrir Puerta / Activar Relé"
                                            >
                                                {isOpening ? (
                                                    <Unlock className="animate-bounce" size={20} />
                                                ) : (
                                                    <Lock size={18} className="group-hover/relay:scale-110 transition-transform" />
                                                )}
                                            </Button>

                                            {dev.brand === 'AKUVOX' && (
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setConfigActionUrl(dev)}
                                                    className="h-10 w-10 rounded-xl border-neutral-800 bg-neutral-900/50 text-blue-400 hover:bg-indigo-600 hover:border-indigo-400 transition-all shadow-lg"
                                                    title="Configurar Action URLs"
                                                >
                                                    <Zap size={18} />
                                                </Button>
                                            )}

                                            {dev.deviceType === 'FACE_TERMINAL' && (
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setManagingMemory(dev)}
                                                    className="h-10 w-10 rounded-xl border-neutral-800 bg-neutral-900/50 text-emerald-400 hover:bg-emerald-500 hover:border-emerald-400 transition-all shadow-lg"
                                                    title="Memoria Flash"
                                                >
                                                    <Database size={18} />
                                                </Button>
                                            )}

                                            {dev.deviceType === 'LPR_CAMERA' && dev.brand === 'HIKVISION' && (
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setManagingPlates(dev)}
                                                    className="h-10 w-10 rounded-xl border-neutral-800 bg-neutral-900/50 text-blue-400 hover:bg-blue-500 hover:border-blue-400 transition-all shadow-lg"
                                                    title="Lista Blanca Interna"
                                                >
                                                    <Database size={18} />
                                                </Button>
                                            )}

                                            <DeviceFormDialog device={dev} groups={groups} onSuccess={loadData}>
                                                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-neutral-800 bg-neutral-900/50 text-blue-400 hover:bg-blue-500/10 transition-all shadow-lg">
                                                    <Settings2 size={18} />
                                                </Button>
                                            </DeviceFormDialog>

                                            <DeleteConfirmDialog
                                                id={dev.id}
                                                title={dev.name}
                                                description="Se perderá la conexión con este hardware."
                                                onDelete={deleteDevice}
                                                onSuccess={loadData}
                                            >
                                                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-neutral-800 bg-neutral-900/50 text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all">
                                                    <Trash2 size={18} />
                                                </Button>
                                            </DeleteConfirmDialog>
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
