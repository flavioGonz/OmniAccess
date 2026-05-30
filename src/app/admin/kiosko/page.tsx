"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Users, Clock, Maximize, Loader2 } from "lucide-react";
import { getQueueWaitEstimate, getQueueAlerts, getQueueDevices } from "@/app/actions/queue";

type Status = "ok" | "warn" | "full";

const THEME: Record<Status, { bg: string; ring: string; light: string; label: string; sub: string }> = {
    ok:   { bg: "from-emerald-600 to-green-700", ring: "#10b981", light: "#34d399", label: "PASE",            sub: "Hay lugar disponible" },
    warn: { bg: "from-amber-500 to-orange-600",  ring: "#f59e0b", light: "#fbbf24", label: "AGUARDE",         sub: "Fila moderada" },
    full: { bg: "from-red-600 to-rose-700",      ring: "#ef4444", light: "#f87171", label: "AFORO COMPLETO",  sub: "Por favor espere su turno" },
};

export default function KioskoPage() {
    const [aforo, setAforo] = useState(0);
    const [waitMin, setWaitMin] = useState<number | null>(null);
    const [limit, setLimit] = useState(8);
    const [deviceName, setDeviceName] = useState("Fila");
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());
    const deviceIdRef = useRef<string | undefined>(undefined);

    const load = useCallback(async () => {
        try {
            if (!deviceIdRef.current) {
                const devs = await getQueueDevices();
                if (devs?.[0]) { deviceIdRef.current = devs[0].id; setDeviceName(devs[0].name || "Fila"); }
            }
            const [w, alerts] = await Promise.all([
                getQueueWaitEstimate(deviceIdRef.current),
                getQueueAlerts(),
            ]);
            setAforo((w as any)?.aforo ?? 0);
            setWaitMin((w as any)?.waitMin ?? null);
            const ths = (alerts as any[]).map(a => a.threshold).filter((n: number) => n > 0);
            if (ths.length) setLimit(Math.max(...ths));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const t = setInterval(load, 5000);
        const c = setInterval(() => setNow(new Date()), 1000);
        return () => { clearInterval(t); clearInterval(c); };
    }, [load]);

    const ratio = limit > 0 ? aforo / limit : 0;
    const status: Status = ratio >= 1 ? "full" : ratio >= 0.7 ? "warn" : "ok";
    const th = THEME[status];

    const goFullscreen = () => {
        const el: any = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    };

    return (
        <div className={`fixed inset-0 bg-gradient-to-br ${th.bg} text-white flex flex-col items-center justify-center overflow-hidden transition-colors duration-700`}>
            <style>{`@keyframes kpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.04);opacity:.92}}`}</style>

            {/* top bar */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5">
                <div className="text-2xl font-black tracking-tight uppercase opacity-90">{deviceName}</div>
                <div className="flex items-center gap-4">
                    <div className="text-xl font-mono font-bold tabular-nums opacity-90">{now.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}</div>
                    <button onClick={goFullscreen} className="p-2 rounded-lg bg-white/15 hover:bg-white/25 transition" title="Pantalla completa">
                        <Maximize size={18} />
                    </button>
                </div>
            </div>

            {loading ? (
                <Loader2 size={48} className="animate-spin opacity-80" />
            ) : (
                <>
                    {/* Big semáforo status */}
                    <div className="text-center" style={{ animation: status === "full" ? "kpulse 1.2s ease-in-out infinite" : undefined }}>
                        <div
                            className="mx-auto mb-8 rounded-full flex items-center justify-center shadow-2xl"
                            style={{ width: 220, height: 220, background: "rgba(255,255,255,0.14)", boxShadow: `0 0 80px ${th.light}88, inset 0 0 0 6px rgba(255,255,255,0.25)` }}
                        >
                            <Users size={96} className="text-white drop-shadow-lg" />
                        </div>
                        <div className="text-7xl xl:text-8xl font-black tracking-tighter leading-none drop-shadow-xl">{th.label}</div>
                        <div className="text-2xl xl:text-3xl font-medium mt-4 opacity-90">{th.sub}</div>
                    </div>

                    {/* metrics row */}
                    <div className="absolute bottom-0 left-0 right-0 grid grid-cols-2 divide-x divide-white/20 border-t border-white/20 bg-black/15 backdrop-blur-sm">
                        <div className="flex flex-col items-center justify-center py-7">
                            <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold opacity-80"><Users size={16} /> Personas en fila</div>
                            <div className="text-6xl font-black tabular-nums mt-1">{aforo}<span className="text-2xl font-medium opacity-70"> / {limit}</span></div>
                        </div>
                        <div className="flex flex-col items-center justify-center py-7">
                            <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold opacity-80"><Clock size={16} /> Espera estimada</div>
                            <div className="text-6xl font-black tabular-nums mt-1">
                                {waitMin == null ? "—" : waitMin < 1 ? "<1" : `~${waitMin}`}<span className="text-2xl font-medium opacity-70"> min</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
