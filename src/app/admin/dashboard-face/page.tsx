"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessEvents, getEventsCountToday } from "@/app/actions/history";
import { getSetting, updateSetting, testFaceEngineConnection } from "@/app/actions/settings";
import { searchByPhotoAction } from "@/app/actions/face-verify";
import {
    SlidersHorizontal, Upload, Trash2, Map as MapIcon, Bell, Settings,
    Users, UserPlus, Ban, ArrowLeft, MoreVertical, Check, X,
    ScanFace, Cpu, ShieldAlert, ShieldCheck, Info, Activity,
    Search, RefreshCcw, Brain, UserSearch, Loader2
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AccessEvent, Device, Unit } from "@prisma/client";
import { getSocketUrl } from "@/lib/socket-config";
import { getImagePath } from "@/lib/image-path";
import SecuritySidebar from "@/components/dashboard/SecuritySidebar";
import SecurityFeed from "@/components/dashboard/SecurityFeed";
import { AnimatePresence, motion } from "framer-motion";
import { verifyFaceAction } from "@/app/actions/face-verify";
import { FaceMatchModal } from "@/components/dashboard/FaceMatchModal";
import FaceDashboardMap from "@/components/dashboard/FaceDashboardMap";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface FullAccessEvent extends AccessEvent {
    user: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        dni: string | null;
        apartment: string | null;
        cara: string | null;
        unit: Unit | null;
        parkingSlotId: string | null;
        role: string | null;
        observations: string | null;
        createdAt: Date;
    } | null;
    device: Device | null;
}

export default function FaceDashboard() {
    const [events, setEvents] = useState<FullAccessEvent[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [stats, setStats] = useState({ total: 0, grants: 0, denies: 0 });
    const [lastEvent, setLastEvent] = useState<FullAccessEvent | null>(null);
    const [similarityThreshold, setSimilarityThreshold] = useState(85);
    const [isSavingThreshold, setIsSavingThreshold] = useState(false);
    const [showThresholdConfig, setShowThresholdConfig] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [verifications, setVerifications] = useState<Record<string, any>>({});
    const [neuralDetections, setNeuralDetections] = useState<FullAccessEvent[]>([]);
    const [isAutoPopupEnabled, setIsAutoPopupEnabled] = useState(true);
    const [selectedViewEvent, setSelectedViewEvent] = useState<FullAccessEvent | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [blacklistEvents, setBlacklistEvents] = useState<FullAccessEvent[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Floor Plan State
    const [floorPlans, setFloorPlans] = useState<any[]>([]);
    const [currentFloorPlan, setCurrentFloorPlan] = useState<any | null>(null);
    const [isUploadingMap, setIsUploadingMap] = useState(false);
    const mapFileInputRef = useRef<HTMLInputElement>(null);

    // AI Config State
    const [faceMode, setFaceMode] = useState("BLACKLIST");
    const [aiConfig, setAiConfig] = useState({ endpoint: "", apiKey: "", minSimilarity: 0.8 });
    const [savingAi, setSavingAi] = useState(false);
    const [testingAi, setTestingAi] = useState(false);
    const [isSearchingFace, setIsSearchingFace] = useState(false);
    const [searchResult, setSearchResult] = useState<any>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadInitialData = async () => {
            const threshold = await getSetting("COMPAREFACE_MIN_SIM");
            if (threshold?.value) {
                setSimilarityThreshold(Math.round(parseFloat(threshold.value) * 100));
            }

            const mode = await getSetting("MODE_FACE");
            if (mode) setFaceMode(mode.value);

            const urlSet = await getSetting("COMPAREFACE_URL");
            const keySet = await getSetting("COMPAREFACE_KEY");
            setAiConfig({
                endpoint: urlSet?.value || "",
                apiKey: keySet?.value || "",
                minSimilarity: threshold ? parseFloat(threshold.value) : 0.8
            });

            // Load Floor Plans
            const { getFloorPlans } = await import("@/app/actions/floorplans");
            const fps = await getFloorPlans();
            setFloorPlans(fps);
            if (fps.length > 0) setCurrentFloorPlan(fps[0]);
        };
        loadInitialData();
    }, []);

    const handleMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingMap(true);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const url = reader.result as string;
                const { createFloorPlan } = await import("@/app/actions/floorplans");
                const newFP = await createFloorPlan(`Plano ${floorPlans.length + 1}`, url);
                setFloorPlans(prev => [...prev, newFP]);
                setCurrentFloorPlan(newFP);
                toast.success("Nuevo plano añadido");
            };
            reader.readAsDataURL(file);
        } catch (err) {
            toast.error("Error al subir plano");
        } finally {
            setIsUploadingMap(false);
            if (mapFileInputRef.current) mapFileInputRef.current.value = "";
        }
    };

    const handleSaveThreshold = async (val: number) => {
        setSimilarityThreshold(val);
        setIsSavingThreshold(true);
        try {
            await updateSetting("COMPAREFACE_MIN_SIM", (val / 100).toString());
            toast.success(`Umbral actualizado a ${val}%`, {
                className: "bg-emerald-950 border-emerald-500 text-white font-black uppercase tracking-widest"
            });
        } catch (e) {
            toast.error("Error al guardar umbral");
        } finally {
            setIsSavingThreshold(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSearchingFace(true);
        setSearchResult(null);

        const toastId = toast.loading("Buscando rostro en base de datos...");

        try {
            const buffer = await file.arrayBuffer();
            // Use visitors collection as priority for manual search if requested, or just both
            const result = await searchByPhotoAction(new Uint8Array(buffer), true);

            if (result.success && result.match) {
                setSearchResult(result);
                toast.success(`Rostro identificado: ${result.match.subject} (${(result.match.similarity * 100).toFixed(1)}%)`, { id: toastId });
            } else {
                toast.error("No se encontraron coincidencias para este rostro", { id: toastId });
            }
        } catch (err) {
            toast.error("Error al procesar la búsqueda", { id: toastId });
        } finally {
            setIsSearchingFace(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleVerification = async (event: FullAccessEvent) => {
        if (!event.snapshotPath) return;

        setVerifications(prev => ({
            ...prev,
            [event.id]: { loading: true }
        }));

        try {
            const result = await verifyFaceAction(event.snapshotPath, event.userId || "", event.user?.name);
            setVerifications(prev => ({
                ...prev,
                [event.id]: { ...result, loading: false }
            }));

            // If it matched someone in Neural Engine, add to detections list
            if (result.similarity > 0) {
                setNeuralDetections(prev => {
                    // Avoid duplicates and keep last 5
                    const filtered = prev.filter(e => e.id !== event.id);
                    return [event, ...filtered].slice(0, 5);
                });
            }

            // If blacklisted, add to map alerts
            if (event.user?.role === 'BLACKLISTED' || result.user?.role === 'BLACKLISTED') {
                setBlacklistEvents(prev => {
                    const filtered = prev.filter(e => e.id !== event.id);
                    return [event, ...filtered];
                });
            }

            if (result.verified) {
                toast.success(`STATUS: IDENTIDAD VERIFICADA`, {
                    description: `${result.recognizedAs} | Confianza: ${(result.similarity * 100).toFixed(1)}%`,
                    className: "bg-emerald-950 border-emerald-500 text-white font-black uppercase tracking-widest"
                });
            }
        } catch (err) {
            console.error("Verification failed", err);
            setVerifications(prev => ({
                ...prev,
                [event.id]: { loading: false, error: true }
            }));
        }
    };

    const dismissAlarm = () => {
        // Function kept for compatibility if needed elsewhere, but logic removed
    };

    useEffect(() => {
        setMounted(true);
        const loadInitialData = async () => {
            try {
                const data = await getAccessEvents({ take: 30, type: 'FACE' });
                setEvents(data.events as FullAccessEvent[]);
                const todayStats = await getEventsCountToday('FACE');
                setStats(todayStats);
            } catch (error) {
                console.error("Error loading data:", error);
            }
        };

        loadInitialData();

        const socketUrl = getSocketUrl();
        const newSocket = io(socketUrl, { transports: ["websocket", "polling"] });

        newSocket.on("connect", () => setIsConnected(true));
        newSocket.on("disconnect", () => setIsConnected(false));

        const handleNewEvent = (event: FullAccessEvent) => {
            if (event.accessType !== 'FACE' && !event.snapshotPath?.includes('face')) return;

            setEvents((prev) => [event, ...prev].slice(0, 30));
            setStats(prev => ({
                total: prev.total + 1,
                grants: prev.grants + (event.decision === "GRANT" ? 1 : 0),
                denies: prev.denies + (event.decision === "DENY" ? 1 : 0)
            }));
            setLastEvent(event);

            // Trigger double verification
            handleVerification(event);

            // Auto-popup only if camera has compared data (positive ID)
            const nativeName = event.details?.match(/Persona: ([^,]+)/)?.[1];
            const isCompared = nativeName && nativeName !== 'Desconocido' && nativeName !== 'N/A' && nativeName !== 'Unknown';

            if (isAutoPopupEnabled && isCompared) {
                setSelectedViewEvent(event);
            }
        };

        newSocket.on("access_event", handleNewEvent);
        newSocket.on("NEW_ACCESS", handleNewEvent); // Support Hikvision driver event name

        setSocket(newSocket);
        return () => { newSocket.disconnect(); };
    }, []);



    return (
        <div className="flex h-screen bg-black text-white overflow-hidden font-sans selection:bg-red-500/30">
            {/* Left Sidebar */}
            <SecuritySidebar />

            <div className="flex-1 flex flex-col relative overflow-hidden">
                {/* Full Screen Map Background */}
                <div className="absolute inset-0 z-0">
                    <FaceDashboardMap
                        lastEventId={lastEvent?.id}
                        lastEvent={lastEvent}
                        blacklistPopups={blacklistEvents}
                        onClosePopup={(id) => setBlacklistEvents(prev => prev.filter(e => e.id !== id))}
                        currentFloorPlan={currentFloorPlan}
                        floorPlans={floorPlans}
                    />
                </div>

                {/* Floating UI Layer */}
                <div className="relative z-10 flex flex-col h-full pointer-events-none">
                    {/* Top Floating Feed: ENTRADA */}
                    <div className="w-full p-6 pb-0 pointer-events-auto">
                        <div className="h-[160px] w-full bg-transparent overflow-hidden relative">
                            <div className="absolute top-3 left-6 flex items-center gap-2 z-10">
                                <Activity size={12} className="text-[#B20D30] animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/60">Monitor En Vivo (ENTRADA)</span>
                            </div>

                            <div className="flex items-center gap-4 px-6 pt-12 pb-4 overflow-x-auto overflow-y-hidden custom-scrollbar h-full flex-nowrap scroll-smooth">
                                {events.filter(e => e.snapshotPath && (e.direction === 'ENTRY' || !e.direction)).slice(0, 15).map((event) => (
                                    <FeedCard
                                        key={event.id}
                                        event={event}
                                        verification={verifications[event.id]}
                                        currentTime={currentTime}
                                        onClick={() => setSelectedViewEvent(event)}
                                    />
                                ))}
                                {events.length === 0 && !isConnected && (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <p className="text-[10px] font-black text-neutral-800 uppercase tracking-widest">Enlazando sistema de monitoreo...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Middle Area: Neural Detections Row */}
                    <div className="flex-1 relative">
                        <div className="absolute bottom-10 left-10 right-10 flex gap-4 pointer-events-none">
                            <AnimatePresence>
                                {neuralDetections.map((detEvent) => (
                                    <motion.div
                                        key={detEvent.id}
                                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8, x: -20 }}
                                        className="w-72 bg-black/40 backdrop-blur-md border border-white/5 shadow-2xl z-40 overflow-hidden rounded-3xl group/scanning pointer-events-auto shrink-0"
                                    >
                                        <div className="absolute inset-0">
                                            <img
                                                src={getImagePath(detEvent.snapshotPath) || ""}
                                                className="w-full h-full object-cover grayscale opacity-40 group-hover/scanning:scale-110 transition-transform duration-[2000ms]"
                                                alt="Subject"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                                        </div>

                                        <div className="relative p-6 space-y-5">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                                                        <p className="text-[8px] font-black text-red-500 uppercase tracking-[0.2em]">Detección Neural</p>
                                                    </div>
                                                    <h3 className="text-xl font-black uppercase tracking-tight truncate leading-tight">
                                                        {detEvent.user?.name || (verifications[detEvent.id]?.recognizedAs || "No Identificado")}
                                                    </h3>
                                                    <p className="text-[8px] font-mono text-neutral-500 mt-1 uppercase tracking-widest">
                                                        Time: {new Date(detEvent.timestamp || detEvent.createdAt).toLocaleTimeString()}
                                                    </p>
                                                </div>

                                                <button
                                                    onClick={() => setNeuralDetections(prev => prev.filter(d => d.id !== detEvent.id))}
                                                    className="p-1 hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition-all"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>

                                            <div className="space-y-3 pt-4 border-t border-white/10">
                                                <StatusRow label="Terminal" value={detEvent.device?.name || "Access Point"} />
                                                <StatusRow
                                                    label="Verificación"
                                                    value={verifications[detEvent.id]?.loading ? "PROCESANDO..." : (verifications[detEvent.id]?.verified ? "CONCORDANCIA" : "DESCONOCIDO")}
                                                    color={verifications[detEvent.id]?.verified ? "text-emerald-500" : "text-amber-500"}
                                                />
                                            </div>

                                            <button
                                                onClick={() => setSelectedViewEvent(detEvent)}
                                                className="w-full h-11 bg-white/10 backdrop-blur-md border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#B20D30] hover:text-white transition-all rounded-xl mt-2 flex items-center justify-center gap-2"
                                            >
                                                <Search size={12} />
                                                Inspeccionar
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        <div className="absolute top-0 right-6 flex flex-col gap-4 pointer-events-auto z-40 items-end">
                            <div className="flex flex-col gap-2 p-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.4)]">
                                <Link href="/admin/dashboard-face/whitelist" title="Lista Blanca" className="w-10 h-10 rounded-full flex items-center justify-center text-emerald-500 hover:bg-emerald-500/10 transition-colors">
                                    <Users size={18} />
                                </Link>
                                <Link href="/admin/dashboard-face/blacklist" title="Lista Negra" className="w-10 h-10 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors">
                                    <Ban size={18} />
                                </Link>
                                <Link href="/admin/dashboard-face/upload" title="Inscribir" className="w-10 h-10 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-500/10 transition-colors">
                                    <UserPlus size={18} />
                                </Link>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Buscar Rostro Manualmente"
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        isSearchingFace ? "animate-pulse text-amber-500" : "text-amber-500 hover:bg-amber-500/10"
                                    )}
                                >
                                    {isSearchingFace ? <Loader2 className="animate-spin" size={18} /> : <UserSearch size={18} />}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                />

                                <div className="h-[1px] w-6 bg-white/10 mx-auto my-1" />

                                {/* AI Config Popover requested by user */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all" title="AI Configuration">
                                            <Brain size={18} />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent side="left" className="w-80 bg-black/90 border-white/10 backdrop-blur-xl p-6 rounded-2xl shadow-2xl z-[100]">
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Cpu className="text-red-500" size={16} />
                                                <h3 className="text-xs font-black text-white uppercase tracking-widest">AI Face Engine</h3>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] font-black uppercase text-neutral-500 tracking-widest pl-1">Endpoint</Label>
                                                    <Input
                                                        value={aiConfig.endpoint}
                                                        onChange={(e) => setAiConfig({ ...aiConfig, endpoint: e.target.value })}
                                                        placeholder="http://..."
                                                        className="bg-white/5 border-white/5 h-9 text-[10px] font-mono"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] font-black uppercase text-neutral-500 tracking-widest pl-1">API Key</Label>
                                                    <Input
                                                        type="password"
                                                        value={aiConfig.apiKey}
                                                        onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                                                        className="bg-white/5 border-white/5 h-9 text-[10px] font-mono"
                                                    />
                                                </div>
                                                <div className="pt-2">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <Label className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Confianza</Label>
                                                        <span className="text-xs font-black text-red-500">{Math.round(similarityThreshold)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="50" max="99"
                                                        value={similarityThreshold}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value);
                                                            setSimilarityThreshold(val);
                                                            handleSaveThreshold(val);
                                                        }}
                                                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-600"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={async () => {
                                                        setTestingAi(true);
                                                        const res = await testFaceEngineConnection(aiConfig.endpoint, aiConfig.apiKey);
                                                        if (res.success) toast.success(res.message);
                                                        else toast.error(res.message);
                                                        setTestingAi(false);
                                                    }}
                                                    className="flex-1 h-8 bg-white/5 hover:bg-white/10 rounded-lg text-white font-black text-[9px] uppercase tracking-widest transition-all"
                                                >
                                                    {testingAi ? "Test..." : "Test"}
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        setSavingAi(true);
                                                        await updateSetting("COMPAREFACE_URL", aiConfig.endpoint);
                                                        await updateSetting("COMPAREFACE_KEY", aiConfig.apiKey);
                                                        toast.success("AI config actualizada");
                                                        setSavingAi(false);
                                                    }}
                                                    className="flex-1 h-8 bg-red-600 hover:bg-red-700 rounded-lg text-white font-black text-[9px] uppercase tracking-widest transition-all"
                                                >
                                                    {savingAi ? "..." : "Guardar"}
                                                </button>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <div className="h-[1px] w-6 bg-white/10 mx-auto my-1" />

                                {/* Mode Face Control Toggle requested by user */}
                                <button
                                    onClick={async () => {
                                        const newMode = faceMode === "BLACKLIST" ? "WHITELIST" : "BLACKLIST";
                                        setFaceMode(newMode);
                                        await updateSetting("MODE_FACE", newMode);
                                        toast.success(`Modo Face: ${newMode}`);
                                    }}
                                    className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        faceMode === "WHITELIST" ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                                    )}
                                    title={`Modo actual: ${faceMode === "BLACKLIST" ? "LISTA NEGRA" : "LISTA BLANCA"}`}
                                >
                                    {faceMode === "WHITELIST" ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                                </button>

                                <div className="h-[1px] w-6 bg-white/10 mx-auto my-1" />

                                {/* Floor Plan Controls moved to horizontal menu group */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button className="w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all" title="Gestionar Planos">
                                            <MapIcon size={18} />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent side="left" className="w-64 bg-black/90 border-white/10 backdrop-blur-xl p-4 rounded-2xl shadow-2xl z-[100]">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest leading-none">PLANOS DISPONIBLES</span>
                                                <button
                                                    onClick={() => mapFileInputRef.current?.click()}
                                                    className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all text-white"
                                                >
                                                    <Upload size={12} />
                                                </button>
                                            </div>
                                            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                                                {floorPlans.map(fp => (
                                                    <button
                                                        key={fp.id}
                                                        onClick={() => setCurrentFloorPlan(fp)}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                                                            currentFloorPlan?.id === fp.id ? "bg-[#B20D30] text-white" : "text-neutral-400 hover:bg-white/5"
                                                        )}
                                                    >
                                                        {fp.name}
                                                    </button>
                                                ))}
                                                {floorPlans.length === 0 && (
                                                    <p className="text-[9px] text-neutral-600 uppercase font-black tracking-widest text-center py-4">Sin planos cargados</p>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                ref={mapFileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleMapUpload}
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Auto Popup Toggle */}
                            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-3 rounded-3xl shadow-2xl flex flex-col items-center gap-2">
                                <Switch
                                    id="auto-popup-float"
                                    checked={isAutoPopupEnabled}
                                    onCheckedChange={setIsAutoPopupEnabled}
                                    className="scale-75 data-[state=checked]:bg-[#B20D30]"
                                />
                                <Label htmlFor="auto-popup-float" className="text-[8px] font-black uppercase tracking-widest text-white/40 cursor-pointer text-center leading-none">
                                    AUTO
                                </Label>
                            </div>

                            {/* Connectivity Status (Minimal) */}
                            <div className="flex flex-col items-center gap-1 mt-2">
                                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isConnected ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-red-600 shadow-[0_0_10px_#dc2626]")} />
                                <span className="text-[7px] font-black text-white/20 uppercase tracking-tighter">{isConnected ? "ONLINE" : "OFFLINE"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Floating Feed: SALIDA */}
                    <div className="w-full p-6 pt-0 pointer-events-auto">
                        <div className="h-[160px] w-full bg-transparent overflow-hidden relative">
                            <div className="absolute top-3 left-6 flex items-center gap-2 z-10">
                                <Activity size={12} className="text-[#B20D30] animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/60">Monitor En Vivo (SALIDA)</span>
                            </div>

                            <div className="flex items-center gap-4 px-6 pt-12 pb-4 overflow-x-auto overflow-y-hidden custom-scrollbar h-full flex-nowrap scroll-smooth">
                                {events.filter(e => e.snapshotPath && e.direction === 'EXIT').slice(0, 15).map((event) => (
                                    <FeedCard
                                        key={event.id}
                                        event={event}
                                        verification={verifications[event.id]}
                                        currentTime={currentTime}
                                        onClick={() => setSelectedViewEvent(event)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Removed Floating Hub */}

            {/* Tactical Face Match Modal */}
            {selectedViewEvent && (
                <FaceMatchModal
                    event={selectedViewEvent}
                    verification={selectedViewEvent ? verifications[selectedViewEvent.id] : null}
                    isOpen={!!selectedViewEvent}
                    onClose={() => {
                        setSelectedViewEvent(null);
                        dismissAlarm();
                    }}
                />
            )}

            <style jsx global>{`
                @font-face {
                    font-family: 'Outfit';
                    src: url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
                }
                body {
                    background: #000;
                    overflow: hidden;
                    font-family: 'Outfit', sans-serif;
                }
                * {
                    border-radius: 0.5rem !important;
                }
                header, nav, button, .rounded-2xl {
                    border-radius: 1rem !important;
                }
                .custom-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; display: block; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(178,13,48,0.3); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(178,13,48,0.6); }
            `}</style>
        </div>
    );
}

function StatusRow({ label, value, color = "text-white" }: any) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">{label}</span>
            <span className={cn("text-[11px] font-black uppercase tracking-tight", color)}>{value}</span>
        </div>
    );
}

function NavButton({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
    return (
        <button className={cn(
            "h-12 px-6 flex items-center gap-3 transition-all border-none",
            active ? "bg-[#B20D30] text-white shadow-[0_0_20px_rgba(178,13,48,0.3)]" : "text-white/40 hover:text-white hover:bg-white/5"
        )}>
            {icon}
            <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        </button>
    );
}

interface FeedCardProps {
    event: FullAccessEvent;
    verification: any;
    currentTime: Date;
    onClick: () => void;
}

function FeedCard({ event, verification, currentTime, onClick }: FeedCardProps) {
    const camMatch = event.details?.match(/CamMatch: ([\d.]+)%/);
    const cameraSimilarity = camMatch ? camMatch[1] : null;

    const similarity = verification?.similarity
        ? (verification.similarity * 100).toFixed(0)
        : cameraSimilarity;

    const isIntruso = (verification && !verification.verified && verification.loading === false) || event.user?.role === 'BLACKLISTED';
    const isWhiteList = event.user?.role === 'WHITELISTED';
    const personaName = event.details?.match(/Persona: ([^,]+)/)?.[1];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={{ y: -4, scale: 1.05 }}
            onClick={onClick}
            className={cn(
                "aspect-square h-full bg-black/5 backdrop-blur-sm relative overflow-hidden cursor-pointer group rounded-xl transition-all shrink-0 border border-white/5",
                isIntruso && "ring-2 ring-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]",
                isWhiteList && "ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]"
            )}
        >
            <div className={cn(
                "absolute inset-0 transition-all duration-700",
                isWhiteList ? "grayscale-0" : "grayscale group-hover:grayscale-0"
            )}>
                <img
                    src={getImagePath(event.snapshotPath) || ""}
                    className="w-full h-full object-cover"
                    alt=""
                />
            </div>

            {/* Identity Overlay requested by user */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md px-1 py-0.5 border-t border-white/5">
                <p className="text-[7.5px] font-black text-white uppercase truncate text-center leading-none">
                    {personaName || "Desconocido"}
                </p>
                {similarity && (
                    <p className={cn(
                        "text-[6px] font-bold text-center mt-0.5",
                        isIntruso ? "text-red-500" : isWhiteList ? "text-blue-400" : "text-emerald-500/60"
                    )}>
                        {similarity}%
                    </p>
                )}
            </div>
        </motion.div>
    );
}
