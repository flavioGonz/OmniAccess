"use client";

import React from "react";
import {
    Clock,
    CheckCircle2,
    PlusCircle,
    AlertCircle,
    TrendingUp,
    FileText,
    ChevronRight,
    Rocket,
    Zap,
    Bug
} from "lucide-react";
import { cn } from "@/lib/utils";

const changes = [
    {
        version: "v1.1.0",
        date: "2026-01-31",
        title: "Optimización de Rendimiento y Reportes",
        description: "Mejoras críticas en el manejo de grandes volúmenes de datos y exportación de historial.",
        items: [
            { type: "performance", text: "Calendario: Carga optimizada omitiendo cálculos pesados de duración (N+1 queries fixed)." },
            { type: "feature", text: "Calendario: Se aumentó el límite de visualización de 2,000 a 50,000 eventos mensuales." },
            { type: "fix", text: "Exportación: Corregido error que generaba reportes Excel vacíos." },
            { type: "performance", text: "Exportación: Optimización para descarga de hasta 100k registros en segundos." },
            { type: "performance", text: "Frontend: Implementación de useMemo en componentes de alta densidad para evitar lag." },
            { type: "fix", text: "Estabilidad: Corregido error crítico de importación en el proceso de build de producción." }
        ]
    },
    {
        version: "v1.0.5",
        date: "2026-01-19",
        title: "Actualizaciones en Tiempo Real",
        description: "Implementación de sockets para el historial.",
        items: [
            { type: "feature", text: "Dashboard: Actualización de eventos en tiempo real vía Socket.io." },
            { type: "improvement", text: "Historial: Scroll infinito y filtrado dinámico mejorado." }
        ]
    }
];

const typeStyles: Record<string, { icon: any, color: string, bg: string }> = {
    feature: { icon: PlusCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    fix: { icon: Bug, color: "text-red-400", bg: "bg-red-500/10" },
    performance: { icon: Zap, color: "text-blue-400", bg: "bg-blue-500/10" },
    improvement: { icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10" }
};

export default function ChangelogPage() {
    return (
        <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-700">
            <header className="mb-12">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-xl">
                        <FileText size={32} className="text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-white uppercase tracking-tight">Changelog</h1>
                        <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">Historial de actualizaciones y mejoras</p>
                    </div>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-neutral-800 via-neutral-800 to-transparent" />
            </header>

            <div className="space-y-12 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-neutral-800">
                {changes.map((release, idx) => (
                    <div key={release.version} className="relative pl-12 group">
                        {/* Timeline node */}
                        <div className="absolute left-0 top-1.5 w-[35px] h-[35px] rounded-full bg-neutral-900 border-2 border-neutral-800 flex items-center justify-center z-10 group-hover:border-blue-500/50 transition-colors">
                            {idx === 0 ? <Rocket size={16} className="text-blue-400" /> : <Clock size={16} className="text-neutral-600" />}
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                            <h2 className="text-2xl font-black text-white">{release.version}</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest h-5 px-2 flex items-center rounded-full bg-neutral-800 border border-neutral-700">
                                    {release.date}
                                </span>
                                {idx === 0 && (
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest h-5 px-2 flex items-center rounded-full bg-blue-500/10 border border-blue-500/20">
                                        LATEST
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl mb-6">
                            <h3 className="text-xl font-bold text-neutral-200 mb-2">{release.title}</h3>
                            <p className="text-neutral-500 text-sm mb-6">{release.description}</p>

                            <div className="grid gap-4">
                                {release.items.map((item, i) => {
                                    const style = typeStyles[item.type] || typeStyles.improvement;
                                    const Icon = style.icon;
                                    return (
                                        <div key={i} className="flex items-start gap-4 p-3 rounded-xl bg-neutral-950/50 border border-neutral-800/50 hover:bg-neutral-900 transition-colors group/item">
                                            <div className={cn("mt-0.5 p-1.5 rounded-lg shrink-0", style.bg)}>
                                                <Icon size={14} className={style.color} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-neutral-300 leading-relaxed">
                                                    {item.text}
                                                </p>
                                                <span className={cn("text-[9px] font-black uppercase tracking-widest", style.color)}>
                                                    {item.type}
                                                </span>
                                            </div>
                                            <ChevronRight size={14} className="mt-1 text-neutral-800 group-hover/item:text-neutral-600 transition-colors" />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <footer className="mt-20 pt-8 border-t border-neutral-800 text-center">
                <p className="text-xs font-bold text-neutral-600 uppercase tracking-[0.2em]">
                    OmniAccess Software Foundation &copy; 2026
                </p>
            </footer>
        </div>
    );
}
