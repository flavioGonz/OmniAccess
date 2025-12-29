"use client";

import { useState, useCallback } from "react";
import { DeviceType, DeviceBrand, DeviceDirection, AuthType, DoorStatus } from "@prisma/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Server,
    Wifi,
    Shield,
    Globe,
    Lock,
    User,
    ArrowRightLeft,
    Plus,
    Edit,
    Cpu,
    BadgeCheck,
    Network,
    HardDrive,
    Key,
    Activity,
    Loader2,
    ImagePlus,
    Camera,
    MapPin
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { createDevice, updateDevice } from "@/app/actions/devices";
import { DRIVER_MODELS, type DeviceBrand as DriverDeviceBrand } from "@/lib/driver-models";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";

interface DeviceFormDialogProps {
    device?: any;
    groups: any[];
    onSuccess: () => void;
    children: React.ReactNode;
}

const BRANDS = [
    { value: "HIKVISION", label: "Hikvision", color: "#E4002B", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Hikvision_logo.svg" },
    { value: "AKUVOX", label: "Akuvox", color: "#005BA4", logoUrl: "https://shop.akuvox.it/skins/akuvox/customer/images/logo.png" },
    { value: "INTELBRAS", label: "Intelbras", color: "#009639", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Intelbras_logo.svg" },
    { value: "DAHUA", label: "Dahua", color: "#ED1C24", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Dahua_Technology_logo.svg" },
    { value: "ZKTECO", label: "ZKTeco", color: "#0191D2", logoUrl: "https://www.zkteco.com/upload/201908/5d4d3c3f3f0f7.png" },
    { value: "AVICAM", label: "Avicam", color: "#333333", logoUrl: "" },
    { value: "MILESIGHT", label: "Milesight", color: "#00AEEF", logoUrl: "" },
    { value: "UNIFI", label: "Ubiquiti UniFi", color: "#005EAD", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Ubiquiti_Networks_logo.svg" },
    { value: "UNIVIEW", label: "Uniview", color: "#005EB8", logoUrl: "https://www.uniview.com/etc/designs/uniview/logo.png" },
];

export function DeviceFormDialog({ device, groups, onSuccess, children }: DeviceFormDialogProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState(1);
    const [modelComboOpen, setModelComboOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: device?.name || "",
        deviceType: device?.deviceType || "LPR_CAMERA",
        brand: device?.brand || "HIKVISION",
        deviceModel: device?.deviceModel || "",
        ip: device?.ip || "",
        mac: device?.mac || "",
        location: device?.location || "",
        direction: device?.direction || "ENTRY",
        username: device?.username || "admin",
        password: device?.password || "",
        authType: device?.authType || "BASIC",
    });
    const [modelPhotoFile, setModelPhotoFile] = useState<File | null>(null);
    const [brandLogoFile, setBrandLogoFile] = useState<File | null>(null);

    const isEdit = !!device;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = useCallback((name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const finalData = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            finalData.append(key, value);
        });

        if (modelPhotoFile) finalData.append("modelPhoto", modelPhotoFile);
        if (brandLogoFile) finalData.append("brandLogo", brandLogoFile);

        try {
            if (isEdit) {
                await updateDevice(device.id, finalData);
            } else {
                await createDevice(finalData);
            }
            setOpen(false);
            onSuccess();
        } catch (error) {
            console.error("Error saving device:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const nextStep = () => setStep(prev => Math.min(prev + 1, 3));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) setStep(1); // Reset step on close
        }}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-6xl p-0 bg-neutral-900 border-neutral-800 overflow-hidden sm:rounded-lg gap-0 shadow-2xl border-white/5">
                <DialogHeader className="sr-only">
                    <DialogTitle>{isEdit ? "Editar Dispositivo" : "Nuevo Dispositivo"}</DialogTitle>
                    <DialogDescription>Configuración técnica del nodo de acceso</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col md:flex-row h-full min-h-[610px] bg-neutral-950 overflow-hidden">
                    {/* LEFT SIDE: Active Form Content */}
                    <div className="flex-1 p-10 flex flex-col justify-between border-r border-white/5">
                        <div className="flex-1">
                            {/* Step Indicator Header */}
                            <div className="mb-10">
                                <div className="flex items-center gap-2 mb-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className={cn(
                                            "h-1 rounded-full transition-all duration-700",
                                            step === i ? "w-12 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]" :
                                                step > i ? "w-4 bg-emerald-500/50" : "w-4 bg-neutral-800"
                                        )} />
                                    ))}
                                </div>
                                <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-1">
                                    {isEdit ? "Sincronizar Nodo" : "Alta de Dispositivo"}
                                </h1>
                                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em]">
                                    {formData.brand} • {formData.deviceType.replace('_', ' ')}
                                </p>
                            </div>

                            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                                {step === 1 && (
                                    <div className="space-y-8">
                                        <div className="space-y-2">
                                            <Label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <HardDrive size={10} /> Nombre de Identificación
                                            </Label>
                                            <Input
                                                name="name"
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                placeholder="Ej: Acceso Principal LPR"
                                                className="bg-neutral-900 border-neutral-800 h-12 rounded-lg text-lg font-bold focus:ring-blue-500/20"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">Tipo</Label>
                                                <Select value={formData.deviceType} onValueChange={(val) => handleSelectChange("deviceType", val)}>
                                                    <SelectTrigger className="bg-neutral-900 border-neutral-800 h-12 rounded-lg font-bold">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-[#0c0c0c] border-neutral-800 text-white rounded-2xl">
                                                        <SelectItem value="LPR_CAMERA" className="py-3 font-bold">Cámara LPR</SelectItem>
                                                        <SelectItem value="FACE_TERMINAL" className="py-3 font-bold">Acceso Facial</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">Fabricante</Label>
                                                <Select value={formData.brand} onValueChange={(val) => handleSelectChange("brand", val)}>
                                                    <SelectTrigger className="bg-neutral-900 border-neutral-800 h-12 rounded-lg font-bold">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-[#0c0c0c] border-neutral-800 text-white rounded-2xl">
                                                        {BRANDS.map(b => (
                                                            <SelectItem key={b.value} value={b.value} className="py-3 font-bold">
                                                                {b.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <Cpu size={10} /> Modelo Hardware
                                            </Label>
                                            <Popover open={modelComboOpen} onOpenChange={setModelComboOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-between bg-neutral-900 border-neutral-800 h-12 rounded-lg text-sm font-mono font-bold"
                                                    >
                                                        {formData.deviceModel
                                                            ? DRIVER_MODELS[formData.brand as DriverDeviceBrand]?.find((m) => m.value === formData.deviceModel)?.label
                                                            : "Seleccionar modelo..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] p-0 bg-[#0c0c0c] border-neutral-800 shadow-2xl">
                                                    <Command className="bg-[#0c0c0c]">
                                                        <CommandInput placeholder="Filtrar modelos..." className="h-10" />
                                                        <CommandEmpty>No hay resultados.</CommandEmpty>
                                                        <CommandGroup className="max-h-60 overflow-y-auto custom-scrollbar">
                                                            {DRIVER_MODELS[formData.brand as DriverDeviceBrand]?.map((model) => (
                                                                <CommandItem
                                                                    key={model.value}
                                                                    value={model.value}
                                                                    onSelect={(v) => {
                                                                        handleSelectChange("deviceModel", v);
                                                                        setModelComboOpen(false);
                                                                    }}
                                                                    className="px-4 py-3 cursor-pointer hover:bg-white/10 transition-colors"
                                                                >
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="font-bold text-white uppercase text-[11px]">{model.label}</span>
                                                                        <span className="text-[9px] text-neutral-500 font-black tracking-widest uppercase">{model.category}</span>
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                    <Wifi size={10} /> Host / IP
                                                </Label>
                                                <Input
                                                    name="ip"
                                                    value={formData.ip}
                                                    onChange={handleInputChange}
                                                    className="bg-neutral-900 border-neutral-800 h-12 rounded-lg text-lg font-mono font-bold text-blue-400"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                    <Globe size={10} /> Hardware ID (MAC)
                                                </Label>
                                                <Input
                                                    name="mac"
                                                    value={formData.mac}
                                                    onChange={handleInputChange}
                                                    className="bg-neutral-900 border-neutral-800 h-12 rounded-lg text-lg font-mono font-bold uppercase"
                                                />
                                            </div>
                                        </div>
                                        <div className="p-5 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                                <Network size={18} />
                                            </div>
                                            <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">
                                                Requiere visibilidad en red local o puerto mapeado para gestión remota.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {step === 3 && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <Label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                    <User size={10} /> Usuario Manager
                                                </Label>
                                                <Input
                                                    name="username"
                                                    value={formData.username}
                                                    onChange={handleInputChange}
                                                    className="bg-neutral-900 border-neutral-800 h-12 rounded-lg font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                    <Lock size={10} /> API Password
                                                </Label>
                                                <Input
                                                    name="password"
                                                    type="password"
                                                    value={formData.password}
                                                    onChange={handleInputChange}
                                                    className="bg-neutral-900 border-neutral-800 h-12 rounded-lg font-bold"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <MapPin size={10} /> Ubicación Física
                                            </Label>
                                            <Input
                                                name="location"
                                                value={formData.location}
                                                onChange={handleInputChange}
                                                placeholder="Lote 1030, Entrada B..."
                                                className="bg-neutral-900 border-neutral-800 h-12 rounded-lg font-bold"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Navigation Footer */}
                        <div className="flex gap-4 pt-10 border-t border-white/5">
                            {step > 1 && (
                                <Button
                                    type="button"
                                    onClick={prevStep}
                                    variant="outline"
                                    className="h-12 px-8 rounded-lg border-neutral-800 text-neutral-500 font-bold uppercase tracking-widest text-[9px] hover:bg-neutral-900 hover:text-white transition-all"
                                >
                                    Atrás
                                </Button>
                            )}
                            {step < 3 ? (
                                <Button
                                    type="button"
                                    onClick={nextStep}
                                    className="flex-1 h-12 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-500/20"
                                >
                                    Continuar a Fase {step + 1} <ArrowRightLeft size={16} className="ml-2 opacity-50" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="flex-1 h-12 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-xs shadow-[0_0_30px_rgba(37,99,235,0.2)]"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : isEdit ? "Sincronizar Nodo" : "Finalizar y Vincular"}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDE: Tech Aesthetic + Large Floating Numbers */}
                    <div className="relative w-full md:w-1/2 bg-black flex flex-col items-center justify-center p-12 group overflow-hidden shrink-0">
                        <Image
                            src="/device_background.png"
                            alt="Hardware Architecture"
                            fill
                            className="object-cover opacity-10 grayscale transition-all duration-1000 group-hover:scale-110 group-hover:opacity-20"
                        />

                        {/* Animated Grid Mask */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.01)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black,transparent)]" />

                        {/* Floating stylized numbers overlaying image */}
                        <div className="relative w-full h-full flex flex-col items-center justify-center pointer-events-none">
                            {[1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className={cn(
                                        "absolute transition-all duration-1000 ease-in-out font-black leading-none",
                                        step === i
                                            ? "opacity-100 scale-100 blur-0 translate-y-0"
                                            : "opacity-0 scale-50 blur-xl translate-y-20"
                                    )}
                                >
                                    <span className="text-[280px] text-blue-500 drop-shadow-[0_0_40px_rgba(59,130,246,0.5)] tracking-tighter">
                                        {i === 1 ? '01' : i === 2 ? '02' : '03'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Active Step label */}
                        <div className="mt-auto relative z-10 w-full max-w-[280px] p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl animate-in fade-in zoom-in duration-700">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_#3b82f6]" />
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                    {step === 1 ? "Fase 01: Identidad" : step === 2 ? "Fase 02: Network" : "Fase 03: Protocolos"}
                                </span>
                            </div>
                            <p className="text-[11px] text-neutral-500 font-medium leading-relaxed italic">
                                {step === 1 ? "Defina el fabricante y el modelo específico para cargar los controladores necesarios." :
                                    step === 2 ? "Configure el direccionamiento IP y valide el enlace MAC para comunicación bidireccional." :
                                        "Ajuste los métodos de autenticación y el sentido de flujo del nodo de acceso."}
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
