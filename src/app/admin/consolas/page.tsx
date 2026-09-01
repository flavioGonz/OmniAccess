"use client";

import React, { useState, useEffect } from "react";
import { sileo as toast } from "sileo";
import {
    Siren,
    MapPin,
    X,
    UserCheck,
    CheckCircle2,
    UserX,
    CarFront,
    History,
    PlusCircle,
    ShieldAlert,
    Users,
    Map as MapIcon,
    Grid,
    List,
    Search,
    RefreshCcw,
    FileSpreadsheet
} from "lucide-react";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { getBitacoraPage } from "@/app/actions/bitacora";
import BitacoraCard from "@/components/bitacora/BitacoraCard";
import BitacoraTable from "@/components/bitacora/BitacoraTable";
import ManualRegisterForm from "@/components/bitacora/ManualRegisterForm";
import GuardManagement from "@/components/bitacora/GuardManagement";
import PanicButtonTab from "@/components/bitacora/PanicButtonTab";
import GuardMapTab from "@/components/bitacora/GuardMapTab";
import { ExportBitacoraDialog } from "@/components/bitacora/ExportBitacoraDialog";
import { getSocketUrl } from "@/lib/socket-config";

const LiveGuardMap = dynamic(() => import("@/components/LiveGuardMap"), { ssr: false });

export default function ConsolasAdminPage() {
    const [isAlertMode, setIsAlertMode] = useState(false);
    const [notification, setNotification] = useState<{ type: "success" | "error" | "info" | "alert", title: string, message: string } | null>(null);
    const [guardLocations, setGuardLocations] = useState<any[]>([]);
    const [showFullMap, setShowFullMap] = useState(false);
    const socketRef = React.useRef<any>(null);
    const [socketId, setSocketId] = useState<string | null>(null);
    const isFirstRun = React.useRef(true);
    const [activeMissions, setActiveMissions] = useState<any[]>([]);
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [backupLocation, setBackupLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [backupDetail, setBackupDetail] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "table">("table");
    const [entries, setEntries] = useState<any[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

    const showNotification = (title: string, message: string, type: "success" | "error" | "info" | "alert" = "success", duration: number = 3000) => {
        setNotification({ type, title, message });
        setTimeout(() => setNotification(null), duration);
    };

    const loadEntries = async () => {
        setLoadingEntries(true);
        try {
            const data = await getBitacoraPage(0, 50, searchQuery);
            setEntries(data);
        } catch (error) {
            console.error("Error loading bitacora:", error);
        } finally {
            setLoadingEntries(false);
        }
    };

    useEffect(() => { loadEntries(); }, [searchQuery]);

    useEffect(() => {
        const socketUrl = getSocketUrl();
        const socket = io(socketUrl);
        socketRef.current = socket;

        socket.on("connect", () => { setSocketId(socket.id || null); });
        socket.on("guard_locations", (data: any[]) => { setGuardLocations(data); });

        socket.on("alert_status", (data: { active: boolean, triggeredBy?: string }) => {
            if (isFirstRun.current) { setIsAlertMode(data.active); isFirstRun.current = false; return; }
            setIsAlertMode(prevMode => {
                if (prevMode && !data.active) {
                    showNotification("SISTEMA NORMALIZADO", "La alerta de seguridad ha sido desactivada correctamente.", "success");
                } else if (!prevMode && data.active) {
                    showNotification("ALERTA ACTIVADA", `El modo de alerta ha sido activado por ${data.triggeredBy || "un compañero"}.`, "alert", 5000);
                    const audio = new Audio("/sounds/alert.mp3");
                    audio.volume = 1.0;
                    if ("vibrate" in navigator) { navigator.vibrate([200, 100, 200, 100, 200]); }
                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("ALERTA DE SEGURIDAD", { body: `Modo de alerta activado por ${data.triggeredBy || "un compañero"}`, icon: "/icon-192.png", badge: "/icon-192.png", requireInteraction: true, tag: "security-alert" });
                    } else if ("Notification" in window && Notification.permission !== "denied") {
                        Notification.requestPermission().then(permission => {
                            if (permission === "granted") {
                                new Notification("ALERTA DE SEGURIDAD", { body: `Modo de alerta activado por ${data.triggeredBy || "un compañero"}`, icon: "/icon-192.png", badge: "/icon-192.png", requireInteraction: true, tag: "security-alert" });
                            }
                        });
                    }
                }
                return data.active;
            });
        });

        socket.on("active_missions", (data: any[]) => { setActiveMissions(data); });
        socket.on("backup_requested", (data: { id: string, type: string }) => {
            setActiveMissions(prev => { if (prev.some(m => m.id === data.id)) return prev; return [...prev, data]; });
            showNotification("NUEVA ALERTA", "Se ha reportado un incidente.", "alert");
        });
        socket.on("backup_status_update", (data: { requestId: string, accepted: boolean, responderId: string, responderName: string }) => {
            setActiveMissions(prev => prev.map(m => m.id === data.requestId ? { ...m, status: data.accepted ? "ACCEPTED" : "REJECTED", responderId: data.responderId, responderName: data.responderName } : m));
        });
        socket.on("backup_resolved", (data: { requestId: string, resolverName: string }) => {
            setActiveMissions(prev => prev.filter(m => m.id !== data.requestId));
            showNotification("RESUELTO", `Incidente cerrado por ${data.resolverName}`, "success");
        });
        socket.on("backup_cancelled", (data: { requestId: string }) => { setActiveMissions(prev => prev.filter(m => m.id !== data.requestId)); });
        socket.on("backup_cancelled_by_user", (data: { requestId: string }) => { setActiveMissions(prev => prev.filter(m => m.id !== data.requestId)); });

        return () => { socket.disconnect(); };
    }, []);

    useEffect(() => {
        if (!socketRef.current) return;
        socketRef.current.on("guard_presence", (data: any) => {
            setGuardLocations(prev => {
                const others = prev.filter((g: any) => g.guardName !== data.guardName);
                return [...others, { ...data, lastSeen: new Date() }];
            });
        });
        return () => { socketRef.current?.off("guard_presence"); };
    }, [socketRef.current]);

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-black/40 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-red-600/10 rounded-2xl border border-red-600/20">
                        <History size={24} className="text-red-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">Consola de Administración</h1>
                        <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.3em]">Centro de Control y Bitácora Operativa</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isAlertMode && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-600/40 rounded-full animate-pulse">
                            <Siren size={14} className="text-red-500" />
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Alerta Activa</span>
                        </div>
                    )}
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => setShowFullMap(true)}
                        className="p-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl border border-neutral-800 transition-all"
                    >
                        <MapPin size={18} />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => { if (socketRef.current) { socketRef.current.emit("alert_toggle", { active: !isAlertMode, triggeredBy: "Administrador" }); } }}
                        className={cn("p-3 rounded-xl border transition-all",
                            isAlertMode ? "bg-white text-red-600 border-red-600 animate-pulse" : "bg-red-600 hover:bg-red-500 text-white border-red-400/20")}
                    >
                        <Siren size={18} className={isAlertMode ? "animate-bounce" : ""} />
                    </motion.button>
                </div>
            </div>

            {/* Tabbed Content */}
            <Tabs defaultValue="historial" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="bg-black/20 border-b border-neutral-800 w-full flex justify-start gap-2 md:gap-6 h-auto p-0 rounded-none px-6 backdrop-blur-xl shrink-0">
                    <TabsTrigger value="historial" className="pb-3 pt-3 px-1 md:px-3 rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-red-600 text-neutral-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest gap-2 transition-all hover:text-neutral-300 shadow-none!">
                        <History size={14} /> <span className="hidden md:inline">Historial</span>
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="pb-3 pt-3 px-1 md:px-3 rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-blue-600 text-neutral-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest gap-2 transition-all hover:text-neutral-300 shadow-none!">
                        <PlusCircle size={14} /> <span className="hidden md:inline">Registro Manual</span>
                    </TabsTrigger>
                    <TabsTrigger value="guards" className="pb-3 pt-3 px-1 md:px-3 rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-emerald-600 text-neutral-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest gap-2 transition-all hover:text-neutral-300 shadow-none!">
                        <Users size={14} /> <span className="hidden md:inline">Guardias</span>
                    </TabsTrigger>
                    <TabsTrigger value="panic" className="pb-3 pt-3 px-1 md:px-3 rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-amber-600 text-neutral-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest gap-2 transition-all hover:text-neutral-300 shadow-none!">
                        <ShieldAlert size={14} /> <span className="hidden md:inline">Pánico</span>
                    </TabsTrigger>
                    <TabsTrigger value="map" className="pb-3 pt-3 px-1 md:px-3 rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-indigo-600 text-neutral-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest gap-2 transition-all hover:text-neutral-300 shadow-none!">
                        <MapIcon size={14} /> <span className="hidden md:inline">Mapa</span>
                    </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <TabsContent value="historial" className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-0">
                        <div className="flex flex-col md:flex-row items-center gap-4 bg-black/40 border border-neutral-800 p-4 rounded-3xl backdrop-blur-sm">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
                                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar por matrícula, nombre o destino..."
                                    className="w-full bg-neutral-950 border-neutral-800 h-12 pl-12 rounded-2xl text-sm font-medium focus:ring-red-600/20" />
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
                                    <button onClick={() => setViewMode("grid")} className={cn("p-2 rounded-lg transition-all", viewMode === "grid" ? "bg-white text-black shadow" : "text-neutral-500 hover:text-white")}><Grid size={16} /></button>
                                    <button onClick={() => setViewMode("table")} className={cn("p-2 rounded-lg transition-all", viewMode === "table" ? "bg-white text-black shadow" : "text-neutral-500 hover:text-white")}><List size={16} /></button>
                                </div>
                                <Button onClick={loadEntries} variant="outline" className="h-10 border-neutral-800 bg-neutral-900 rounded-xl px-4 text-[10px] font-bold uppercase tracking-widest gap-2 hover:bg-neutral-800 text-neutral-400 hover:text-white">
                                    <RefreshCcw size={14} /> {loadingEntries ? "..." : "Refrescar"}
                                </Button>
                                <Button onClick={() => setIsExportDialogOpen(true)} className="h-10 bg-red-600 hover:bg-red-500 text-white rounded-xl px-4 text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-red-900/20">
                                    <FileSpreadsheet size={14} /> Exportar
                                </Button>
                            </div>
                        </div>
                        {loadingEntries ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {[1,2,3,4,5,6,7,8].map((i) => (<div key={i} className="h-64 bg-neutral-900/50 rounded-3xl animate-pulse" />))}
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                                {viewMode === "grid" ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {entries.map((entry) => (<BitacoraCard key={entry.id} entry={entry} />))}
                                    </div>
                                ) : (
                                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
                                        <BitacoraTable entries={entries} />
                                    </div>
                                )}
                                {entries.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-4">
                                        <History size={48} className="opacity-30" />
                                        <p className="text-xs font-bold uppercase tracking-wider">Sin registros en la bitácora</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="manual" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        <ManualRegisterForm />
                    </TabsContent>

                    <TabsContent value="guards" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        <GuardManagement />
                    </TabsContent>

                    <TabsContent value="panic" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        <PanicButtonTab />
                    </TabsContent>

                    <TabsContent value="map" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        <GuardMapTab />
                    </TabsContent>
                </div>
            </Tabs>

            {/* FULL SCREEN MAP MODAL */}
            <AnimatePresence>
                {showFullMap && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[100] bg-black flex flex-col">
                        <div className="flex-1 w-full h-full relative">
                            <div className="absolute top-6 right-6 z-[200]">
                                <button onClick={() => setShowFullMap(false)} className="bg-white text-black p-4 rounded-full hover:bg-gray-200 transition-colors shadow-xl"><X size={32} /></button>
                            </div>
                            <LiveGuardMap myLocation={null} guards={guardLocations} socketId={socketId}
                                onLongPress={(latlng: any) => { setBackupLocation(latlng); setShowBackupModal(true); }}
                                backupMissions={activeMissions} />
                            <div className="absolute top-6 left-6 z-[100] bg-white/30 backdrop-blur-xl px-8 py-6 rounded-3xl shadow-2xl border border-white/20 border-l-8 border-l-[#B20D30]">
                                <h2 className="text-4xl font-black uppercase text-black tracking-tighter">Mapa Táctico</h2>
                                <p className="text-sm font-bold text-gray-800 uppercase tracking-widest mt-1">Monitoreo en Tiempo Real</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* BACKUP REQUEST MODAL */}
            <AnimatePresence>
                {showBackupModal && (
                    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
                            <div className="text-center mb-6 relative z-10">
                                <h2 className="text-3xl font-black uppercase text-[#B20D30] tracking-tighter">Reportar Incidente</h2>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Consola de Administración</p>
                            </div>
                            <div className="mb-6 relative z-10">
                                <label className="text-[10px] uppercase font-black text-gray-400 mb-2 block tracking-widest">Detalles Adicionales</label>
                                <input type="text" placeholder="Descripción del sospechoso..." value={backupDetail} onChange={(e) => setBackupDetail(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-black focus:outline-none focus:border-[#B20D30] transition-colors uppercase text-sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                <button onClick={() => {
                                    if (socketRef.current && backupLocation) {
                                        const mission = { id: "req-admin-" + Date.now(), type: "INDIVIDUO SOSPECHOSO", lat: backupLocation.lat, lng: backupLocation.lng, requesterName: "Administrador", requesterId: socketRef.current.id, status: "PENDING", details: backupDetail };
                                        socketRef.current.emit("request_backup", mission);
                                        setActiveMissions(prev => { if (prev.some(m => m.id === mission.id)) return prev; return [...prev, mission]; });
                                        setShowBackupModal(false); setBackupDetail("");
                                        showNotification("ENVIADO", "Alerta administrativa generada.", "info");
                                    }
                                }} className="bg-red-50 hover:bg-red-100 border-2 border-transparent hover:border-[#B20D30]/20 py-6 rounded-2xl flex flex-col items-center gap-3 transition-all group active:scale-95">
                                    <div className="w-16 h-16 bg-white shadow-lg rounded-full flex items-center justify-center text-[#B20D30] group-hover:scale-110 transition-transform"><UserX size={32} /></div>
                                    <span className="text-sm font-black uppercase text-[#B20D30] leading-tight text-center">Individuo Sospechoso</span>
                                </button>
                                <button onClick={() => {
                                    if (socketRef.current && backupLocation) {
                                        const mission = { id: "req-admin-" + Date.now(), type: "VEHICULO SOSPECHOSO", lat: backupLocation.lat, lng: backupLocation.lng, requesterName: "Administrador", requesterId: socketRef.current.id, status: "PENDING", details: backupDetail };
                                        socketRef.current.emit("request_backup", mission);
                                        setActiveMissions(prev => { if (prev.some(m => m.id === mission.id)) return prev; return [...prev, mission]; });
                                        setShowBackupModal(false); setBackupDetail("");
                                        showNotification("ENVIADO", "Alerta administrativa generada.", "info");
                                    }
                                }} className="bg-slate-50 hover:bg-slate-100 border-2 border-transparent hover:border-slate-300 py-6 rounded-2xl flex flex-col items-center gap-3 transition-all group active:scale-95">
                                    <div className="w-16 h-16 bg-white shadow-lg rounded-full flex items-center justify-center text-slate-700 group-hover:scale-110 transition-transform"><CarFront size={32} /></div>
                                    <span className="text-sm font-black uppercase text-slate-700 leading-tight text-center">Vehículo Sospechoso</span>
                                </button>
                            </div>
                            <button onClick={() => setShowBackupModal(false)} className="mt-6 w-full py-3 text-xs font-bold uppercase text-gray-400 hover:text-black transition-colors">Cancelar</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* NOTIFICATION OVERLAY */}
            <AnimatePresence>
                {notification && (<NotificationOverlay {...notification} onClose={() => setNotification(null)} />)}
            </AnimatePresence>

            <ExportBitacoraDialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen} searchQuery={searchQuery} />
        </div>
    );
}

function NotificationOverlay({ type, title, message, onClose }: { type: string, title: string, message: string, onClose: () => void }) {
    const isAlert = type === "alert" || type === "error";
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            className={cn("fixed inset-0 z-[1000] flex flex-col items-center justify-center p-8 backdrop-blur-3xl",
                isAlert ? "bg-red-600/95" : (type === "success" ? "bg-emerald-600/95" : "bg-black/90"))}>
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }} className="flex flex-col items-center text-center max-w-2xl">
                <div className={cn("w-32 h-32 rounded-[3rem] flex items-center justify-center mb-10 shadow-2xl relative",
                    isAlert ? "bg-white text-red-600" : (type === "success" ? "bg-white text-emerald-600" : "bg-white text-black"))}>
                    {type === "success" && <CheckCircle2 size={64} strokeWidth={2.5} />}
                    {type === "error" && <X size={64} strokeWidth={2.5} />}
                    {type === "info" && <UserCheck size={64} strokeWidth={2.5} />}
                    {type === "alert" && <Siren size={64} strokeWidth={2.5} className="animate-bounce" />}
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 rounded-[3rem] border-4 border-white" />
                </div>
                <h2 className="text-6xl font-black text-white uppercase tracking-tighter mb-4">{title}</h2>
                <p className="text-xl font-black text-white/60 uppercase tracking-widest leading-relaxed">{message}</p>
                <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 3, ease: "linear" }} className="h-2 bg-white/20 w-80 mt-12 rounded-full origin-left" />
            </motion.div>
        </motion.div>
    );
}
