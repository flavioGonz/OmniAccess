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
    CarFront,
    User as UserIcon,
    Loader2,
    Pencil,
    Trash2,

    Upload,
    Camera
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { getGuardsList, saveGuard, deleteGuard } from "@/app/actions/users";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import SystemFlow from "@/components/dashboard/SystemFlow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { io } from "socket.io-client";
import dynamic from 'next/dynamic';
const LiveGuardMap = dynamic(() => import('@/components/LiveGuardMap'), { ssr: false });

import { getSocketUrl } from "@/lib/socket-config";

export default function ConsolasAdminPage() {
    const [isAlertMode, setIsAlertMode] = useState(false);
    const [notification, setNotification] = useState<{ type: "success" | "error" | "info" | "alert", title: string, message: string } | null>(null);
    const [guardLocations, setGuardLocations] = useState<any[]>([]);
    const [showFullMap, setShowFullMap] = useState(false);
    const socketRef = React.useRef<any>(null);
    const [socketId, setSocketId] = useState<string | null>(null);
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

    // GUARD LIST LOGHIN
    const [showGuardList, setShowGuardList] = useState(false);
    const [guardsList, setGuardsList] = useState<any[]>([]);
    const [loadingGuards, setLoadingGuards] = useState(false);


    const [editingGuard, setEditingGuard] = useState<any>(null); // If null -> Create Mode
    const [isEditing, setIsEditing] = useState(false);
    const [guardForm, setGuardForm] = useState({
        name: "",
        dni: "",
        username: "",
        password: "",
        photo: null as File | null,
        currentPhoto: ""
    });

    const handleOpenGuardList = async () => {
        setLoadingGuards(true);
        setShowGuardList(true);
        setIsEditing(false);
        try {
            const guards = await getGuardsList();
            setGuardsList(guards);
        } catch (e) {
            console.error(e);
            showNotification("ERROR", "Error al cargar lista de guardias", "error");
        } finally {
            setLoadingGuards(false);
        }
    };

    const handleSaveGuard = async () => {
        if (!guardForm.name || !guardForm.dni) {
            showNotification("ERROR", "Nombre y DNI son obligatorios", "error");
            return;
        }

        const formData = new FormData();
        if (editingGuard) formData.append("id", editingGuard.id);
        formData.append("name", guardForm.name);
        formData.append("username", guardForm.username);
        formData.append("dni", guardForm.dni);
        if (guardForm.password) formData.append("password", guardForm.password);
        if (guardForm.photo) formData.append("photo", guardForm.photo);
        formData.append("currentPhoto", guardForm.currentPhoto);

        try {
            await saveGuard(formData);
            showNotification("ÉXITO", "Guardia guardado correctamente", "success");
            setIsEditing(false);
            handleOpenGuardList(); // Refresh list
        } catch (e) {
            console.error(e);
            showNotification("ERROR", "Error al guardar guardia", "error");
        }
    };

    const handleDeleteGuard = async (id: string) => {
        if (!confirm("¿Está seguro de eliminar este guardia?")) return;
        try {
            await deleteGuard(id);
            showNotification("ÉXITO", "Guardia eliminado", "success");
            handleOpenGuardList(); // Refresh list
        } catch (e) {
            console.error(e);
            showNotification("ERROR", "Error al eliminar guardia", "error");
        }
    };


    // Initial load and Socket setup
    useEffect(() => {
        // Socket connection for real-time presence
        const socketUrl = getSocketUrl();
        const socket = io(socketUrl);
        socketRef.current = socket;

        socket.on('connect', () => {
            setSocketId(socket.id || null);
        });

        socket.on('guard_locations', (data: any[]) => {
            setGuardLocations(data);
        });

        socket.on('alert_status', (data: { active: boolean, triggeredBy?: string }) => {
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

        socket.on('backup_requested', (data: { id: string, type: string }) => {
            setActiveMissions(prev => {
                if (prev.some(m => m.id === data.id)) return prev;
                return [...prev, data];
            });
            showNotification("NUEVA ALERTA", "Se ha reportado un incidente.", "alert");
        });

        socket.on('backup_status_update', (data: { requestId: string, accepted: boolean, responderId: string, responderName: string }) => {
            setActiveMissions(prev => prev.map(m =>
                m.id === data.requestId
                    ? { ...m, status: data.accepted ? 'ACCEPTED' : 'REJECTED', responderId: data.responderId, responderName: data.responderName }
                    : m
            ));
        });

        socket.on('backup_resolved', (data: { requestId: string, resolverName: string }) => {
            setActiveMissions(prev => prev.filter(m => m.id !== data.requestId));
            showNotification("RESUELTO", `Incidente cerrado por ${data.resolverName}`, "success");
        });

        socket.on('backup_cancelled', (data: { requestId: string }) => {
            setActiveMissions(prev => prev.filter(m => m.id !== data.requestId));
        });

        socket.on('backup_cancelled_by_user', (data: { requestId: string }) => {
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

    // Listen for guard presence to update online status
    useEffect(() => {
        if (!socketRef.current) return;
        socketRef.current.on('guard_presence', (data: any) => {
            setGuardLocations(prev => {
                const others = prev.filter(g => g.guardName !== data.guardName);
                return [...others, { ...data, lastSeen: new Date() }];
            });
        });
        return () => {
            socketRef.current?.off('guard_presence');
        };
    }, [socketRef.current]);

    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickPlate, setQuickPlate] = useState("");
    const [quickName, setQuickName] = useState("");
    const [quickUnit, setQuickUnit] = useState("");
    return (
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
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowFullMap(true)}
                            className="bg-neutral-800 hover:bg-neutral-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl border-2 border-neutral-700/50"
                        >
                            <MapPin size={24} />
                        </motion.button>

                        {/* Floating Guard List Button */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleOpenGuardList}
                            className="bg-slate-800 hover:bg-slate-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-2xl border-2 border-slate-700/50"
                        >
                            <UserIcon size={24} />
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
                                    socketId={socketId}
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

            {/* GUARD LIST MODAL */}
            <AnimatePresence>
                {showGuardList && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
                        onClick={() => setShowGuardList(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl max-w-4xl w-full p-8 overflow-hidden flex flex-col max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-[#B20D30] text-white flex items-center justify-center shadow-lg shadow-red-900/20">
                                        <Shield size={32} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black uppercase tracking-tighter text-white">
                                            {isEditing ? (editingGuard ? "Editar Guardia" : "Nuevo Guardia") : "Guardias Disponibles"}
                                        </h2>
                                        <p className="text-sm text-neutral-400 font-bold uppercase tracking-widest">
                                            {isEditing ? "Complete los datos del personal" : "Gestión y acceso de personal de seguridad"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isEditing && (
                                        <button
                                            onClick={() => {
                                                setEditingGuard(null);
                                                setEditingGuard(null);
                                                setGuardForm({ name: "", dni: "", username: "", password: "", photo: null, currentPhoto: "" });
                                                setIsEditing(true);
                                                setIsEditing(true);
                                            }}
                                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                                        >
                                            <Plus size={18} />
                                            Nuevo
                                        </button>
                                    )}
                                    <button onClick={() => setShowGuardList(false)} className="w-12 h-12 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors">
                                        <X size={24} className="text-white/60" />
                                    </button>
                                </div>
                            </div>

                            {loadingGuards ? (
                                <div className="flex-1 flex items-center justify-center py-20">
                                    <Loader2 size={48} className="text-neutral-500 animate-spin" />
                                </div>
                            ) : isEditing ? (
                                <div className="flex-1 overflow-y-auto p-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase text-neutral-500 tracking-wider">Nombre Completo</label>
                                                <Input
                                                    value={guardForm.name}
                                                    onChange={(e) => setGuardForm({ ...guardForm, name: e.target.value })}
                                                    className="bg-neutral-950 border-neutral-800 text-white h-12"
                                                    placeholder="Ej: Juan Pérez"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase text-neutral-500 tracking-wider">Usuario (Login)</label>
                                                <Input
                                                    value={guardForm.username}
                                                    onChange={(e) => setGuardForm({ ...guardForm, username: e.target.value })}
                                                    className="bg-neutral-950 border-neutral-800 text-white h-12"
                                                    placeholder="Ej: juan.perez"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase text-neutral-500 tracking-wider">DNI (Documento)</label>
                                                <Input
                                                    value={guardForm.dni}
                                                    onChange={(e) => setGuardForm({ ...guardForm, dni: e.target.value })}
                                                    className="bg-neutral-950 border-neutral-800 text-white h-12"
                                                    placeholder="Ej: 12345678"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold uppercase text-neutral-500 tracking-wider">Contraseña (PIN)</label>
                                                <Input
                                                    value={guardForm.password}
                                                    onChange={(e) => setGuardForm({ ...guardForm, password: e.target.value })}
                                                    className="bg-neutral-950 border-neutral-800 text-white h-12"
                                                    type="text"
                                                    placeholder={editingGuard ? "•••••• (Dejar vacío para mantener)" : "Ingrese contraseña"}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="relative w-48 h-48 rounded-full bg-neutral-950 border-4 border-neutral-800 overflow-hidden group cursor-pointer">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 z-20 cursor-pointer"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            setGuardForm({ ...guardForm, photo: file });
                                                        }
                                                    }}
                                                />
                                                {guardForm.photo ? (
                                                    <img src={URL.createObjectURL(guardForm.photo)} className="w-full h-full object-cover" />
                                                ) : guardForm.currentPhoto ? (
                                                    <Image src={guardForm.currentPhoto.startsWith('/') ? guardForm.currentPhoto : `/api/files/${guardForm.currentPhoto}`} fill className="object-cover" alt="Guard" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 gap-2">
                                                        <Camera size={32} />
                                                        <span className="text-xs font-bold uppercase">Subir Foto</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                                                    <Upload className="text-white" />
                                                </div>
                                            </div>
                                            <p className="text-xs text-neutral-500 text-center max-w-[200px]">Haga clic en el círculo para subir o cambiar la foto de perfil.</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-neutral-800">
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-6 py-3 rounded-xl text-neutral-400 hover:text-white font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSaveGuard}
                                            className="px-8 py-3 bg-[#B20D30] hover:bg-[#d9123c] rounded-xl text-white font-black uppercase tracking-widest transition-colors shadow-lg shadow-red-900/20"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <Table>
                                        <TableHeader className="bg-neutral-950/50 sticky top-0 backdrop-blur-sm z-10">
                                            <TableRow className="border-neutral-800 hover:bg-neutral-800/20">
                                                <TableHead className="w-[80px] text-[10px] font-black uppercase text-neutral-500 tracking-wider">Foto</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Nombre</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">DNI</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase text-neutral-500 tracking-wider text-center">Estado</TableHead>
                                                <TableHead className="text-[10px] font-black uppercase text-neutral-500 tracking-wider text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="bg-neutral-900/10">
                                            {guardsList.map((guard) => {
                                                const isOnline = guardLocations.some(l => l.guardName === guard.name && (new Date().getTime() - new Date(l.timestamp).getTime() < 30000));
                                                return (
                                                    <TableRow key={guard.id} className="border-neutral-800 hover:bg-neutral-800/30 transition-colors group">
                                                        <TableCell className="py-2">
                                                            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-neutral-800 shadow-inner">
                                                                {guard.cara ? (
                                                                    <Image src={guard.cara.startsWith('/') ? guard.cara : `/api/files/${guard.cara}`} alt={guard.name} fill className="object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                                                        <UserIcon size={16} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-bold text-white uppercase text-xs">{guard.name}</TableCell>
                                                        <TableCell className="text-neutral-400 font-mono text-xs">{guard.dni}</TableCell>
                                                        <TableCell className="text-center">
                                                            {isOnline ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                    Online
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-800/50 text-neutral-500 border border-neutral-700/50 text-[10px] font-bold uppercase tracking-wider">
                                                                    Offline
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingGuard(guard);
                                                                        setGuardForm({
                                                                            name: guard.name,
                                                                            dni: guard.dni || "",
                                                                            username: guard.username || "",
                                                                            password: guard.password || "",
                                                                            photo: null,
                                                                            currentPhoto: guard.cara || ""
                                                                        });
                                                                        setIsEditing(true);
                                                                    }}
                                                                    className="w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-600 text-blue-500 hover:text-white flex items-center justify-center transition-all"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteGuard(guard.id);
                                                                    }}
                                                                    className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white flex items-center justify-center transition-all"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>

                                    {guardsList.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-12 text-neutral-500 gap-4">
                                            <div className="w-16 h-16 rounded-full bg-neutral-900 border-2 border-dashed border-neutral-800 flex items-center justify-center">
                                                <UserX size={24} className="opacity-50" />
                                            </div>
                                            <p className="text-xs font-bold uppercase tracking-wider">No se encontraron guardias</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
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
