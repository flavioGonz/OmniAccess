"use client";

import React, { useState, useEffect } from "react";
import {
    Monitor,
    Activity,
    Shield,
    Plus,
    User,
    Building2,
    Search,
    RefreshCcw,
    Smartphone,
    History,
    Clock,
    Camera,
    ChevronRight,
    MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SystemFlow from "@/components/dashboard/SystemFlow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getBitacoraEntries } from "@/app/actions/bitacora";
import { io } from "socket.io-client";

export default function ConsolasAdminPage() {
    const [activeConsoles, setActiveConsoles] = useState<any[]>([]);
    const [bitacoraHistory, setBitacoraHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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

    const formatTime = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    const [showQuickRegister, setShowQuickRegister] = useState(false);
    const [quickPlate, setQuickPlate] = useState("");
    const [quickName, setQuickName] = useState("");
    const [quickUnit, setQuickUnit] = useState("");

    return (
        <div className="flex h-screen overflow-hidden bg-[#0a0a0c]">
            {/* Main Layout: Flow on left, Quick Action on right */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Network Topology */}
                <div className="flex-1 relative border-r border-neutral-800 overflow-hidden">
                    <SystemFlow mode="consoles" />

                    {/* Floating Info Overlay */}
                    <div className="absolute top-6 left-6 z-10 bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl max-w-xs transition-all hover:bg-black/80">
                        <div className="flex items-center gap-2 mb-3">
                            <Activity className="text-blue-400 animate-pulse" size={14} />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Estado del Sistema</span>
                        </div>
                        <p className="text-[10px] text-neutral-400 font-medium leading-relaxed">
                            Visualización en tiempo real de la infraestructura LPR y consolas guardiapad conectadas a la red local.
                        </p>
                    </div>
                </div>

                {/* Right: Quick Operational Panel */}
                <aside className="w-[450px] bg-neutral-900 overflow-y-auto custom-scrollbar p-8 flex flex-col gap-8">

                    {/* Consolas Conectadas (Repaired) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                                <Smartphone size={14} className="text-blue-500" /> Dispositivos Conectados
                            </h3>
                            {activeConsoles.length > 0 && (
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                        </div>

                        <div className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {activeConsoles.length > 0 ? (
                                    activeConsoles.map((tablet, i) => (
                                        <motion.div
                                            key={tablet.guardName}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-neutral-800/40 border border-neutral-700/50 p-4 rounded-2xl flex items-center gap-4 hover:bg-neutral-800/60 transition-all group cursor-pointer border-l-4 border-l-emerald-500"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center font-black text-xs text-emerald-400 shadow-inner">
                                                {tablet.guardName.substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[11px] font-black text-white uppercase tracking-tight">{tablet.guardName}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <MapPin size={10} className="text-neutral-600" />
                                                    <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-tighter">Guardiapad Activo</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-mono text-neutral-500">{tablet.ip}</p>
                                                <span className="text-[8px] font-black uppercase mt-1 inline-block text-emerald-500">
                                                    online
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className="py-8 text-center bg-neutral-800/10 rounded-2xl border border-dashed border-neutral-800">
                                        <Smartphone size={24} className="mx-auto text-neutral-700 mb-2 opacity-20" />
                                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">No hay consolas activas</p>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Historial de Bitácora (New) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                                <History size={14} className="text-amber-500" /> Historial de Bitácora
                            </h3>
                            <button className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-tighter transition-colors">
                                Ver Todo
                            </button>
                        </div>

                        <div className="space-y-3">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="bg-neutral-800/20 h-20 rounded-2xl animate-pulse" />
                                ))
                            ) : bitacoraHistory.length > 0 ? (
                                bitacoraHistory.slice(0, 10).map((entry) => (
                                    <div key={entry.id} className="bg-neutral-800/20 border border-neutral-700/30 p-4 rounded-2xl hover:bg-neutral-800/40 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                                                    entry.type === 'ENTRY' ? "bg-blue-500/20 text-blue-400" : "bg-amber-500/20 text-amber-500"
                                                )}>
                                                    {entry.type === 'ENTRY' ? 'ENTRADA' : 'SALIDA'}
                                                </div>
                                                <span className="text-[10px] font-black text-white tracking-widest uppercase">{entry.plate || '--- ---'}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-neutral-600">
                                                <Clock size={10} />
                                                <span className="text-[9px] font-bold">{formatTime(entry.timestamp)}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <User size={10} className="text-neutral-500" />
                                                <p className="text-[10px] font-bold text-neutral-400 truncate max-w-[200px]">{entry.name || 'Invitado'}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Building2 size={10} className="text-neutral-500" />
                                                <p className="text-[9px] font-medium text-neutral-500 truncate">{entry.destination || '---'}</p>
                                            </div>
                                        </div>

                                        {entry.photoPath && (
                                            <div className="mt-3 relative h-20 rounded-xl overflow-hidden border border-neutral-700/50 bg-black">
                                                <img
                                                    src={entry.photoPath}
                                                    alt="Capture"
                                                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                                                    <Camera size={10} className="text-white" />
                                                    <span className="text-[8px] font-black text-white uppercase tracking-tighter">Imagen Capturada</span>
                                                </div>
                                            </div>
                                        )}

                                        {entry.notes && (
                                            <div className="mt-2 p-2 bg-black/20 rounded-lg border border-white/5">
                                                <p className="text-[9px] text-neutral-500 italic leading-snug line-clamp-2">"{entry.notes}"</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center bg-neutral-800/10 rounded-2xl border border-dashed border-neutral-800">
                                    <History size={24} className="mx-auto text-neutral-700 mb-2 opacity-20" />
                                    <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">No hay registros</p>
                                </div>
                            )}
                        </div>
                    </div>


                </aside>
            </div>

            {/* Floating Quick Register Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowQuickRegister(true)}
                className="fixed bottom-8 right-8 z-50 bg-blue-600 hover:bg-blue-500 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-2xl shadow-blue-500/30 border-2 border-blue-400/20"
            >
                <Plus size={28} className="font-black" />
            </motion.button>

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
        </div>
    );
}
