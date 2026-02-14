"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, Shield, User, MapPin, Clock, Fingerprint,
    CheckCircle2, AlertTriangle, Activity, Zap,
    ShieldCheck, Building2, Phone, Mail, IdCard,
    History, MessageSquare, MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { getImagePath } from "@/lib/image-path";
import { getAccessEvents } from "@/app/actions/history";
import { resolveFaceEventAction } from "@/app/actions/face-resolve";
import { verifyFaceAction } from "@/app/actions/face-verify";
import { toast } from "sonner";
import { RefreshCcw, Scan, Loader2 } from "lucide-react";

interface FaceMatchModalProps {
    event: any;
    verification: any;
    isOpen: boolean;
    onClose: () => void;
}

export function FaceMatchModal({ event, verification, isOpen, onClose }: FaceMatchModalProps) {
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [comment, setComment] = useState("");
    const [isResolving, setIsResolving] = useState(false);
    const [verifState, setVerifState] = useState(verification);
    const [showFullScene, setShowFullScene] = useState(false);

    useEffect(() => {
        setVerifState(verification);
    }, [verification]);

    const handleReverify = async () => {
        setVerifState((prev: any) => ({ ...prev, loading: true }));
        try {
            const result = await verifyFaceAction(event.snapshotPath, event.userId || "", event.user?.name);
            setVerifState({ ...result, loading: false });
            if (result.success) {
                toast.success(`STATUS: ANALISIS NEURAL REFRESCADO`, {
                    description: `Nueva Coincidencia: ${(result.similarity * 100).toFixed(1)}%`,
                    className: "bg-emerald-950 border-emerald-500 text-white font-black uppercase tracking-widest"
                });
            }
        } catch (err) {
            setVerifState((prev: any) => ({ ...prev, loading: false, error: true }));
            toast.error("Error en el motor de búsqueda neural");
        }
    };

    useEffect(() => {
        if (isOpen) {
            const searchId = event?.userId;
            const searchName = event?.user?.name || verifState?.recognizedAs;

            if (searchId || searchName) {
                setLoadingHistory(true);
                // We pass name as search query which should ideally be the Face ID if we update getAccessEvents
                getAccessEvents({ userId: searchId, search: searchName, take: 5 })
                    .then(res => setHistory(res.events))
                    .catch(err => console.error("Error loading face history:", err))
                    .finally(() => setLoadingHistory(false));
            }
        }
    }, [isOpen, event?.userId, event?.user?.name, verifState?.recognizedAs]);

    if (!event) return null;

    const similarity = verifState?.similarity ? (verifState.similarity * 100).toFixed(1) : "0.0";
    const isVerified = verifState?.verified;
    const isBlacklisted = (event.user?.role === 'BLACKLISTED') || (verifState?.user?.role === 'BLACKLISTED');
    const isWhiteList = (event.user?.role === 'WHITELISTED') || (verifState?.user?.role === 'WHITELISTED');
    const isLoading = verifState?.loading;
    // Alarm strictly for blacklisted users as per user request
    const isAlert = isBlacklisted;
    const isSuccess = !isBlacklisted && !isWhiteList;
    const isSpecial = isWhiteList;

    // Camera reported similarity
    const camMatchMatch = event.details?.match(/CamMatch: ([\d.]+)%/);
    const cameraMatch = camMatchMatch ? camMatchMatch[1] : null;
    const cameraParsedName = event.details?.match(/Persona: ([^,]+)/)?.[1];
    const cameraName = event.user?.name || (cameraParsedName !== 'N/A' ? cameraParsedName : null);

    const neuralName = verifState?.recognizedAs;
    const displayUser = verifState?.user || event.user;
    const displayName = neuralName || cameraName || "Sujeto Desconocido";

    const handleResolve = async () => {
        if (isAlert && !comment) {
            toast.error("Por favor, ingrese un comentario para resolver la alerta");
            return;
        }

        setIsResolving(true);
        try {
            const res = await resolveFaceEventAction(event.id, comment);
            if (res.success) {
                toast.success("Evento resuelto correctamente");
                onClose();
            } else {
                toast.error(res.error || "Error al resolver el evento");
            }
        } catch (err) {
            toast.error("Error de conexión");
        } finally {
            setIsResolving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md"
                    />

                    {/* Modal Container - Less Rounded, More Tactical */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            boxShadow: isAlert ? [
                                "0 0 40px rgba(0,0,0,1)",
                                "0 0 60px rgba(178,13,48,0.4)",
                                "0 0 40px rgba(0,0,0,1)"
                            ] : "0 0 100px rgba(0,0,0,1)"
                        }}
                        transition={isAlert ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                            "relative w-full max-w-5xl bg-[#080808] border rounded-lg overflow-hidden flex h-[60vh] max-h-[60vh] transition-colors duration-500",
                            isAlert ? "border-red-600/50" : "border-white/10"
                        )}
                    >
                        {isAlert && (
                            <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                                <motion.div
                                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="absolute inset-0 border-[4px] border-red-600/20"
                                />
                            </div>
                        )}
                        {/* Integrated Tactical View */}
                        <div className="flex-1 relative bg-neutral-900 overflow-hidden h-full">
                            {/* Tactical Close Button */}
                            <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
                                <button
                                    onClick={() => setShowFullScene(!showFullScene)}
                                    className={cn(
                                        "px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md border",
                                        showFullScene ? "bg-white text-black border-white" : "bg-black/40 text-white/60 border-white/10 hover:text-white"
                                    )}
                                >
                                    <Scan size={14} />
                                    {showFullScene ? "Ver Detalle" : "Ver Escena Completa"}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full bg-black/40 hover:bg-white/10 text-neutral-500 hover:text-white transition-all backdrop-blur-md border border-white/10"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            {/* Full Scene Background */}
                            <Image
                                src={getImagePath(event.imagePath || event.snapshotPath) || "/placeholder.png"}
                                alt="Context"
                                fill
                                className={cn(
                                    "object-cover transition-all duration-700",
                                    showFullScene ? "opacity-100 grayscale-0" : "opacity-20 grayscale"
                                )}
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black/20" />

                            {/* Comparison HUD: Superimposed Vertically */}
                            <AnimatePresence>
                                {!showFullScene && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="absolute inset-y-0 left-10 flex flex-col justify-center gap-4 z-20"
                                    >
                                        {/* Captured Face Box */}
                                        <div className="group/cap relative">
                                            <div className={cn(
                                                "w-44 h-44 bg-black border-2 overflow-hidden relative",
                                                isAlert ? "border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]" :
                                                    isSpecial ? "border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]" :
                                                        "border-emerald-500"
                                            )}>
                                                <div className="absolute inset-0 bg-neutral-950 animate-pulse" />
                                                <Image
                                                    src={getImagePath(event.snapshotPath) || "/placeholder.png"}
                                                    alt="Captured"
                                                    fill
                                                    className="object-cover"
                                                />
                                                {/* HUD Label */}
                                                <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 z-20">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/80">LIVE CAPTURE</span>
                                                </div>
                                                {/* Similarity Overlay */}
                                                <div className="absolute bottom-2 right-2 bg-black/80 border border-white/10 px-2 py-1 z-20">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[7px] font-black text-white/40 uppercase leading-none mb-0.5">
                                                            {isAlert ? "ALERTA" : "Cámara"}
                                                        </span>
                                                        <span className={cn("text-xs font-black", isAlert ? "text-red-500" : "text-white")}>
                                                            {cameraMatch || similarity}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Link / Indicator Gap */}
                                        <div className="h-4 flex items-center justify-center relative">
                                            <div className="w-[1px] h-full bg-white/10" />
                                        </div>

                                        {/* Database Face Box */}
                                        <div className="group/db relative">
                                            <div className="w-44 h-44 bg-black border-2 border-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.3)] overflow-hidden relative">
                                                {displayUser?.cara ? (
                                                    <Image
                                                        src={getImagePath(displayUser.cara) || "/placeholder.png"}
                                                        alt="Database"
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-950 gap-2 border border-dashed border-white/5">
                                                        <User size={24} className="text-neutral-800" />
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest leading-none">Rostro Base</span>
                                                            <span className="text-[10px] font-mono text-blue-400 font-bold uppercase">{verifState?.recognizedAs || "Sin ID"}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* HUD Label */}
                                                <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 z-20">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/80">ROSTRO EN BASE</span>
                                                </div>
                                                <div className="absolute bottom-2 right-2 bg-black/80 border border-white/10 px-2 py-1 z-20">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[7px] font-black text-white/40 uppercase leading-none mb-0.5">Neural</span>
                                                        <span className={cn("text-xs font-black", isAlert ? "text-red-500" : "text-emerald-500")}>{similarity}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Tactical Info Layer: Floating borderless column */}
                            <AnimatePresence>
                                {!showFullScene && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="absolute top-10 left-[480px] right-10 bottom-10 flex flex-col gap-6 z-30"
                                    >
                                        {/* Profile Heading */}
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 opacity-50 mb-2">
                                                <Fingerprint size={14} className="text-[#B20D30]" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Módulo de Identidad</span>
                                            </div>
                                            <h1 className={cn(
                                                "text-4xl font-black uppercase tracking-tighter leading-none break-words max-w-sm",
                                                isSpecial ? "text-blue-500" : isSuccess ? "text-white" : "text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                                            )}>
                                                {displayName}
                                            </h1>
                                            <div className="flex items-center gap-4 pt-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("w-3 h-3 rounded-full", isSpecial ? "bg-blue-500" : isSuccess ? "bg-emerald-500" : "bg-red-600 animate-pulse")} />
                                                    <p className={cn(
                                                        "text-xs font-black uppercase tracking-[0.2em]",
                                                        isAlert ? "text-red-500 animate-pulse" : "text-neutral-400"
                                                    )}>
                                                        {isAlert ? "SOSPECHOSO REGISTRADO" : isSpecial ? "Lista Blanca" : "Match Confirmado"}
                                                    </p>
                                                </div>
                                                <div className="h-4 w-px bg-white/10" />
                                                <p className="text-xs font-mono font-bold text-blue-400/60 uppercase tracking-widest">ID: {verifState?.recognizedAs || "Pending"}</p>
                                            </div>
                                        </div>

                                        {/* Recognition Analysis */}
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-2">
                                                <Activity size={18} className="text-neutral-500" />
                                                <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">Estado de Comparación</span>
                                            </div>
                                            <div className="flex items-center gap-16">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Neural AI</span>
                                                    <span className={cn("text-3xl font-black uppercase tracking-tighter", isSpecial ? "text-blue-500" : isSuccess ? "text-emerald-500" : "text-red-500")}>
                                                        {similarity}%
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Cámara</span>
                                                    <span className="text-3xl font-black text-white uppercase tracking-tighter">
                                                        {cameraMatch || "---"}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Field Grid */}
                                        <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                                            <IdentityField icon={<IdCard size={16} />} label="Identificación" value={displayUser?.dni || "---"} />
                                            <IdentityField icon={<Building2 size={16} />} label="Unidad / Lote" value={displayUser?.unit?.name || "Visitante"} />
                                            <IdentityField icon={<MapPin size={16} />} label="Terminal" value={event.device?.name || "Access Point"} />
                                            <IdentityField icon={<MessageSquare size={16} />} label="Observaciones" value={displayUser?.observations || "Sin novedades."} />
                                        </div>

                                        {/* Integrated Case Resolution / Close Button requested by USER */}
                                        <div className="mt-auto flex flex-col gap-3">
                                            <div className="relative">
                                                <textarea
                                                    value={comment}
                                                    onChange={(e) => setComment(e.target.value)}
                                                    placeholder="Añadir observaciones sobre el sujeto..."
                                                    className={cn(
                                                        "w-full bg-black/40 border p-4 text-[11px] text-white outline-none transition-all rounded-lg placeholder:text-neutral-700 font-bold resize-none h-24",
                                                        isAlert ? "border-red-600/30 focus:border-red-600" : "border-white/5 focus:border-white/20"
                                                    )}
                                                />
                                                <div className="absolute top-2 right-2 opacity-20">
                                                    <MessageSquare size={12} />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleResolve}
                                                    disabled={isResolving}
                                                    className={cn(
                                                        "flex-1 h-11 font-black text-[9px] uppercase tracking-[0.2em] transition-all rounded-lg shadow-xl flex items-center justify-center gap-2",
                                                        isAlert ? "bg-red-600 text-white hover:bg-red-700" :
                                                            (isSpecial ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white text-black hover:bg-neutral-200")
                                                    )}
                                                >
                                                    {isResolving ? <Loader2 className="animate-spin" size={12} /> : (
                                                        <>
                                                            <CheckCircle2 size={14} />
                                                            {isAlert ? "Resolver Incidente" : "Finalizar y Guardar"}
                                                        </>
                                                    )}
                                                </button>
                                                {!isAlert && (
                                                    <button
                                                        onClick={onClose}
                                                        className="h-11 px-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white transition-all"
                                                    >
                                                        Solo Cerrar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Recientes History */}
                            <AnimatePresence>
                                {!showFullScene && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 20 }}
                                        className="absolute top-20 left-[260px] right-[400px] bottom-10 flex flex-col gap-4 z-20"
                                    >
                                        <div className="space-y-4 flex-1 overflow-hidden">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-neutral-500">
                                                    <History size={16} />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Historial</span>
                                                </div>
                                                <div className="h-[1px] flex-1 mx-4 bg-white/5" />
                                            </div>
                                            <div className="space-y-3 overflow-y-auto max-h-[140px] custom-scrollbar pr-4 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[px] before:bg-white/5">
                                                {loadingHistory ? (
                                                    <div className="text-[10px] text-neutral-700 uppercase font-black pl-8 italic animate-pulse">Analizando...</div>
                                                ) : history.length > 0 ? history.map((h, i) => (
                                                    <div key={h.id} className="flex gap-4 items-start relative pl-0 opacity-60 hover:opacity-100 transition-opacity">
                                                        <div className={cn(
                                                            "w-3 h-3 rounded-full z-10 shrink-0 border-2 border-black",
                                                            h.decision === 'GRANT' ? "bg-emerald-500" : "bg-red-600"
                                                        )} />
                                                        <div className="min-w-0">
                                                            <p className="text-[9px] font-black text-white/50 uppercase leading-none truncate">
                                                                {h.device?.name || "Terminal"}
                                                            </p>
                                                            <p className="text-[7px] font-bold text-neutral-600 mt-1 uppercase tracking-tighter">
                                                                {new Date(h.timestamp).toLocaleTimeString()} • {h.decision === 'GRANT' ? 'PASO' : 'DENEGADO'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="text-[10px] text-neutral-600 uppercase font-black pl-8">Sin registros.</div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Stats Info Bottom Right */}
                            <AnimatePresence>
                                {!showFullScene && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute bottom-8 right-8 text-right space-y-1"
                                    >
                                        <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest leading-none">Terminal de Acceso</p>
                                        <h4 className="text-xl font-black text-white uppercase tracking-tighter truncate max-w-[300px]">{event.device?.name || "Camara s/n"}</h4>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div >
            )
            }
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; }
            `}</style>
        </AnimatePresence >
    );
}

function IdentityField({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="flex items-start gap-4 group">
            <div className="w-6 h-6 text-neutral-600 group-hover:text-[#B20D30] transition-colors mt-0.5 shrink-0">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1.5 leading-none">{label}</p>
                <p className="text-sm font-black text-white uppercase leading-tight truncate">{value}</p>
            </div>
        </div>
    );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <span className={cn("px-2 py-0.5 rounded-none text-[8px] font-black uppercase tracking-widest border", className)}>
            {children}
        </span>
    );
}
