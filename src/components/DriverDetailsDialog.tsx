import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ShieldCheck, Server, Activity, Plus, Trash2, Save, Zap, Workflow, Code } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DRIVER_MODELS, type DeviceBrand } from "@/lib/driver-models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDeviceModel, deleteDeviceModel } from "@/app/actions/driver-models";

// Driver metadata (version, features, etc.)
const DRIVER_INFO = {
    HIKVISION: {
        version: "2.4.1 (Stable)",
        releaseDate: "15/11/2023",
        features: ["ISAPI Core Protocol", "LPR Metadata Stream V2", "Bi-directional Audio", "Access Control Events"],
    },
    AKUVOX: {
        version: "1.2.0 (Beta)",
        releaseDate: "10/12/2023",
        features: ["HTTP API Integration", "Remote Door Relay", "Card/Tag Sync", "Face Library Management"],
    },
    DAHUA: {
        version: "3.0.5",
        releaseDate: "20/09/2023",
        features: ["CGI Interface", "ITC LPR Events", "Smart Traffic Support"],
    },
    ZKTECO: {
        version: "1.0.2",
        releaseDate: "05/05/2023",
        features: ["Push SDK Protocol", "Attendance Events", "BioPhoto Sync"],
    },
    AXIS: {
        version: "Vapix 3.0",
        releaseDate: "01/08/2023",
        features: ["ACAP Support", "Edge Analytics", "Metadata Stream"],
    },
    INTELBRAS: {
        version: "1.1.0",
        releaseDate: "12/10/2023",
        features: ["CGI Protocol", "Event Notifications", "PTZ Control"],
    },
    AVICAM: {
        version: "0.9.0 (Dev)",
        releaseDate: "N/A",
        features: ["Generic ONVIF", "Basic Events"],
    },
    MILESIGHT: {
        version: "1.0.0",
        releaseDate: "15/08/2023",
        features: ["HTTP API", "Event Stream", "Analytics"],
    },
    UNIFI: {
        version: "2.0.1",
        releaseDate: "20/11/2023",
        features: ["UniFi Protect API", "Smart Detection", "Cloud Sync"],
    },
    UNIVIEW: {
        version: "1.5.2",
        releaseDate: "05/09/2023",
        features: ["EZStation Protocol", "LPR Events", "Access Control"],
    },
} as const;

interface DriverDetailsDialogProps {
    brand: string | null;
    isOpen: boolean;
    onClose: () => void;
}


export function DriverDetailsDialog({ brand, isOpen, onClose }: DriverDetailsDialogProps) {
    const [newModel, setNewModel] = useState({ value: "", label: "", category: "", photo: "" });
    const [isAdding, setIsAdding] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    if (!brand) return null;

    const brandKey = brand.toUpperCase() as DeviceBrand;
    const driverInfo = DRIVER_INFO[brandKey];
    const models = DRIVER_MODELS[brandKey] || [];

    if (!driverInfo) return null;

    const handleAddModel = async () => {
        if (!newModel.value || !newModel.label || !newModel.category) {
            alert("Por favor completa todos los campos");
            return;
        }

        setIsAdding(true);
        const result = await addDeviceModel(brand, newModel);
        setIsAdding(false);

        if (result.success) {
            setNewModel({ value: "", label: "", category: "" });
            // Reload page to get updated models
            window.location.reload();
        } else {
            alert("Error al agregar modelo: " + result.error);
        }
    };

    const handleDeleteModel = async (modelValue: string) => {
        if (!confirm("¿Estás seguro de eliminar este modelo?")) return;

        setIsDeleting(modelValue);
        const result = await deleteDeviceModel(brand, modelValue);
        setIsDeleting(null);

        if (result.success) {
            window.location.reload();
        } else {
            alert("Error al eliminar modelo: " + result.error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl bg-neutral-900/95 border-white/10 backdrop-blur-xl p-0 overflow-hidden flex flex-col md:flex-row gap-0 h-[700px]">
                <DialogTitle className="sr-only">{brand} Driver Configuration</DialogTitle>
                {/* Left Side: Driver Info */}
                <div className="w-full md:w-1/3 bg-white/5 p-8 border-r border-white/5 flex flex-col justify-between relative">
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">{brand}</h2>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px] uppercase font-bold tracking-wider">
                                    Driver Active
                                </Badge>
                                <span className="text-[10px] text-neutral-500 font-mono">v{driverInfo.version}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Compilación</label>
                                <div className="flex items-center gap-2 text-neutral-300 font-mono text-sm">
                                    <Server size={14} className="text-blue-500" />
                                    {driverInfo.releaseDate}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Capacidades</label>
                                <div className="space-y-2">
                                    {driverInfo.features.map((feat, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-neutral-300">
                                            <Check size={12} className="text-emerald-500" /> {feat}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 mt-auto border-t border-white/5">
                        <div className="flex items-center gap-2 text-[10px] text-neutral-500 uppercase font-bold">
                            <Activity size={14} className="animate-pulse text-emerald-500" />
                            System Healthy
                        </div>
                    </div>
                </div>

                {/* Right Side: Models Management */}
                <div className="w-full md:w-2/3 p-8 bg-neutral-950/50 flex flex-col">
                    <Tabs defaultValue="models" className="flex-1 flex flex-col min-h-0">
                        <TabsList className="bg-black/20 border border-white/5 p-1 self-start mb-6">
                            <TabsTrigger value="models" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-blue-600">
                                <Code size={14} className="mr-2" />
                                Modelos Certificados
                            </TabsTrigger>
                            <TabsTrigger value="webhooks" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-blue-600">
                                <Zap size={14} className="mr-2" />
                                Action URLs Logic
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="models" className="flex-1 flex flex-col min-h-0 m-0 focus-visible:ring-0">
                            {/* Add Model Form */}
                            <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10">
                                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                    <Plus size={14} className="text-blue-500" />
                                    Agregar Nuevo Modelo
                                </h4>
                                <div className="grid grid-cols-4 gap-3 mb-3">
                                    <div>
                                        <Label className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Código</Label>
                                        <Input
                                            value={newModel.value}
                                            onChange={(e) => setNewModel({ ...newModel, value: e.target.value })}
                                            placeholder="DS-K1T671M"
                                            className="h-9 bg-neutral-900 border-neutral-700 text-xs font-mono"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Nombre</Label>
                                        <Input
                                            value={newModel.label}
                                            onChange={(e) => setNewModel({ ...newModel, label: e.target.value })}
                                            placeholder="Nombre Comercial"
                                            className="h-9 bg-neutral-900 border-neutral-700 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Categoría</Label>
                                        <Input
                                            value={newModel.category}
                                            onChange={(e) => setNewModel({ ...newModel, category: e.target.value })}
                                            placeholder="Face/LPR/Relay"
                                            className="h-9 bg-neutral-900 border-neutral-700 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Foto URL</Label>
                                        <Input
                                            value={newModel.photo}
                                            onChange={(e) => setNewModel({ ...newModel, photo: e.target.value })}
                                            placeholder="https://..."
                                            className="h-9 bg-neutral-900 border-neutral-700 text-xs font-mono"
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={handleAddModel}
                                    disabled={isAdding}
                                    className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20"
                                >
                                    {isAdding ? "Guardando..." : <><Save size={14} className="mr-2" /> Guardar Modelo en Catálogo</>}
                                </Button>
                            </div>

                            {/* Models List */}
                            <ScrollArea className="flex-1 pr-4">
                                <div className="space-y-2">
                                    {models.map((model, idx) => (
                                        <div key={idx} className="group relative bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 transition-all duration-300 flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center overflow-hidden">
                                                        {model.photo ? (
                                                            <img src={model.photo} alt={model.label} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Workflow size={18} className="text-neutral-700" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white text-sm">{model.label}</h4>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-[10px] text-blue-400 font-black uppercase tracking-wider">{model.category}</p>
                                                            <span className="text-neutral-700 text-[10px]">•</span>
                                                            <p className="text-[10px] text-neutral-500 font-mono tracking-tighter">{model.value}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteModel(model.value)}
                                                disabled={isDeleting === model.value}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                            >
                                                {isDeleting === model.value ? (
                                                    <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 size={14} />
                                                )}
                                            </Button>
                                        </div>
                                    ))}
                                    {models.length === 0 && (
                                        <div className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl p-12 text-neutral-600 bg-black/20">
                                            <Workflow size={32} className="mb-4 opacity-20" />
                                            <p className="text-sm font-bold text-center">No hay modelos definidos</p>
                                            <p className="text-[10px] text-center mt-2 uppercase tracking-widest font-black opacity-60">Agrega el primer modelo usando el panel superior</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="webhooks" className="flex-1 m-0 focus-visible:ring-0">
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="p-6 bg-gradient-to-r from-blue-600/10 to-transparent border border-blue-500/20 rounded-2xl">
                                    <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Activity size={16} className="text-blue-500" />
                                        Capacidades de Webhook
                                    </h4>
                                    <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">
                                        El servidor procesa eventos a través del puerto <code className="text-blue-400 bg-blue-400/10 px-1 rounded">10000</code>.
                                        Para modelos de <span className="text-white font-bold">{brand}</span>, el esquema de normalización admite los siguientes eventos maestros:
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-white/5 overflow-hidden bg-black/40">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white/5">
                                                <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Evento Maestro</th>
                                                <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Action URL de Ejemplo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {[
                                                { ev: "Face Recognition", url: "/api/webhooks/akuvox?event=face_valid&mac=$mac&user=$name&time=$time" },
                                                { ev: "Card/RFID Swipe", url: "/api/webhooks/akuvox?event=card_valid&mac=$mac&card=$card_sn&time=$time" },
                                                { ev: "PIN Code Entry", url: "/api/webhooks/akuvox?event=code_valid&mac=$mac&code=$code&time=$time" },
                                                { ev: "Relay Triggered", url: "/api/webhooks/akuvox?event=door_open&mac=$mac&id=$relay_id&time=$time" },
                                                { ev: "Tamper Alarm", url: "/api/webhooks/akuvox?event=tamper&mac=$mac&time=$time" },
                                                { ev: "Incoming Call", url: "/api/webhooks/akuvox?event=calling&mac=$mac&to=$remote&time=$time" }
                                            ].map((row, i) => (
                                                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                                            <span className="text-[11px] font-bold text-neutral-200 uppercase">{row.ev}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="p-2 bg-neutral-900/50 rounded-lg border border-white/5 font-mono text-[9px] text-blue-400/80 group-hover:text-blue-400 transition-colors break-all">
                                                            http://TU_IP_SERVIDOR:10000{row.url}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="p-5 bg-blue-900/10 rounded-2xl border border-blue-500/20">
                                    <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <ShieldCheck size={12} />
                                        Nota de Configuración
                                    </h5>
                                    <p className="text-[10px] text-neutral-500 leading-relaxed font-medium">
                                        Sustituye <code>TU_IP_SERVIDOR</code> por la dirección IP estática donde corre el servicio de webhooks.
                                        El sistema utiliza una lógica de normalización automática: aunque configures un evento genérico,
                                        mientras envíes el <code>$mac</code>, el servidor lo asignará al equipo correcto.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
