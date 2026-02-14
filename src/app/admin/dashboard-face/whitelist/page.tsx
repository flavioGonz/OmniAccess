"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Search, Loader2, UserPlus, ChevronLeft, Trash2, Fingerprint } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getImagePath } from "@/lib/image-path";
import Image from "next/image";
import Link from "next/link";

// I'll check user actions.
import { searchUsers, toggleBlacklist } from "@/app/actions/users";

export default function WhitelistPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    const fetchWhitelist = async (q: string = "") => {
        setLoading(true);
        try {
            // I'll search for users. If q is empty, maybe get all?
            // searchUsers usually filters. I'll need a "getWhitelist" action.
            const data = await searchUsers(q);
            // Filter out blacklisted
            setUsers(data.filter((u: any) => u.role !== 'BLACKLISTED'));
        } catch (e) {
            toast.error("Error al cargar lista blanca");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWhitelist();
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight">Lista Blanca</h1>
                    <p className="text-sm text-neutral-400 font-medium mt-1">Sujetos Autorizados y Residentes</p>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                    <Input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            fetchWhitelist(e.target.value);
                        }}
                        placeholder="Buscar..."
                        className="bg-neutral-900 border-white/10 pl-10 h-10 rounded-xl text-white text-xs font-medium uppercase focus:border-emerald-500/50 transition-colors"
                    />
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                    <Loader2 className="animate-spin text-emerald-500" size={32} />
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-500">Cargando...</p>
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">No se encontraron registros</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {users.map((user) => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={user.id}
                            className="bg-neutral-900/50 border border-white/5 rounded-xl p-4 flex flex-col gap-4 hover:border-emerald-500/30 transition-all group"
                        >
                            <div className="flex gap-4 items-center">
                                <div className="w-16 h-16 rounded-lg overflow-hidden relative border border-white/10 group-hover:border-emerald-500/50 transition-all bg-black">
                                    {user.cara ? (
                                        <Image
                                            src={getImagePath(user.cara) || "/placeholder-face.jpg"}
                                            alt={user.name}
                                            fill
                                            className="object-cover grayscale group-hover:grayscale-0"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-neutral-800">
                                            <Fingerprint size={24} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black uppercase truncate text-white">{user.name}</h3>
                                    <p className="text-[10px] text-neutral-500 font-bold uppercase truncate">{user.dni || "S/DNI"}</p>
                                    <div className="flex gap-2 mt-2">
                                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black italic px-1.5 py-0.5 h-auto">AUTH</Badge>
                                        <Badge className="bg-white/5 text-neutral-600 border-white/10 text-[8px] font-black uppercase px-1.5 py-0.5 h-auto">{user.role}</Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase tracking-wide">
                                <div className="bg-black/30 p-2 rounded-lg border border-white/5 flex flex-col">
                                    <span className="text-neutral-600 mb-0.5">Unidad</span>
                                    <span className="text-white truncate">{user.unit?.name || "Global"}</span>
                                </div>
                                <div className="bg-black/30 p-2 rounded-lg border border-white/5 flex flex-col">
                                    <span className="text-neutral-600 mb-0.5">ID</span>
                                    <span className="text-white truncate">#{user.id.substring(0, 4)}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
