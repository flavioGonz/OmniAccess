"use client";

import React, { useState, useEffect } from "react";
import {
    Activity,
    Shield,
    Plus,
    ExternalLink,
    Siren,
    MapPin,
    X,
    UserCheck,
    CheckCircle2,
    UserX,
    CarFront
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SystemFlow from "@/components/dashboard/SystemFlow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { io } from "socket.io-client";
import dynamic from 'next/dynamic';
const LiveGuardMap = dynamic(() => import('@/components/LiveGuardMap'), { ssr: false });

export default function ConsolasAdminPage() {
    const [isAlertMode, setIsAlertMode] = useState(false);
    const [notification, setNotification] = useState<{ type: "success" | "error" | "info" | "alert", title: string, message: string } | null>(null);
    const [guardLocations, setGuardLocations] = useState<any[]>([]);
    const [showFullMap, setShowFullMap] = useState(false);
    const socketRef = React.useRef<any>(null);
    const isFirstRun = React.useRef(true);

    const showNotification = (title: string, message: string, type: "success" | "error" | "info" | "alert" = "success", duration: number = 3000) => {
        setNotification({ type, title, message });
        setTimeout(() => setNotification(null), duration);
    };

    // BACKUP / ALERTS STATE
    const [activeMissions, setActiveMissions] = useState<any[]>([]);
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [backupLocation, setBackupLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [backupDetail, setBackupDetail] = useState("");

    // Initial load and Socket setup
    useEffect(() => {
        // Socket connection for real-time presence
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        const isStandardPort = window.location.port === '' || window.location.port === '80' || window.location.port === '443';
        const socketUrl = isStandardPort
            ? `${protocol}://${window.location.hostname}`
            : `${protocol}://${window.location.hostname}:10000`;
        const socket = io(socketUrl);
        socketRef.current = socket;

        socket.on('guard_locations', (data: any) => {
            setGuardLocations(data);
        });

        socket.on('alert_status', (data: any) => {
            if (isFirstRun.current) {
                setIsAlertMode(data.active);
                isFirstRun.current = false;
                return;
            }

            setIsAlertMode(prevMode => {
                if (prevMode && !data.active) {
                    showNotification("SISTEMA NORMALIZADO", "La alerta de seguridad ha sido desactivada correctamente.", "success");
                } else if (!prevMode && data.active) {
                    showNotification("ALERTA ACTIVADA", `El modo de alerta ha sido activado por ${data.triggeredBy || "un compañero"}.`, "alert", 5000);

                    // Play alert sound
                    const audio = new Audio('/sounds/alert.mp3');
                    audio.volume = 1.0;
                    audio.play().catch(err => console.log('Audio play failed:', err));

                    // Vibrate if supported
                    if ('vibrate' in navigator) {
                        navigator.vibrate([200, 100, 200, 100, 200]);
                    }

                    // Show PWA notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('🚨 ALERTA DE SEGURIDAD', {
                            body: `Modo de alerta activado por ${data.triggeredBy || "un compañero"}`,
                            icon: '/icon-192.png',
                            badge: '/icon-192.png',
                            requireInteraction: true,
                            tag: 'security-alert'
                        });
                    } else if ('Notification' in window && Notification.permission !== 'denied') {
                        // Request permission
                        Notification.requestPermission().then(permission => {
                            if (permission === 'granted') {
                                new Notification('🚨 ALERTA DE SEGURIDAD', {
                                    body: `Modo de alerta activado por ${data.triggeredBy || "un compañero"}`,
                                    icon: '/icon-192.png',
                                    badge: '/icon-192.png',
                                    requireInteraction: true,
                                    tag: 'security-alert'
                                });
                            }
                        });
                    }
                }
                return data.active;
            });
        });

        // MISSION & BACKUP LISTENERS
        socket.on('active_missions', (data: any[]) => {
            setActiveMissions(data);
        });

        socket.on('backup_requested', (data: any) => {
            setActiveMissions(prev => {
                if (prev.some(m => m.id === data.id)) return prev;
                return [...prev, data];
            });
            showNotification("NUEVA ALERTA", "Se ha reportado un incidente.", "alert");
        });

        socket.on('backup_status_update', (data: any) => {
            setActiveMissions(prev => prev.map(m =>
                m.id === data.requestId
                    ? { ...m, status: data.accepted ? 'ACCEPTED' : 'REJECTED', responderId: data.responderId, responderName: data.responderName }
                    : m
            ));
        });

        socket.on('backup_resolved', (data: any) => {
            setActiveMissions(prev => prev.filter(m => m.id !== data.requestId));
            showNotification("RESUELTO", `Incidente cerrado por ${data.resolverName}`, "success");
        });

        socket.on('backup_cancelled', (data: any) => {
            setActiveMissions(prev => prev.filter(m => m.id !== data.requestId));
        });

        socket.on('backup_cancelled_by_user', (data: any) => {
            setActiveMissions(prev => prev.filter(m => m.id !== data.requestId));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickPlate, setQuickPlate] = useState("");
    const [quickName, setQuickName] = useState("");
    const [quickUnit, setQuickUnit] = useState("");
    <div className="flex h-screen overflow-hidden transition-all duration-700 relative bg-[#0a0a0c]">

        {/* Main Layout: Flow on left, Quick Action on right */}
        <div className="flex-1 flex overflow-hidden">
            {/* Left: Network Topology */}
            <div className="flex-1 relative border-r border-neutral-800 overflow-hidden group/flow">
                <SystemFlow mode="consoles" />

                {/* Floating Info Overlay */}
                <div className="absolute top-6 left-6 z-50 p-4 transition-all duration-500">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20">
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

                    {/* Floating View All Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => window.location.href = "/admin/bitacora"}
                        className="bg-neutral-800 hover:bg-neutral-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl border-2 border-neutral-700/50"
                    >
                        <ExternalLink size={24} />
                    </motion.button>
                    {/* Floating Map Toggle - Moved from bottom left */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowFullMap(true)}
                        className="bg-neutral-800 hover:bg-neutral-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl border-2 border-neutral-700/50"
                    >
                        <MapPin size={24} />
                    </motion.button>
                </div>
            </div>

            {/* Right: Quick Operational Panel */}

        </div>



        {/* Quick Register Modal */}
        <AnimatePresence>
            {
                showQuickRegister && (
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
                )
            }
        </AnimatePresence>

        {/* Photo Lightbox */}
        <AnimatePresence>
            {
                selectedPhoto && (
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
                )
            }
        </AnimatePresence>

        {/* Audio Player Modal */}
        <AnimatePresence>
            {
                selectedAudio && (
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
                )
            }
        </AnimatePresence>



        {/* FULL SCREEN MAP MODAL */}
        <AnimatePresence>
            {
                showFullMap && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[100] bg-black flex flex-col"
                    >
                        <div className="flex-1 w-full h-full relative">
                            {/* Close Button */}
                            <div className="absolute top-6 right-6 z-[200]">
                                <button onClick={() => setShowFullMap(false)} className="bg-white text-black p-4 rounded-full hover:bg-gray-200 transition-colors shadow-xl">
                                    <X size={32} />
                                </button>
                            </div>

                            <LiveGuardMap
                                myLocation={null}
                                guards={guardLocations}
                                socketId={socketRef.current?.id}
                                onLongPress={(latlng) => {
                                    setBackupLocation(latlng);
                                    setShowBackupModal(true);
                                }}
                                backupMissions={activeMissions}
                            />

                            {/* Overlay Title - Glassmorphism */}
                            <div className="absolute top-6 left-6 z-[100] bg-white/30 backdrop-blur-xl px-8 py-6 rounded-3xl shadow-2xl border border-white/20 border-l-8 border-l-[#B20D30]">
                                <h2 className="text-4xl font-black uppercase text-black tracking-tighter">Mapa Táctico</h2>
                                <p className="text-sm font-bold text-gray-800 uppercase tracking-widest mt-1">Monitoreo en Tiempo Real</p>
                            </div>
                        </div>
                    </motion.div>
                )
            }
        </AnimatePresence>

        {/* BACKUP REQUEST MODAL (ADMIN) */}
        <AnimatePresence>
            {
                showBackupModal && (
                    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl relative overflow-hidden"
                        >
                            <div className="text-center mb-6 relative z-10">
                                <h2 className="text-3xl font-black uppercase text-[#B20D30] tracking-tighter">Reportar Incidente</h2>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Consola de Administración</p>
                            </div>

                            <div className="mb-6 relative z-10">
                                <label className="text-[10px] uppercase font-black text-gray-400 mb-2 block tracking-widest">Detalles Adicionales</label>
                                <input
                                    type="text"
                                    placeholder="Descripción del sospechoso..."
                                    value={backupDetail}
                                    onChange={(e) => setBackupDetail(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-black focus:outline-none focus:border-[#B20D30] transition-colors uppercase text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                <button onClick={() => {
                                    if (socketRef.current && backupLocation) {
                                        const mission = {
                                            id: 'req-admin-' + Date.now(),
                                            type: 'INDIVIDUO SOSPECHOSO',
                                            lat: backupLocation.lat, lng: backupLocation.lng,
                                            requesterName: "Administrador",
                                            requesterId: socketRef.current.id,
                                            status: 'PENDING',
                                            details: backupDetail
                                        };
                                        socketRef.current.emit('request_backup', mission);
                                        // Add locally if not listening to own emit (depends on server impl, safe to add if unique)
                                        setActiveMissions(prev => {
                                            if (prev.some(m => m.id === mission.id)) return prev;
                                            return [...prev, mission];
                                        });
                                        setShowBackupModal(false);
                                        setBackupDetail("");
                                        showNotification("ENVIADO", "Alerta administrativa generada.", "info");
                                    }
                                }} className="bg-red-50 hover:bg-red-100 border-2 border-transparent hover:border-[#B20D30]/20 py-6 rounded-2xl flex flex-col items-center gap-3 transition-all group active:scale-95">
                                    <div className="w-16 h-16 bg-white shadow-lg rounded-full flex items-center justify-center text-[#B20D30] group-hover:scale-110 transition-transform">
                                        <UserX size={32} />
                                    </div>
                                    <span className="text-sm font-black uppercase text-[#B20D30] leading-tight">Individuo<br />Sospechoso</span>
                                </button>

                                <button onClick={() => {
                                    if (socketRef.current && backupLocation) {
                                        const mission = {
                                            id: 'req-admin-' + Date.now(),
                                            type: 'VEHICULO SOSPECHOSO',
                                            lat: backupLocation.lat, lng: backupLocation.lng,
                                            requesterName: "Administrador",
                                            requesterId: socketRef.current.id,
                                            status: 'PENDING',
                                            details: backupDetail
                                        };
                                        socketRef.current.emit('request_backup', mission);
                                        setActiveMissions(prev => {
                                            if (prev.some(m => m.id === mission.id)) return prev;
                                            return [...prev, mission];
                                        });
                                        setShowBackupModal(false);
                                        setBackupDetail("");
                                        showNotification("ENVIADO", "Alerta administrativa generada.", "info");
                                    }
                                }} className="bg-slate-50 hover:bg-slate-100 border-2 border-transparent hover:border-slate-300 py-6 rounded-2xl flex flex-col items-center gap-3 transition-all group active:scale-95">
                                    <div className="w-16 h-16 bg-white shadow-lg rounded-full flex items-center justify-center text-slate-700 group-hover:scale-110 transition-transform">
                                        <CarFront size={32} />
                                    </div>
                                    <span className="text-sm font-black uppercase text-slate-700 leading-tight">Vehículo<br />Sospechoso</span>
                                </button>
                            </div>

                            <button onClick={() => setShowBackupModal(false)} className="mt-6 w-full py-3 text-xs font-bold uppercase text-gray-400 hover:text-black transition-colors">
                                Cancelar
                            </button>
                        </motion.div>
                    </div>
                )
            }
        </AnimatePresence>

        {/* NOTIFICATION OVERLAY SCREEN */}
        <AnimatePresence>
            {
                notification && (
                    <NotificationOverlay
                        {...notification}
                        onClose={() => setNotification(null)}
                    />
                )
            }
        </AnimatePresence>
    </div>
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
                isAlert ? "bg-red-600/95" : (type === "success" ? "bg-emerald-600/95" : "bg-black/90")
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
                    isAlert ? "bg-white text-red-600" : (type === "success" ? "bg-white text-emerald-600" : "bg-white text-black")
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
