"use client";

import React, { useState, useEffect } from "react";
import {
    History,
    Search,
    Calendar as CalendarIcon,
    X,
    ChevronRight,
    Clock,
    User,
    Building2,
    Camera,
    Play,
    Eye,
    Shield,
    Smartphone,
    LayoutGrid,
    List as ListIcon,
    ArrowUpRight,
    ArrowLeft
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { getBitacoraEntries } from "@/app/actions/bitacora";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function BitacoraPage() {
    const [entries, setEntries] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const router = useRouter();

    useEffect(() => {
        async function loadEntries() {
            try {
                const data = await getBitacoraEntries();
                setEntries(data);
            } catch (error) {
                console.error("Error loading bitacora:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadEntries();
    }, []);

    const filteredEntries = entries.filter(entry => {
        const matchesSearch =
            (entry.plate?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (entry.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (entry.destination?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (entry.guardName?.toLowerCase() || "").includes(searchTerm.toLowerCase());

        const matchesDate = !filterDate || new Date(entry.timestamp).toISOString().split('T')[0] === filterDate;

        return matchesSearch && matchesDate;
    });

    const formatTime = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => router.back()}
                        className="group flex items-center justify-center w-14 h-14 bg-card border border-border rounded-2xl hover:bg-muted hover:border-blue-500/50 transition-all shadow-xl"
                    >
                        <ArrowLeft className="text-muted-foreground group-hover:text-blue-400 transition-colors" size={24} />
                    </button>
                    <div>
                        <h1 className="text-4xl font-black text-foreground uppercase tracking-tight flex items-center gap-4">
                            <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 shadow-xl shadow-amber-500/5">
                                <History className="text-amber-500" size={32} />
                            </div>
                            Registros de Bitácora
                        </h1>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs mt-2 ml-1">
                            Historial completo de registros manuales y rondines de guardias
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Switcher */}
                    <div className="flex bg-card border border-border p-1 rounded-2xl mr-4">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-2 rounded-xl transition-all",
                                viewMode === 'grid' ? "bg-blue-600 text-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "p-2 rounded-xl transition-all",
                                viewMode === 'table' ? "bg-blue-600 text-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <ListIcon size={20} />
                        </button>
                    </div>

                    <div className="px-4 py-2 bg-card border border-border rounded-2xl flex flex-col items-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Registros</span>
                        <span className="text-xl font-black text-foreground">{entries.length}</span>
                    </div>
                </div>
            </header>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card/50 p-6 rounded-[2.5rem] border border-border backdrop-blur-sm">
                <div className="relative group md:col-span-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-blue-500 transition-colors" size={18} />
                    <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por matrícula, nombre, destino o guardia..."
                        className="pl-12 bg-background border-border h-14 text-sm font-bold text-foreground placeholder:text-muted-foreground rounded-[1.25rem] focus:border-blue-500/50 transition-all shadow-inner"
                    />
                </div>

                <div className="flex gap-3">
                    <div className="relative flex-1 group">
                        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-blue-500" size={18} />
                        <Input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="pl-12 bg-background border-border h-14 text-sm font-black text-muted-foreground focus:border-blue-500/50 rounded-[1.25rem] appearance-none uppercase"
                        />
                    </div>
                    {(searchTerm || filterDate) && (
                        <button
                            onClick={() => { setSearchTerm(""); setFilterDate(""); }}
                            className="w-14 h-14 bg-muted hover:bg-muted text-muted-foreground rounded-[1.25rem] transition-colors flex items-center justify-center shrink-0 shadow-lg"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <AnimatePresence mode="wait">
                {viewMode === 'grid' ? (
                    <motion.div
                        key="grid"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {isLoading ? (
                            Array(6).fill(0).map((_, i) => (
                                <div key={i} className="h-64 bg-card rounded-[2rem] animate-pulse border border-border" />
                            ))
                        ) : filteredEntries.length > 0 ? (
                            filteredEntries.map((entry) => (
                                <motion.div
                                    key={entry.id}
                                    layout
                                    className="group bg-card border border-border rounded-[2rem] overflow-hidden hover:border-blue-500/40 transition-all shadow-xl hover:shadow-blue-500/5"
                                >
                                    <div className="relative h-48 bg-black overflow-hidden">
                                        {entry.photoPath ? (
                                            <img
                                                src={entry.photoPath}
                                                alt="Capture"
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-100"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <Camera size={48} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-60" />

                                        {/* Action Buttons */}
                                        <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                                            {entry.photoPath && (
                                                <button
                                                    onClick={() => setSelectedPhoto(entry.photoPath)}
                                                    className="p-4 bg-white text-muted-foreground rounded-2xl hover:scale-110 transition-transform shadow-2xl"
                                                >
                                                    <Eye size={20} />
                                                </button>
                                            )}
                                            {entry.audioPath && (
                                                <button
                                                    onClick={() => setSelectedAudio(entry.audioPath)}
                                                    className="p-4 bg-emerald-500 text-foreground rounded-2xl hover:scale-110 transition-transform shadow-2xl shadow-emerald-500/20"
                                                >
                                                    <Play size={20} className="fill-current" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Type Badge */}
                                        <div className={cn(
                                            "absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md",
                                            entry.type === 'ENTRY'
                                                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                                : "bg-amber-500/20 text-amber-500 border-amber-500/30"
                                        )}>
                                            {entry.type === 'ENTRY' ? 'ENTRADA' : 'SALIDA'}
                                        </div>

                                        {/* Time Badge */}
                                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                                            <Clock size={12} className="text-muted-foreground" />
                                            <span className="text-[10px] font-bold text-foreground uppercase">{formatTime(entry.timestamp)}</span>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-black text-foreground tracking-widest uppercase">{entry.plate || 'S/M'}</h3>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <CalendarIcon size={12} />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">{formatDate(entry.timestamp)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-2 border-t border-border/50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                                                    <User size={14} />
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Visitante</p>
                                                    <p className="text-xs font-bold text-foreground truncate">{entry.name || 'Invitado Desconocido'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                                                    <Building2 size={14} />
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Destino</p>
                                                    <p className="text-xs font-bold text-foreground truncate">{entry.destination || '---'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                                                    <Shield size={14} />
                                                </div>
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Registrado por</p>
                                                    <p className="text-xs font-bold text-foreground truncate">{entry.guardName || 'Sistema'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {entry.notes && (
                                            <div className="mt-4 p-4 bg-background/50 rounded-2xl border border-border/50">
                                                <p className="text-[10px] text-muted-foreground italic leading-relaxed line-clamp-2">
                                                    &quot;{entry.notes}&quot;
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="col-span-full py-24 flex flex-col items-center justify-center bg-card/40 border border-dashed border-border rounded-[3rem]">
                                <History size={64} className="text-muted-foreground mb-6" />
                                <h3 className="text-xl font-black text-muted-foreground uppercase tracking-[0.2em] text-center px-4">No se encontraron registros</h3>
                                <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest mt-2">Intenta ajustar los criterios de búsqueda</p>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="table"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-card/50 border border-border rounded-[2rem] overflow-hidden overflow-x-auto"
                    >
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-black/40 border-b border-neutral-800">
                                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Multimedia</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Matrícula</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tipo</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Visitante</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Destino</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fecha/Hora</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Registrado por</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800/50">
                                {isLoading ? (
                                    Array(10).fill(0).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={8} className="px-6 py-10 bg-card/20" />
                                        </tr>
                                    ))
                                ) : filteredEntries.length > 0 ? (
                                    filteredEntries.map((entry) => (
                                        <tr key={entry.id} className="group hover:bg-accent transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    {entry.photoPath ? (
                                                        <button
                                                            onClick={() => setSelectedPhoto(entry.photoPath)}
                                                            className="w-10 h-10 rounded-xl bg-muted border border-border overflow-hidden flex items-center justify-center hover:shadow-lg transition-all"
                                                        >
                                                            <img src={entry.photoPath} className="w-full h-full object-cover" alt="Capture" />
                                                        </button>
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground">
                                                            <Camera size={16} />
                                                        </div>
                                                    )}
                                                    {entry.audioPath && (
                                                        <button
                                                            onClick={() => setSelectedAudio(entry.audioPath)}
                                                            className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-foreground transition-all"
                                                        >
                                                            <Play size={16} className="fill-current" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-black text-foreground tracking-widest uppercase text-sm">
                                                {entry.plate || '--- ---'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-lg text-[9px] font-black border tracking-wider",
                                                    entry.type === 'ENTRY'
                                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                )}>
                                                    {entry.type === 'ENTRY' ? 'ENTRADA' : 'SALIDA'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs font-bold text-foreground">{entry.name || 'Invitado'}</p>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-muted-foreground">
                                                {entry.destination || '---'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-0.5">
                                                    <p className="text-[10px] font-black text-foreground">{formatTime(entry.timestamp)}</p>
                                                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{formatDate(entry.timestamp)}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Shield size={10} className="text-muted-foreground" />
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{entry.guardName || 'Sistema'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => {
                                                        if (entry.photoPath) setSelectedPhoto(entry.photoPath);
                                                        else if (entry.audioPath) setSelectedAudio(entry.audioPath);
                                                    }}
                                                    className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center hover:bg-blue-600 hover:text-foreground transition-all ml-auto"
                                                >
                                                    <ArrowUpRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="py-24 text-center">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sin registros encontrados</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Lightbox Photo */}
            <AnimatePresence>
                {selectedPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 md:p-12"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <motion.button
                            className="absolute top-8 right-8 p-4 bg-foreground/10 hover:bg-foreground/10 backdrop-blur-2xl rounded-full text-foreground transition-all shadow-2xl"
                            onClick={() => setSelectedPhoto(null)}
                        >
                            <X size={24} />
                        </motion.button>
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            src={selectedPhoto}
                            alt="Full Size Capture"
                            className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl border border-border"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Audio Modal */}
            <AnimatePresence>
                {selectedAudio && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[200] w-full max-w-lg px-4"
                    >
                        <div className="bg-card/90 backdrop-blur-2xl border border-border p-8 rounded-[3rem] shadow-2xl shadow-emerald-500/10 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 mb-4">
                                <Play size={32} className="fill-current" />
                            </div>
                            <h4 className="text-lg font-black text-foreground uppercase tracking-widest mb-2">Nota de Audio del Guardia</h4>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-6">Reproduciendo evidencia operativa</p>

                            <audio
                                autoPlay
                                controls
                                src={selectedAudio}
                                className="w-full h-12 brightness-90 saturate-150 contrast-125 rounded-full"
                            />

                            <button
                                onClick={() => setSelectedAudio(null)}
                                className="mt-8 px-8 py-3 bg-muted hover:bg-muted text-foreground text-[10px] font-black uppercase tracking-widest rounded-full transition-colors"
                            >
                                Cerrar Reproductor
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
