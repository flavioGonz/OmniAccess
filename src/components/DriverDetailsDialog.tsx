import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ShieldCheck, Server, Activity, Plus, Trash2, Save, Zap, Workflow, Code, Car, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DRIVER_MODELS, type DeviceBrand } from "@/lib/driver-models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDeviceModel, deleteDeviceModel } from "@/app/actions/driver-models";
import { HIKVISION_VEHICLE_BRANDS } from "@/lib/hikvision-codes";
import { getCarLogo } from "@/lib/car-logos";
import carLogos from "@/lib/car-logos.json";
import { saveHikvisionBrands } from "@/app/actions/settings";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";


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
            setNewModel({ value: "", label: "", category: "", photo: "" });
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
                            <TabsTrigger value="brands" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-blue-600">
                                <Car size={14} className="mr-2" />
                                Marcas de Autos
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="models" className="flex-1 flex flex-col min-h-0 m-0 focus-visible:ring-0">
                            {/* ... existing Add Model Form & Models List codes ... */}
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

                        <TabsContent value="brands" className="flex-1 flex flex-col min-h-0 m-0 focus-visible:ring-0">
                            <BrandEditor />
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function BrandEditor() {
    const [brands, setBrands] = useState<{ code: string; name: string }[]>(
        Object.entries(HIKVISION_VEHICLE_BRANDS)
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => parseInt(a.code) - parseInt(b.code))
    );
    const [newCode, setNewCode] = useState("");
    const [newName, setNewName] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [logoOpen, setLogoOpen] = useState(false);
    const [filter, setFilter] = useState("");

    const filteredBrands = brands
        .filter(b => b.code.includes(filter) || b.name.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => parseInt(a.code) - parseInt(b.code));

    const handleDelete = (code: string) => {
        if (confirm("¿Eliminar este mapeo de marca?")) {
            setBrands(prev => prev.filter(b => b.code !== code));
        }
    };

    const handleAdd = () => {
        if (!newCode || !newName) {
            toast.error("Complete ambos campos");
            return;
        }
        if (brands.some(b => b.code === newCode)) {
            toast.error("El código ya existe");
            return;
        }
        setBrands(prev => [...prev, { code: newCode, name: newName }].sort((a, b) => parseInt(a.code) - parseInt(b.code)));
        setNewCode("");
        setNewName("");
        toast.success("Marca agregada a la lista temporal");
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const map: Record<string, string> = {};
            brands.forEach(b => map[b.code] = b.name);
            const result = await saveHikvisionBrands(map);

            if (result.success) {
                toast.success("Marcas guardadas correctamente. Reiniciando UI...", { duration: 3000 });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast.error("Error al guardar: " + result.message);
            }
        } catch (e) {
            toast.error("Error inesperado al guardar");
        }
        setIsSaving(false);
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="p-4 bg-gradient-to-r from-purple-600/10 to-transparent border border-purple-500/20 rounded-2xl mb-4 shrink-0">
                <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Car size={16} className="text-purple-500" />
                    Mapeo de Marcas de Vehículos
                </h4>
                <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">
                    Asocie los códigos numéricos de Hikvision con sus marcas correspondientes.
                    Al seleccionar una marca conocida, el logo se asignará automáticamente.
                </p>
            </div>

            {/* Add New Brand Form */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 mb-6 flex items-end gap-4 shrink-0 shadow-lg">
                <div className="w-24 shrink-0 space-y-1.5">
                    <Label className="text-[9px] uppercase font-black text-neutral-500 tracking-widest pl-0.5">Código</Label>
                    <Input
                        value={newCode}
                        onChange={e => setNewCode(e.target.value)}
                        placeholder="1038"
                        className="h-9 bg-black/40 border-white/10 font-mono text-xs text-center focus-visible:ring-purple-500/50"
                    />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                    <Label className="text-[9px] uppercase font-black text-neutral-500 tracking-widest pl-0.5">Marca (Nombre o Búsqueda)</Label>
                    <Popover open={logoOpen} onOpenChange={setLogoOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={logoOpen}
                                className="w-full justify-between bg-black/40 border-white/10 h-9 text-xs focus-visible:ring-purple-500/50"
                            >
                                {newName || <span className="text-neutral-500 italic">Seleccionar marca o escribir nombre...</span>}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0 bg-neutral-900 border-white/10 max-h-[300px]" align="start">
                            <Command className="bg-transparent">
                                <CommandInput placeholder="Buscar marca..." className="h-9 border-none focus:ring-0" />
                                <CommandList>
                                    <CommandEmpty>No se encontró la marca.</CommandEmpty>
                                    <CommandGroup className="max-h-[200px] overflow-auto custom-scrollbar">
                                        {carLogos.map((logo: any) => (
                                            <CommandItem
                                                key={logo.slug}
                                                value={logo.name}
                                                onSelect={(currentValue) => {
                                                    setNewName(currentValue);
                                                    setLogoOpen(false);
                                                }}
                                                className="text-xs data-[selected=true]:bg-white/10 py-2 cursor-pointer"
                                            >
                                                <Check
                                                    className={cn("mr-2 h-3 w-3", newName === logo.name ? "opacity-100" : "opacity-0")}
                                                />
                                                <div className="flex items-center gap-3">
                                                    {logo.image?.optimized ? (
                                                        <div className="w-6 h-6 bg-white p-0.5 rounded flex items-center justify-center">
                                                            <img src={logo.image.optimized} alt="" className="max-w-full max-h-full object-contain" />
                                                        </div>
                                                    ) : null}
                                                    <span className="font-medium">{logo.name}</span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="shrink-0 pb-[1px]">
                    <Button onClick={handleAdd} className="h-9 px-5 bg-blue-600 hover:bg-blue-500 text-[11px] uppercase font-black tracking-wider shadow-lg shadow-blue-900/20 transition-all hover:scale-105 active:scale-95">
                        <Plus size={16} className="mr-1.5" /> Agregar
                    </Button>
                </div>
            </div>

            {/* Table Search & List */}
            <div className="flex-1 bg-black/20 rounded-xl border border-white/5 overflow-hidden flex flex-col min-h-0 shadow-inner">
                {/* Mini Search Toolbar */}
                <div className="bg-white/5 border-b border-white/5 px-2 py-2 flex items-center justify-between gap-4 shrink-0">
                    <div className="relative flex-1 max-w-[200px]">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <Input
                            placeholder="Buscar código o marca..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="h-7 pl-8 bg-black/20 border-white/5 text-[10px] focus-visible:ring-0 placeholder:text-neutral-600"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-2 bg-white/5 border-b border-white/5 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-neutral-500 shrink-0">
                    <div className="col-span-2">Código</div>
                    <div className="col-span-5">Marca Definida</div>
                    <div className="col-span-3">Logo Automático</div>
                    <div className="col-span-2 text-right">Acción</div>
                </div>
                <ScrollArea className="flex-1 h-full">
                    <div className="divide-y divide-white/5">
                        {filteredBrands.map((brand) => {
                            const logo = getCarLogo(brand.name);
                            return (
                                <div key={brand.code} className="grid grid-cols-12 gap-2 px-4 py-2 items-center hover:bg-white/[0.02] transition-colors group h-12">
                                    <div className="col-span-2 font-mono text-xs text-blue-400 font-bold tracking-wider">
                                        {brand.code}
                                    </div>
                                    <div className="col-span-5 text-xs font-bold text-white truncate pr-2">
                                        {brand.name}
                                    </div>
                                    <div className="col-span-3 flex items-center gap-3">
                                        {logo ? (
                                            <div className="w-8 h-8 rounded-md bg-white p-1 flex items-center justify-center border border-white/10 shadow-sm shrink-0">
                                                <img src={logo} alt={brand.name} className="max-w-full max-h-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                                <span className="text-[9px] text-neutral-600 italic">N/A</span>
                                            </div>
                                        )}
                                        {logo ? (
                                            <span className="text-[9px] text-emerald-500 font-black tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                OK
                                            </span>
                                        ) : (
                                            <span className="text-[9px] text-neutral-600 font-bold tracking-wider opacity-50">
                                                -
                                            </span>
                                        )}
                                    </div>
                                    <div className="col-span-2 text-right">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDelete(brand.code)}
                                            className="h-7 w-7 p-0 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
                <div className="bg-black/40 border-t border-white/5 px-4 py-2 text-[9px] text-neutral-500 flex items-center gap-2 truncate shrink-0">
                    <Server size={10} />
                    <span className="opacity-70">Fuente:</span>
                    <code className="bg-white/5 px-1.5 py-0.5 rounded text-neutral-400 font-mono tracking-tight">/filippofilip95 ... /optimized/</code>
                </div>
            </div>

            <div className="mt-4 flex justify-between items-center shrink-0">
                <p className="text-[10px] text-neutral-600 italic">
                    {brands.length} Marcas Definidas
                </p>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest h-8"
                >
                    {isSaving ? <Loader2 size={12} className="animate-spin mr-2" /> : <Save size={12} className="mr-2" />}
                    Guardar Cambios
                </Button>
            </div>
        </div>
    );
}
