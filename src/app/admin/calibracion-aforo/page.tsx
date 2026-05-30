"use client";

import { useEffect, useState, useCallback } from "react";
import { SlidersHorizontal, RefreshCw, Activity, Waves, CheckCircle2, Info, Loader2 } from "lucide-react";
import { getQueueRawVsStable, getQueueDevices } from "@/app/actions/queue";

type Pt = { t: number; v: number };
type Data = {
    raw: Pt[]; stable: Pt[]; rawChanges: number; stableChanges: number;
    changesPerMin: number; amplitude: number; suggestedReboteSec: number; samples: number; minutes: number;
};

function Chart({ raw, stable }: { raw: Pt[]; stable: Pt[] }) {
    if (raw.length < 2) {
        return <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sin lecturas en el período.</div>;
    }
    const W = 1000, H = 260, PAD_L = 34, PAD_R = 12, PAD_T = 14, PAD_B = 26;
    const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
    const t0 = raw[0].t, t1 = raw[raw.length - 1].t || t0 + 1;
    const maxV = Math.max(...raw.map(p => p.v), ...stable.map(p => p.v), 2);
    const x = (t: number) => PAD_L + ((t - t0) / Math.max(t1 - t0, 1)) * plotW;
    const y = (v: number) => PAD_T + (1 - v / maxV) * plotH;
    const path = (pts: Pt[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto", maxHeight: 280 }} preserveAspectRatio="none">
            {[0, 0.5, 1].map((g, i) => (
                <g key={i}>
                    <line x1={PAD_L} y1={PAD_T + g * plotH} x2={W - PAD_R} y2={PAD_T + g * plotH} stroke="var(--border)" strokeWidth="1" strokeDasharray={g === 1 ? "0" : "4 6"} opacity={g === 1 ? 0.8 : 0.4} />
                    <text x={PAD_L - 6} y={PAD_T + g * plotH + 3} textAnchor="end" fontSize="10" fontFamily="monospace" style={{ fill: "var(--muted-foreground)" }}>{Math.round(maxV * (1 - g))}</text>
                </g>
            ))}
            {/* raw: faint amber, step-like */}
            <path d={path(raw)} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.5" />
            {/* stable: bold violet */}
            <path d={path(stable)} fill="none" stroke="#a855f7" strokeWidth="2.75" strokeLinejoin="round" />
        </svg>
    );
}

export default function CalibracionPage() {
    const [data, setData] = useState<Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [minutes, setMinutes] = useState(10);
    const [deviceName, setDeviceName] = useState("Fila");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const devs = await getQueueDevices();
            const dev = devs?.[0];
            if (dev) setDeviceName(dev.name || "Fila");
            const d = await getQueueRawVsStable(dev?.id, minutes);
            setData(d as any);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [minutes]);

    useEffect(() => { load(); }, [load]);

    const m = data;
    const noisy = (m?.changesPerMin ?? 0) > 8;

    return (
        <div className="max-w-5xl mx-auto space-y-5 p-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
                        <SlidersHorizontal size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Calibración de Aforo</h1>
                        <p className="text-xs text-muted-foreground">{deviceName} · aforo crudo vs. estabilizado</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border">
                        {[10, 30, 60].map(opt => (
                            <button key={opt} onClick={() => setMinutes(opt)}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${minutes === opt ? "bg-violet-600 text-white" : "text-muted-foreground hover:text-foreground"}`}>
                                {opt} min
                            </button>
                        ))}
                    </div>
                    <button onClick={load} className="p-2 rounded-lg bg-muted hover:bg-accent border border-border text-muted-foreground hover:text-foreground transition" title="Recargar">
                        <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Suggestion banner */}
            <div className={`rounded-2xl border p-5 flex items-center gap-4 ${noisy ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-emerald-500/30 bg-emerald-500/[0.06]"}`}>
                {noisy ? <Waves size={28} className="text-amber-400 shrink-0" /> : <CheckCircle2 size={28} className="text-emerald-400 shrink-0" />}
                <div className="flex-1">
                    <div className="text-sm font-bold text-foreground">
                        {noisy ? "El aforo fluctúa bastante" : "El aforo se ve estable"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        Tiempo de rebote sugerido: <span className="font-black text-violet-400">{m?.suggestedReboteSec ?? "—"} s</span>
                        {" · "}Configúralo en la cámara: <span className="font-mono">VCA → Tareas → Aforo → Tiempo de rebote</span>.
                    </div>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Cambios crudos", value: m?.rawChanges ?? 0, icon: Activity, color: "#f59e0b" },
                    { label: "Cambios estabilizado", value: m?.stableChanges ?? 0, icon: Activity, color: "#a855f7" },
                    { label: "Cambios / min", value: m?.changesPerMin ?? 0, icon: Waves, color: "#06b6d4" },
                    { label: "Amplitud (máx−mín)", value: m?.amplitude ?? 0, icon: SlidersHorizontal, color: "#10b981" },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                            <Icon size={12} style={{ color }} /> {label}
                        </div>
                        <div className="text-2xl font-black tabular-nums mt-1" style={{ color }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Chart */}
            <div className="rounded-2xl border border-border bg-gradient-to-b from-foreground/[0.03] to-transparent p-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-foreground/70">Aforo · últimos {minutes} min</span>
                    <div className="flex items-center gap-4 text-[11px]">
                        <span className="flex items-center gap-1.5 text-amber-400"><span className="w-3 h-[3px] rounded bg-amber-500/60 inline-block" /> Crudo (cámara)</span>
                        <span className="flex items-center gap-1.5 text-violet-400"><span className="w-3 h-[3px] rounded bg-violet-500 inline-block" /> Estabilizado (sugerido)</span>
                    </div>
                </div>
                {loading ? (
                    <div className="h-[260px] flex items-center justify-center"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
                ) : (
                    <Chart raw={m?.raw || []} stable={m?.stable || []} />
                )}
            </div>

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <Info size={13} className="shrink-0 mt-0.5 text-violet-400" />
                <span>La línea violeta simula cómo quedaría el aforo con el rebote sugerido. La cámara aplica su propio rebote antes de enviar; este panel mide el ruido residual para recomendar el ajuste. {m?.samples ?? 0} lecturas analizadas.</span>
            </div>
        </div>
    );
}
