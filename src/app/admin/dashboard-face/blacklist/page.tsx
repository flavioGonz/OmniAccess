"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Trash2, Loader2, AlertTriangle, ShieldCheck, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getBlacklist, toggleBlacklist } from "@/app/actions/users";
import { getImagePath } from "@/lib/image-path";
import Image from "next/image";
import Link from "next/link";

export default function BlacklistPage() {
    const [blacklist, setBlacklist] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBlacklist = async () => {
        setLoading(true);
        try {
            const data = await getBlacklist();
            setBlacklist(data);
        } catch (e) {
            toast.error("Error al cargar lista negra");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBlacklist();
    }, []);

    const handleRemove = async (userId: string) => {
        try {
            await toggleBlacklist(userId, false);
            toast.success("Removido de lista negra");
            fetchBlacklist();
        } catch (e) {
            toast.error("Error al remover");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex items-center justify-between pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight">Lista Negra</h1>
                    <p className="text-sm text-neutral-400 font-medium mt-1">Sujetos Restringidos en Perímetro</p>
                </div>
                {/* Optional: Add action buttons here if needed */}
            </header>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-black uppercase text-red-200">Protocolo de Alerta Crítica</h4>
                    <p className="text-xs text-red-200/60 mt-1 leading-relaxed max-w-2xl">
                        Los perfiles en esta lista generarán una alerta de pánico inmediata y persistente en todas las consolas de guardia al ser detectados por cualquier terminal biométrica del sistema.
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                    <Loader2 className="animate-spin text-red-500" size={32} />
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-500">Sincronizando...</p>
                </div>
            ) : blacklist.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/5">
                    <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center text-neutral-600 mb-4">
                        <ShieldCheck size={32} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">No hay sujetos registrados en la lista negra</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {blacklist.map((user) => (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key={user.id}
                            className="bg-neutral-900/50 border border-white/5 rounded-xl p-4 flex flex-col gap-4 hover:border-red-500/30 transition-all group"
                        >
                            <div className="flex gap-4 items-center">
                                <div className="w-16 h-16 rounded-lg overflow-hidden relative border border-white/10 group-hover:border-red-500/50 transition-all">
                                    <Image
                                        src={getImagePath(user.cara) || "/placeholder-face.jpg"}
                                        alt={user.name}
                                        fill
                                        className="object-cover grayscale group-hover:grayscale-0"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black uppercase truncate text-white">{user.name}</h3>
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase truncate">{user.dni || "S/DNI"}</p>
                                    <div className="flex gap-2 mt-2">
                                        <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[8px] font-black italic px-1.5 py-0.5 h-auto">BLACKLISTED</Badge>
                                        <Badge className="bg-white/5 text-neutral-600 border-white/10 text-[8px] font-black uppercase px-1.5 py-0.5 h-auto">{user.unit?.name || "Externo"}</Badge>
                                    </div>
                                </div>
                            </div>

                            {user.observations && (
                                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                                    <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest mb-1">Notas</p>
                                    <p className="text-[10px] text-neutral-300 italic line-clamp-2">"{user.observations}"</p>
                                </div>
                            )}

                            <button
                                onClick={() => handleRemove(user.id)}
                                className="w-full h-9 bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-all flex items-center justify-center gap-2 rounded-lg"
                            >
                                <Trash2 size={12} />
                                Remover
                            </button>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
