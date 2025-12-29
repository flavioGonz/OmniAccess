"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Copy, ExternalLink, Info, Zap, ShieldCheck, Activity } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "./ui/badge";

interface AkuvoxActionUrlDialogProps {
    device: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AkuvoxActionUrlDialog({ device, open, onOpenChange }: AkuvoxActionUrlDialogProps) {
    const [copied, setCopied] = useState<string | null>(null);
    const [serverIp, setServerIp] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            setServerIp(window.location.hostname);
        }
    }, []);

    const baseUrl = `http://${serverIp}:10000/api/webhooks/akuvox`;

    const RECOMMENDATIONS = [
        {
            event: "Face Success",
            desc: "Se dispara cuando un rostro es reconocido correctamente.",
            url: `${baseUrl}?event=face_valid&mac=$mac&user=$name&time=$time`,
            variable: "$name"
        },
        {
            event: "Face Failed",
            desc: "Se dispara al fallar el reconocimiento facial.",
            url: `${baseUrl}?event=face_invalid&mac=$mac&time=$time`,
            variable: "N/A"
        },
        {
            event: "Card Success",
            desc: "Se dispara al pasar una tarjeta RFID válida.",
            url: `${baseUrl}?event=card_valid&mac=$mac&card=$card_sn&time=$time`,
            variable: "$card_sn"
        },
        {
            event: "Card Failed",
            desc: "Se dispara al pasar una tarjeta RFID no registrada.",
            url: `${baseUrl}?event=card_invalid&mac=$mac&card=$card_sn&time=$time`,
            variable: "$card_sn"
        },
        {
            event: "Code Success",
            desc: "Se dispara al ingresar un código PIN válido.",
            url: `${baseUrl}?event=code_valid&mac=$mac&code=$code&time=$time`,
            variable: "$code"
        },
        {
            event: "Code Failed",
            desc: "Se dispara al ingresar un código PIN incorrecto.",
            url: `${baseUrl}?event=code_invalid&mac=$mac&code=$code&time=$time`,
            variable: "$code"
        },
        {
            event: "Relay Triggered",
            desc: "Feedback de apertura de puerta (Relé activado).",
            url: `${baseUrl}?event=door_open&mac=$mac&id=$relay_id&time=$time`,
            variable: "$relay_id"
        },
        {
            event: "Relay Closed",
            desc: "Feedback de cierre de puerta (Relé desactivado).",
            url: `${baseUrl}?event=door_close&mac=$mac&id=$relay_id&time=$time`,
            variable: "$relay_id"
        },
        {
            event: "Tamper Alarm",
            desc: "Alerta de sabotaje (equipo removido de la pared).",
            url: `${baseUrl}?event=tamper&mac=$mac&time=$time`,
            variable: "$alarmstatus"
        },
        {
            event: "Incoming Call",
            desc: "Se dispara al iniciar una llamada desde el frente.",
            url: `${baseUrl}?event=calling&mac=$mac&to=$remote&time=$time`,
            variable: "$remote"
        }
    ];

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        toast.success("URL copiada al portapapeles");
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl bg-[#0a0a0a] border-white/10 p-0 overflow-hidden shadow-2xl">
                <div className="flex flex-col h-[700px]">
                    {/* Header */}
                    <div className="p-8 border-b border-white/5 bg-gradient-to-r from-blue-600/10 to-indigo-600/10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                                <Zap size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black text-white uppercase tracking-tighter">
                                    Configurador de Action URLs
                                </DialogTitle>
                                <DialogDescription className="text-blue-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                                    Akuvox Universal Webhook Logic
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/5 flex items-start gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                                <Activity size={20} className="animate-pulse" />
                            </div>
                            <div>
                                <p className="text-xs text-white font-black uppercase tracking-widest mb-1">Reporte en Tiempo Real</p>
                                <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">
                                    Al configurar estas URLs, los eventos se reportarán <span className="text-emerald-400 font-bold">EN VIVO</span>
                                    dentro del apartado de <span className="text-white font-bold italic">Arquitectura de Hardware</span>.
                                    Podrás ver las aperturas y los nombres de las personas al instante en la lista de dispositivos.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-full p-8 px-10">
                            <div className="space-y-6 pb-8">
                                {RECOMMENDATIONS.map((item, idx) => (
                                    <div key={idx} className="group bg-neutral-900/30 border border-white/5 hover:border-blue-500/30 rounded-2xl p-6 transition-all duration-300">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <Badge className="bg-blue-600/20 text-blue-400 border-none font-black px-3 py-1 text-[10px] uppercase">
                                                    {item.event}
                                                </Badge>
                                                <span className="text-[10px] text-neutral-600 font-bold uppercase tracking-wider italic">
                                                    Variable: {item.variable}
                                                </span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyToClipboard(item.url, item.event)}
                                                className="h-8 rounded-lg bg-neutral-800 hover:bg-blue-600 hover:text-white text-neutral-400 transition-all gap-2"
                                            >
                                                {copied === item.event ? <Check size={14} /> : <Copy size={14} />}
                                                <span className="text-[9px] font-black uppercase">Copiar URL</span>
                                            </Button>
                                        </div>
                                        <p className="text-sm text-white font-bold mb-4">{item.desc}</p>
                                        <div className="bg-black/50 p-4 rounded-xl border border-white/5 font-mono text-[11px] text-blue-300/80 break-all leading-relaxed relative group-hover:bg-black/80 transition-all">
                                            {item.url}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-[#0c0c0c] border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <ShieldCheck size={18} />
                            </div>
                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                                Servidor Webhook listo en puerto 10000
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="h-10 rounded-xl border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-white font-bold uppercase text-[10px] tracking-widest"
                        >
                            Finalizar Configuración
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
