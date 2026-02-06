"use client";

import React, { useState, useEffect } from "react";
import {
    Monitor,
    Activity,
    Shield,
    Plus,
    User,
    Building2,
    ExternalLink,
    Filter,
    Calendar,
    Siren,
    Clock,
    Camera,
    ChevronRight,
    MapPin,
    Eye,
    Play,
    X,
    History,
    Search,
    RefreshCcw,
    Smartphone,
    UserCheck,
    Briefcase,
    Landmark,
    Flame,
    Car,
    Bike,
    CheckCircle2,
    Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SystemFlow from "@/components/dashboard/SystemFlow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getBitacoraEntries } from "@/app/actions/bitacora";
import { io } from "socket.io-client";
import { toast } from "sonner";

export default function ConsolasAdminPage() {
    const [activeConsoles, setActiveConsoles] = useState<any[]>([]);
    const [bitacoraHistory, setBitacoraHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAlertMode, setIsAlertMode] = useState(false);
    const [notification, setNotification] = useState<{ type: "success" | "error" | "info" | "alert", title: string, message: string } | null>(null);
    const socketRef = React.useRef<any>(null);

    const showNotification = (title: string, message: string, type: "success" | "error" | "info" | "alert" = "success", duration: number = 3000) => {
        setNotification({ type, title, message });
        setTimeout(() => setNotification(null), duration);
    };

    // Initial load and Socket setup
    useEffect(() => {
        async function loadData() {
            try {
                const entries = await getBitacoraEntries();
                setBitacoraHistory(entries);
            } catch (error) {
                console.error("Error loading bitacora:", error);
            } finally {
                setIsLoading(false);
            }
        }

        loadData();

        // Socket connection for real-time presence
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        const isStandardPort = window.location.port === '' || window.location.port === '80' || window.location.port === '443';
        const socketUrl = isStandardPort
            ? `${protocol}://${window.location.hostname}`
            : `${protocol}://${window.location.hostname}:10000`;
        const socket = io(socketUrl);
        socketRef.current = socket;

        socket.on('guard_presence', (data: any) => {
            setActiveConsoles(prev => {
                const existingIndex = prev.findIndex(c => c.guardName === data.guardName);
                const consoleData = {
                    ...data,
                    lastSeen: new Date(),
                    status: 'online'
                };

                if (existingIndex >= 0) {
                    const newConsoles = [...prev];
                    newConsoles[existingIndex] = consoleData;
                    return newConsoles;
                }
                return [...prev, consoleData];
            });
        });

        socket.on('new_bitacora', (entry: any) => {
            setBitacoraHistory(prev => [entry, ...prev]);
        });

        socket.on('alert_status', (data: any) => {
            setIsAlertMode(data.active);
            if (!data.active) {
                showNotification("SISTEMA NORMALIZADO", "La alerta de seguridad ha sido desactivada correctamente.", "success");
            } else {
                showNotification("ALERTA ACTIVADA", `El modo de alerta ha sido activado por ${data.triggeredBy || "un compañero"}.`, "alert", 5000);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Cleanup stale consoles (not seen in 30 seconds)
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveConsoles(prev =>
                prev.filter(c => {
                    const lastSeen = new Date(c.lastSeen).getTime();
                    const now = new Date().getTime();
                    return (now - lastSeen) < 30000;
                })
            );
        }, 10000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    const formatTime = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickPlate, setQuickPlate] = useState("");
    const [quickName, setQuickName] = useState("");
    const [quickUnit, setQuickUnit] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [selectedAudio, setSelectedAudio] = useState<string | null>(null);

    const filteredHistory = bitacoraHistory.filter(entry => {
        const matchesSearch =
            (entry.plate?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (entry.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (entry.destination?.toLowerCase() || "").includes(searchTerm.toLowerCase());

        const matchesDate = !filterDate || new Date(entry.timestamp).toISOString().split('T')[0] === filterDate;

        return matchesSearch && matchesDate;
    });

    const historyEntries = filteredHistory.filter(h => h.type === 'ENTRY');
    const historyExits = filteredHistory.filter(h => h.type === 'EXIT');

    const QuickActionCard = ({ entry }: { entry: any }) => (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative h-40 rounded-2xl overflow-hidden bg-neutral-800/40 border border-neutral-700/50 hover:border-blue-500/50 transition-all"
        >
            {/* Background Photo */}
            {entry.photoPath ? (
                <img
                    src={entry.photoPath}
                    alt="Capture"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
            ) : (
                <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
                    <Camera size={24} className="text-neutral-800" />
                </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {/* Content Overlay */}
            <div className="absolute inset-0 p-3 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                        <p className="text-[10px] font-black text-white uppercase tracking-widest">{entry.plate || '--- ---'}</p>
                    </div>
                    <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1">
                        <Clock size={8} className="text-neutral-400" />
                        <p className="text-[9px] font-black text-white">{formatTime(entry.timestamp)}</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <p className="text-[10px] font-bold text-white truncate drop-shadow-md">{entry.name || 'Invitado'}</p>
                    <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter truncate drop-shadow-md">{entry.destination || '---'}</p>
                </div>
            </div>

            {/* Hover Actions */}
            <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                {entry.photoPath && (
                    <button
                        onClick={() => setSelectedPhoto(entry.photoPath)}
                        className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                    >
                        <Eye size={18} />
                    </button>
                )}
                {entry.audioPath && (
                    <button
                        onClick={() => setSelectedAudio(entry.audioPath)}
                        className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                    >
                        <Play size={18} className="fill-current" />
                    </button>
                )}
            </div>
        </motion.div>
    );

    return (
        <div className="flex h-screen overflow-hidden transition-all duration-700 relative bg-[#0a0a0c]">

            {/* Main Layout: Flow on left, Quick Action on right */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Network Topology */}
                <div className="flex-1 relative border-r border-neutral-800 overflow-hidden group/flow">
                    <SystemFlow mode="consoles" />

                    {/* Floating Info Overlay */}
                    <div className="absolute top-6 left-6 z-50 backdrop-blur-md border border-neutral-800 p-6 rounded-[2.5rem] max-w-sm transition-all duration-500 bg-black/60 hover:bg-black/80">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/30">
                                    <Activity className="animate-pulse" size={16} />
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest text-white/80">
                                    Estado del Sistema
                                </span>
                            </div>
                        </div>

                        <p className="text-[11px] font-bold leading-relaxed text-neutral-400">
                            Visualización en tiempo real de la infraestructura operativa y consolas conectadas.
                        </p>
                    </div>

                    {/* Floating Quick Actions Container */}
                    <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-4">
                        {/* Panic Button */}
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                                if (socketRef.current) {
                                    socketRef.current.emit('alert_toggle', {
                                        active: !isAlertMode,
                                        triggeredBy: "Administrador"
                                    });
                                }
                            }}
                            className={cn(
                                "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all border-2",
                                isAlertMode
                                    ? "bg-white text-red-600 border-red-600 animate-pulse"
                                    : "bg-red-600 hover:bg-red-500 text-white border-red-400/20"
                            )}
                        >
                            <Siren size={24} className={isAlertMode ? "animate-bounce" : ""} />
                        </motion.button>

                        {/* Floating Quick Register Button */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowQuickRegister(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl shadow-blue-500/30 border-2 border-blue-400/20"
                        >
                            <Plus size={24} className="font-black" />
                        </motion.button>
                    </div>
                </div>

                {/* Right: Quick Operational Panel */}
                <aside className="w-[450px] overflow-y-auto custom-scrollbar p-8 flex flex-col gap-8 transition-all duration-500 bg-neutral-900 border-l border-neutral-800">

                    {/* Historial de Bitácora (New) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                                <History size={14} className="text-amber-500" /> Historial de Bitácora
                            </h3>
                            <button
                                onClick={() => window.location.href = "/admin/bitacora"}
                                className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-tighter transition-colors flex items-center gap-1"
                            >
                                <ExternalLink size={10} />
                                Ver Todo
                            </button>
                        </div>

                        {/* Search and Filters */}
                        <div className="flex gap-2 px-2">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-blue-500 transition-colors" size={12} />
                                <Input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar..."
                                    className="pl-8 bg-neutral-950 border-neutral-800 h-9 text-[10px] font-bold text-white placeholder:text-neutral-700 rounded-xl focus:border-blue-500/50 focus:ring-0 transition-all"
                                />
                            </div>

                            <div className="relative w-32 group">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 transition-colors group-focus-within:text-blue-500" size={12} />
                                <Input
                                    type="date"
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="pl-8 bg-neutral-950 border-neutral-800 h-9 text-[9px] font-black text-neutral-400 focus:border-blue-500/50 focus:ring-0 rounded-xl appearance-none uppercase"
                                />
                            </div>

                            {(searchTerm || filterDate) && (
                                <button
                                    onClick={() => { setSearchTerm(""); setFilterDate(""); }}
                                    className="px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-xl transition-colors shrink-0 h-9"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Column Entradas */}
                            <div className="space-y-4">
                                <div className="px-2 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20 text-center">
                                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em]">Entradas</span>
                                </div>
                                <div className="space-y-3">
                                    {isLoading ? (
                                        Array(2).fill(0).map((_, i) => (
                                            <div key={i} className="bg-neutral-800/20 h-40 rounded-2xl animate-pulse" />
                                        ))
                                    ) : historyEntries.length > 0 ? (
                                        historyEntries.slice(0, 5).map((entry) => (
                                            <QuickActionCard key={entry.id} entry={entry} />
                                        ))
                                    ) : (
                                        <p className="text-[9px] text-neutral-600 text-center py-4 font-bold uppercase">Sin entradas</p>
                                    )}
                                </div>
                            </div>

                            {/* Column Salidas */}
                            <div className="space-y-4">
                                <div className="px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20 text-center">
                                    <span className="text-[8px] font-black text-amber-400 uppercase tracking-[0.2em]">Salidas</span>
                                </div>
                                <div className="space-y-3">
                                    {isLoading ? (
                                        Array(2).fill(0).map((_, i) => (
                                            <div key={i} className="bg-neutral-800/20 h-40 rounded-2xl animate-pulse" />
                                        ))
                                    ) : historyExits.length > 0 ? (
                                        historyExits.slice(0, 5).map((entry) => (
                                            <QuickActionCard key={entry.id} entry={entry} />
                                        ))
                                    ) : (
                                        <p className="text-[9px] text-neutral-600 text-center py-4 font-bold uppercase">Sin salidas</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>


                </aside>
            </div>



            {/* Quick Register Modal */}
            <AnimatePresence>
                {showQuickRegister && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                        onClick={() => setShowQuickRegister(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-neutral-900 border border-neutral-700 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <Shield className="text-blue-500" size={24} />
                                    Registro Rápido
                                </h3>
                                <button
                                    onClick={() => setShowQuickRegister(false)}
                                    className="text-neutral-500 hover:text-white transition-colors"
                                >
                                    <Plus size={24} className="rotate-45" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Matrícula *</label>
                                    <Input
                                        value={quickPlate}
                                        onChange={(e) => setQuickPlate(e.target.value)}
                                        placeholder="--- ---"
                                        className="bg-neutral-950 border-neutral-800 h-14 text-xl font-black text-white tracking-widest text-center uppercase focus:border-blue-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Visitante</label>
                                        <Input
                                            value={quickName}
                                            onChange={(e) => setQuickName(e.target.value)}
                                            placeholder="Nombre..."
                                            className="bg-neutral-950 border-neutral-800 h-12 text-sm font-bold text-white focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest ml-1">Unidad</label>
                                        <Input
                                            value={quickUnit}
                                            onChange={(e) => setQuickUnit(e.target.value)}
                                            placeholder="Lote..."
                                            className="bg-neutral-950 border-neutral-800 h-12 text-sm font-bold text-white focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                <Button
                                    disabled={!quickPlate.trim()}
                                    onClick={() => {
                                        // TODO: Implement quick register logic
                                        console.log({ plate: quickPlate, name: quickName, unit: quickUnit });
                                        setShowQuickRegister(false);
                                        setQuickPlate("");
                                        setQuickName("");
                                        setQuickUnit("");
                                    }}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-2xl h-14 font-black uppercase text-sm tracking-widest shadow-lg shadow-emerald-500/10 mt-4"
                                >
                                    Registrar Acceso
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Photo Lightbox */}
            <AnimatePresence>
                {selectedPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 md:p-12"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="relative max-w-5xl w-full h-full flex items-center justify-center"
                        >
                            <img
                                src={selectedPhoto}
                                alt="Full Size"
                                className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl border border-white/10"
                            />
                            <button
                                onClick={() => setSelectedPhoto(null)}
                                className="absolute top-0 right-0 m-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-white transition-all shadow-xl"
                            >
                                <X size={24} />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Audio Player Modal */}
            <AnimatePresence>
                {selectedAudio && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4"
                    >
                        <div className="bg-neutral-900/90 backdrop-blur-2xl border border-white/10 p-6 rounded-[2.5rem] shadow-2xl flex items-center gap-6">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                <Play size={24} className="fill-current" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Nota de Audio</p>
                                <audio controls autoPlay src={selectedAudio} className="w-full h-8 brightness-90 contrast-125" />
                            </div>
                            <button
                                onClick={() => setSelectedAudio(null)}
                                className="text-neutral-500 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* NOTIFICATION OVERLAY SCREEN */}
            <AnimatePresence>
                {notification && (
                    <NotificationOverlay
                        {...notification}
                        onClose={() => setNotification(null)}
                    />
                )}
            </AnimatePresence>
        </div >
    );
}

function NotificationOverlay({ type, title, message, onClose }: { type: string, title: string, message: string, onClose: () => void }) {
    const isAlert = type === "alert" || type === "error";

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={cn(
                "fixed inset-0 z-[1000] flex flex-col items-center justify-center p-8 backdrop-blur-3xl",
                isAlert ? "bg-red-600/95" : "bg-black/90"
            )}
        >
            <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 20 }}
                className="flex flex-col items-center text-center max-w-2xl"
            >
                <div className={cn(
                    "w-32 h-32 rounded-[3rem] flex items-center justify-center mb-10 shadow-2xl relative",
                    isAlert ? "bg-white text-red-600" : "bg-white text-black"
                )}>
                    {type === "success" && <CheckCircle2 size={64} strokeWidth={2.5} />}
                    {type === "error" && <X size={64} strokeWidth={2.5} />}
                    {type === "info" && <UserCheck size={64} strokeWidth={2.5} />}
                    {type === "alert" && <Siren size={64} strokeWidth={2.5} className="animate-bounce" />}

                    {/* Pulsating Ring */}
                    <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 rounded-[3rem] border-4 border-white"
                    />
                </div>

                <h2 className="text-6xl font-black text-white uppercase tracking-tighter mb-4">
                    {title}
                </h2>
                <p className="text-xl font-black text-white/60 uppercase tracking-widest leading-relaxed">
                    {message}
                </p>

                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 3, ease: "linear" }}
                    className="h-2 bg-white/20 w-80 mt-12 rounded-full origin-left"
                />
            </motion.div>
        </motion.div>
    );
}
