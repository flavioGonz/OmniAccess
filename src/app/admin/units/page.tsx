"use client";

import { useState, useEffect } from "react";
import { Unit } from "@prisma/client";
import {
    Building2,
    Home,
    MapPin,
    LayoutGrid,
    Pencil,
    Trash2,
    Plus,
    Info,
    Server,
    Users,
    ChevronRight,
    Search,
    Video,
    ScanFace,
    MoreVertical,
    ArrowRight,
    Check,
    Layers,
    Phone,
    Hash,
    Monitor,
    ChevronLeft,
    Globe,
    UserCircle,
    Building,
    ExternalLink,
    Map as MapIcon,
    Navigation,
    LocateFixed
} from "lucide-react";
import dynamic from 'next/dynamic';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
    ssr: false,
    loading: () => <div className="h-64 w-full bg-neutral-900 animate-pulse rounded-xl" />
});

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUnits, deleteUnit, createUnit, updateUnit } from "@/app/actions/units";
import { cn } from "@/lib/utils";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import Image from "next/image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function UnitsPage() {
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [mode, setMode] = useState<'list' | 'wizard'>('list');
    const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [activeEditTab, setActiveEditTab] = useState<'general' | 'structure' | 'location'>('general');
    const [showLevelsDialog, setShowLevelsDialog] = useState(false);
    const [showResidentsDialog, setShowResidentsDialog] = useState(false);
    const [currentLevel, setCurrentLevel] = useState<number | null>(null);

    // Wizard State
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: "",
        type: "EDIFICIO",
        floors: "",
        lot: "",
        houseNumber: "",
        address: "",
        adminPhone: "",
        deviceCount: "2",
        deviceType: "BOTH",
        coordinates: "-34.6037, -58.3816"
    });

    const loadUnits = async () => {
        setLoading(true);
        try {
            const data = await getUnits();
            setUnits(data);
            if (data.length > 0 && !selectedUnit) {
                setSelectedUnit(data[0]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUnits();
    }, []);

    const handleCreateNew = () => {
        setEditingUnit(null);
        setFormData({
            name: "",
            type: "EDIFICIO",
            floors: "",
            lot: "",
            houseNumber: "",
            address: "",
            adminPhone: "",
            deviceCount: "2",
            deviceType: "BOTH",
            coordinates: "-34.6037, -58.3816"
        });
        setStep(1);
        setMode('wizard');
    };

    const handleEdit = (unit: Unit) => {
        setEditingUnit(unit);
        setFormData({
            name: unit.name,
            type: unit.type,
            floors: unit.floors?.toString() || "",
            lot: (unit as any).lot || "",
            houseNumber: (unit as any).houseNumber || "",
            address: unit.address || "",
            adminPhone: unit.adminPhone || "",
            deviceCount: unit.deviceCount?.toString() || "2",
            deviceType: unit.deviceType || "BOTH",
            coordinates: unit.coordinates || "-34.6037, -58.3816"
        });
        setActiveEditTab('general');
        setShowEditDialog(true);
    };



    const handleQuickEdit = async () => {
        if (!editingUnit) return;

        const payload = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            payload.append(key, value);
        });

        try {
            await updateUnit(editingUnit.id, payload);
            setShowEditDialog(false);
            loadUnits();
        } catch (e) {
            console.error(e);
            alert("Error al actualizar");
        }
    };

    const handleSubmitWizard = async () => {
        const payload = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            payload.append(key, value);
        });

        try {
            if (editingUnit) {
                await updateUnit(editingUnit.id, payload);
            } else {
                await createUnit(payload);
            }
            setMode('list');
            setStep(1);
            loadUnits();
        } catch (e) {
            console.error(e);
            alert("Error al guardar");
        }
    };

    const getLevels = (count: number) => {
        return Array.from({ length: count }, (_, i) => ({
            number: i + 1,
            label: `Nivel ${i + 1}`,
            apartments: 4,
            devices: i === 0 ? [{ name: "LPR Entrada", type: 'LPR' }, { name: "Face Hall", type: 'FACE' }] : []
        }));
    };

    const filteredUnits = units.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // WIZARD MODE
    if (mode === 'wizard') {
        return (
            <div className="max-w-4xl mx-auto py-10 space-y-8 animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between mb-8">
                    <Button variant="ghost" onClick={() => setMode('list')} className="text-neutral-500 hover:text-white">
                        <ChevronLeft className="mr-2" /> Cancelar
                    </Button>
                    <div className="flex items-center gap-2">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className={cn("h-1.5 w-12 rounded-full transition-all duration-500", step >= s ? "bg-blue-600" : "bg-neutral-800")} />
                        ))}
                    </div>
                    <span className="text-xs font-black text-neutral-600 uppercase tracking-widest">PASO {step} DE 3</span>
                </div>

                {/* STEP 1: TYPE */}
                {step === 1 && (
                    <div className="space-y-8">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-white">¿Qué tipo de lugar vamos a administrar?</h2>
                            <p className="text-neutral-400">Selecciona la categoría que mejor describa el entorno.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { id: "BARRIO", icon: MapPin, label: "Barrio Cerrado", desc: "Múltiples lotes, calles internas y accesos perimetrales." },
                                { id: "EDIFICIO", icon: Building2, label: "Edificio / Torre", desc: "Estructura vertical con departamentos y áreas comunes." },
                                { id: "CASA", icon: Home, label: "Casa Inteligente", desc: "Unidad individual con domótica y control de acceso propio." }
                            ].map((type) => (
                                <Card
                                    key={type.id}
                                    onClick={() => setFormData({ ...formData, type: type.id })}
                                    className={cn(
                                        "bg-neutral-900 border-neutral-800 cursor-pointer transition-all hover:scale-105 hover:border-blue-500/50 group relative overflow-hidden",
                                        formData.type === type.id ? "ring-2 ring-blue-500 border-transparent bg-neutral-900/80" : ""
                                    )}
                                >
                                    <CardContent className="p-8 flex flex-col items-center text-center space-y-4 relative z-10">
                                        <div className={cn(
                                            "p-4 rounded-lg transition-colors",
                                            formData.type === type.id ? "bg-blue-500 text-white shadow-lg" : "bg-neutral-800 text-neutral-400 group-hover:bg-neutral-700"
                                        )}>
                                            <type.icon size={32} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{type.label}</h3>
                                            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">{type.desc}</p>
                                        </div>
                                        {formData.type === type.id && (
                                            <div className="absolute top-4 right-4 text-blue-500">
                                                <Check size={20} />
                                            </div>
                                        )}
                                    </CardContent>
                                    {formData.type === type.id && <div className="absolute inset-0 bg-blue-500/5 pointer-events-none" />}
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* STEP 2: DETAILS */}
                {step === 2 && (
                    <div className="space-y-8">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-white">Detalles de la Infraestructura</h2>
                            <p className="text-neutral-400">Configura las dimensiones y características operativas.</p>
                        </div>

                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest">Nombre del Lugar</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ej: Torres del Sol"
                                        className="bg-neutral-950 border-neutral-800 h-12 rounded-xl text-lg font-bold"
                                    />
                                </div>

                                {formData.type === 'EDIFICIO' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                                <Layers size={14} /> Cantidad de Niveles
                                            </Label>
                                            <Input
                                                type="number"
                                                value={formData.floors}
                                                onChange={(e) => setFormData({ ...formData, floors: e.target.value })}
                                                placeholder="Ej: 10"
                                                className="bg-neutral-950 border-neutral-800 h-12 rounded-xl font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                                <Phone size={14} /> Contacto Admin
                                            </Label>
                                            <Input
                                                value={formData.adminPhone}
                                                onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                                                placeholder="+54 9 ..."
                                                className="bg-neutral-950 border-neutral-800 h-12 rounded-xl"
                                            />
                                        </div>
                                    </>
                                )}

                                {formData.type === 'BARRIO' && (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest flelx items-center gap-2">
                                                Lote / Parcela
                                            </Label>
                                            <Input
                                                value={formData.lot}
                                                onChange={(e) => setFormData({ ...formData, lot: e.target.value })}
                                                placeholder="Ej: B12 o 45"
                                                className="bg-neutral-950 border-neutral-800 h-12 rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest">
                                                Número de Casa
                                            </Label>
                                            <Input
                                                value={formData.houseNumber}
                                                onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                                                placeholder="Ej: 154"
                                                className="bg-neutral-950 border-neutral-800 h-12 rounded-xl"
                                            />
                                        </div>
                                    </>
                                )}

                                {formData.type === 'CASA' && (
                                    <div className="space-y-2 col-span-2">
                                        <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest">Número de Vivienda</Label>
                                        <Input
                                            value={formData.houseNumber}
                                            onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                                            placeholder="Ej: 450"
                                            className="bg-neutral-950 border-neutral-800 h-12 rounded-xl"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-neutral-950/50 rounded-lg border border-neutral-800 space-y-6">
                                <div className="flex items-center gap-3 text-emerald-400 mb-2">
                                    <Monitor size={20} />
                                    <h4 className="font-bold text-sm uppercase tracking-wider">Hardware de Acceso</h4>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                            <Hash size={14} /> Dispositivos
                                        </Label>
                                        <Input
                                            type="number"
                                            value={formData.deviceCount}
                                            onChange={(e) => setFormData({ ...formData, deviceCount: e.target.value })}
                                            className="bg-neutral-900 border-neutral-800 h-10 rounded-lg font-mono text-emerald-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest">Tecnología Principal</Label>
                                        <Select
                                            value={formData.deviceType}
                                            onValueChange={(v) => setFormData({ ...formData, deviceType: v })}
                                        >
                                            <SelectTrigger className="bg-neutral-900 border-neutral-800 h-10 rounded-lg">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-neutral-900 border-neutral-800 text-white rounded-lg">
                                                <SelectItem value="LPR"><div className="flex items-center gap-2"><Video size={14} /> Solo Patentes (LPR)</div></SelectItem>
                                                <SelectItem value="FACE"><div className="flex items-center gap-2"><ScanFace size={14} /> Solo Facial</div></SelectItem>
                                                <SelectItem value="BOTH"><div className="flex items-center gap-2"><LayoutGrid size={14} /> Híbrido (LPR + Facial)</div></SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: LOCATION */}
                {step === 3 && (
                    <div className="space-y-8">
                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-black text-white">Geolocalización</h2>
                            <p className="text-neutral-400">¿Dónde se encuentra ubicado?</p>
                        </div>

                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                            <div className="h-64 bg-neutral-800 relative group cursor-crosshair">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/World_map_blank_without_borders.svg/2000px-World_map_blank_without_borders.svg.png')] bg-cover bg-center grayscale" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center space-y-4">
                                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                            <MapPin size={32} className="text-blue-500" />
                                        </div>
                                        <p className="text-xs font-black text-neutral-500 uppercase tracking-widest">Vista de Mapa (Simulada)</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest">Dirección Física</Label>
                                    <Input
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Calle 123, Ciudad, País"
                                        className="bg-neutral-950 border-neutral-800 h-12 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest text-blue-500">Coordenadas GPS</Label>
                                    <Input
                                        value={formData.coordinates}
                                        onChange={(e) => setFormData({ ...formData, coordinates: e.target.value })}
                                        className="bg-blue-500/5 border-blue-500/20 h-10 rounded-lg text-sm font-mono text-blue-400"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between pt-8 border-t border-neutral-800/50">
                    <Button
                        variant="outline"
                        onClick={() => setStep(step - 1)}
                        disabled={step === 1}
                        className="h-12 px-8 rounded-xl border-neutral-800 hover:bg-neutral-800 text-neutral-400 font-bold"
                    >
                        Atrás
                    </Button>

                    {step < 3 ? (
                        <Button
                            onClick={() => setStep(step + 1)}
                            disabled={!formData.type || (step === 2 && !formData.name)}
                            className="bg-white text-black hover:bg-neutral-200 h-12 px-8 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl"
                        >
                            Siguiente Paso <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmitWizard}
                            className="bg-emerald-500 hover:bg-emerald-600 text-black h-12 px-8 rounded-xl font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                        >
                            {editingUnit ? "GUARDAR CAMBIOS" : "FINALIZAR INSTALACIÓN"}
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="p-6 h-full flex flex-col md:flex-row gap-8 animate-in fade-in duration-500 overflow-hidden">
                {/* Left Column */}
                <div className="w-full md:w-72 shrink-0 flex flex-col gap-6">
                    <header className="flex justify-between items-center mb-6 px-1">
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight uppercase">Propiedades</h1>
                            <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">
                                {units.length} Unidades
                            </p>
                        </div>
                    </header>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                        <Input
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 bg-neutral-900 border-neutral-800 rounded-xl"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                        {filteredUnits.map((unit) => (
                            <div
                                key={unit.id}
                                onClick={() => setSelectedUnit(unit)}
                                className={cn(
                                    "group p-5 rounded-xl border cursor-pointer transition-all relative overflow-hidden",
                                    selectedUnit?.id === unit.id
                                        ? "bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20"
                                        : "bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800"
                                )}
                            >
                                <div className="flex items-start justify-between relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "p-2 rounded-lg shrink-0",
                                            selectedUnit?.id === unit.id ? "bg-white/20 text-white" : "bg-neutral-800 text-neutral-500 group-hover:text-white"
                                        )}>
                                            {unit.type === 'EDIFICIO' && <Building2 size={18} />}
                                            {unit.type === 'BARRIO' && <MapPin size={18} />}
                                            {unit.type === 'CASA' && <Home size={18} />}
                                        </div>
                                        <div className="overflow-hidden">
                                            <h3 className={cn("font-bold text-sm truncate", selectedUnit?.id === unit.id ? "text-white" : "text-neutral-200")}>{unit.name}</h3>
                                            <p className={cn("text-xs font-medium truncate", selectedUnit?.id === unit.id ? "text-blue-200" : "text-neutral-500")}>
                                                {unit.type}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <Button onClick={handleCreateNew} variant="outline" className="w-full border-dashed border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 h-12 rounded-xl text-xs">
                            <Plus size={14} className="mr-2" /> Nueva Propiedad
                        </Button>
                    </div>
                </div>

                {/* Right Column */}
                <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col relative shadow-2xl">
                    {selectedUnit ? (
                        <>
                            <div className="h-64 relative shrink-0">
                                <div className="absolute inset-0 z-0">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        frameBorder="0"
                                        scrolling="no"
                                        marginHeight={0}
                                        marginWidth={0}
                                        src={`https://maps.google.com/maps?q=${selectedUnit.coordinates || selectedUnit.address}&z=15&output=embed`}
                                        className="filter grayscale contrast-125"
                                    />
                                </div>

                                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/60 to-transparent" />

                                <div className="absolute bottom-6 left-8 right-8 flex justify-between items-end">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-1 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-md">
                                                {selectedUnit.type}
                                            </span>
                                            {selectedUnit.floors && (
                                                <span className="px-2 py-1 bg-neutral-800 text-neutral-300 text-[10px] font-black uppercase tracking-widest rounded-md border border-neutral-700">
                                                    {selectedUnit.floors} Niveles
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-3xl font-black text-white tracking-tight mb-1">{selectedUnit.name}</h2>
                                        <div className="flex items-center gap-4">
                                            <p className="text-neutral-400 font-medium flex items-center gap-2 text-sm">
                                                <MapPin size={14} /> {selectedUnit.address || "Dirección no especificada"}
                                            </p>
                                            {(selectedUnit as any).lot && (
                                                <div className="flex items-center gap-2 bg-neutral-800/80 px-2 py-1 rounded border border-white/5">
                                                    <span className="text-[10px] font-black text-neutral-500 uppercase">Lote</span>
                                                    <span className="text-xs font-bold text-blue-400">{(selectedUnit as any).lot}</span>
                                                </div>
                                            )}
                                            {(selectedUnit as any).houseNumber && (
                                                <div className="flex items-center gap-2 bg-neutral-800/80 px-2 py-1 rounded border border-white/5">
                                                    <span className="text-[10px] font-black text-neutral-500 uppercase">Nº Casa</span>
                                                    <span className="text-xs font-bold text-white">{(selectedUnit as any).houseNumber}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={() => handleEdit(selectedUnit)} size="icon" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white backdrop-blur border border-white/10 rounded-xl">
                                            <Pencil size={18} />
                                        </Button>
                                        <DeleteConfirmDialog
                                            id={selectedUnit.id}
                                            title={selectedUnit.name}
                                            description="Eliminar unidad?"
                                            onDelete={deleteUnit}
                                            onSuccess={() => { loadUnits(); setSelectedUnit(null); }}
                                        >
                                            <Button size="icon" variant="destructive" className="bg-red-500/80 hover:bg-red-600 backdrop-blur rounded-xl">
                                                <Trash2 size={18} />
                                            </Button>
                                        </DeleteConfirmDialog>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

                                {selectedUnit.type === 'EDIFICIO' && selectedUnit.floors && (selectedUnit.floors as number) > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                <LayoutGrid size={18} className="text-neutral-500" />
                                                Distribución de Niveles
                                            </h3>
                                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest border-neutral-800 bg-neutral-900" onClick={() => setShowLevelsDialog(true)}>
                                                Administrar Niveles
                                            </Button>
                                        </div>
                                        <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-white/5 border-b border-white/5">
                                                    <tr>
                                                        <th className="p-4 font-bold text-neutral-400 uppercase text-[10px] tracking-widest w-20">Nivel</th>
                                                        <th className="p-4 font-bold text-neutral-400 uppercase text-[10px] tracking-widest">Etiqueta</th>
                                                        <th className="p-4 font-bold text-neutral-400 uppercase text-[10px] tracking-widest">Dispositivos de Acceso</th>
                                                        <th className="p-4 font-bold text-neutral-400 uppercase text-[10px] tracking-widest text-right">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {getLevels(selectedUnit.floors as number).reverse().map((level) => (
                                                        <tr key={level.number} className="hover:bg-white/5 transition-colors group">
                                                            <td className="p-4 font-mono text-neutral-500">#{level.number}</td>
                                                            <td className="p-4 font-bold text-white uppercase tracking-tighter">{level.number === 1 ? "Planta Baja" : `Nivel ${level.number}`}</td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-2">
                                                                    {level.devices.length > 0 ? (
                                                                        level.devices.map((dev, idx) => (
                                                                            <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-xs text-neutral-300">
                                                                                {dev.type === 'LPR' ? <Video size={10} className="text-purple-400" /> : <ScanFace size={10} className="text-blue-400" />}
                                                                                {dev.name}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-neutral-600 text-xs italic">Pasillo Común</span>
                                                                    )}

                                                                    <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ml-2 hover:bg-neutral-700">
                                                                        <Plus size={12} className="text-emerald-500" />
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-neutral-500 hover:text-white">
                                                                            <MoreVertical size={16} />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="bg-neutral-900 border-neutral-800 text-neutral-300">
                                                                        <DropdownMenuItem className="hover:bg-neutral-800" onClick={() => { setCurrentLevel(level.number); setShowLevelsDialog(true); }}>
                                                                            <Pencil size={12} className="mr-2" /> Editar Nivel
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem className="hover:bg-neutral-800" onClick={() => { setCurrentLevel(level.number); setShowResidentsDialog(true); }}>
                                                                            <Users size={12} className="mr-2" /> Ver Residentes
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem className="text-red-500 hover:bg-neutral-800">
                                                                            <Trash2 size={12} className="mr-2" /> Desactivar
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {selectedUnit.type !== 'EDIFICIO' && (
                                    <div className="text-center py-20 border border-dashed border-neutral-800/50 rounded-2xl bg-neutral-950/30 mt-8">
                                        <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                                            <Info size={20} className="text-neutral-700" />
                                        </div>
                                        <p className="text-neutral-500 text-xs font-medium max-w-[240px] mx-auto leading-relaxed">Información detallada no disponible para este tipo de unidad en esta versión.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 p-12 text-center">
                            <div className="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <Building2 size={40} className="text-neutral-700" />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">Selecciona una Propiedad</h2>
                            <p className="max-w-xs mx-auto text-sm">Elige una unidad de la lista lateral para ver sus detalles, plantas y configuración.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Stylized Quick Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="bg-neutral-950 border-white/5 text-white max-w-4xl p-0 overflow-hidden outline-none">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Editar Unidad</DialogTitle>
                        <DialogDescription>Modificar los detalles de la propiedad, estructura y ubicación.</DialogDescription>
                    </DialogHeader>
                    <div className="flex h-[600px]">
                        {/* Sidebar Sections */}
                        <div className="w-56 bg-neutral-900/50 border-r border-white/5 p-4 flex flex-col gap-2">
                            <div className="mb-6 px-2">
                                <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest">Edición</h3>
                                <p className="text-[10px] text-neutral-600 font-bold uppercase truncate">{editingUnit?.name}</p>
                            </div>
                            {[
                                { id: 'general', icon: Info, label: 'General' },
                                { id: 'structure', icon: LayoutGrid, label: 'Estructura' },
                                { id: 'location', icon: Navigation, label: 'Ubicación' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveEditTab(tab.id as any)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-bold",
                                        activeEditTab === tab.id
                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                            : "text-neutral-500 hover:bg-white/5 hover:text-white"
                                    )}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col">
                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                {activeEditTab === 'general' && (
                                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                                <Info size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-white uppercase tracking-tight">Datos principales</h4>
                                                <p className="text-[10px] text-neutral-500 font-bold">Identificación básica de la propiedad</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2 col-span-2">
                                                <Label className="text-[10px] font-black text-neutral-500 uppercase">Nombre de Unidad</Label>
                                                <Input
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="bg-black/40 border-white/5 h-11 focus:ring-blue-500/20"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-neutral-500 uppercase">Categoría</Label>
                                                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                                                    <SelectTrigger className="bg-black/40 border-white/5 h-11">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-neutral-900 border-white/5 text-white italic">
                                                        <SelectItem value="EDIFICIO">Edificio / Torre</SelectItem>
                                                        <SelectItem value="BARRIO">Barrio / Loteo</SelectItem>
                                                        <SelectItem value="CASA">Casa Particular</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-neutral-500 uppercase">Contacto Administrativo</Label>
                                                <Input
                                                    value={formData.adminPhone}
                                                    onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                                                    placeholder="+54 ..."
                                                    className="bg-black/40 border-white/5 h-11 font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeEditTab === 'structure' && (
                                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                                                <LayoutGrid size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-white uppercase tracking-tight">Arquitectura</h4>
                                                <p className="text-[10px] text-neutral-500 font-bold">Distribución interna y herencia</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {formData.type === 'EDIFICIO' && (
                                                <div className="space-y-2 col-span-2">
                                                    <Label className="text-[10px] font-black text-neutral-500 uppercase">Cantidad de Plantas / Niveles</Label>
                                                    <Input
                                                        type="number"
                                                        value={formData.floors}
                                                        onChange={(e) => setFormData({ ...formData, floors: e.target.value })}
                                                        className="bg-black/40 border-white/5 h-11 font-mono text-purple-400"
                                                    />
                                                </div>
                                            )}
                                            {formData.type === 'BARRIO' && (
                                                <>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black text-neutral-500 uppercase">Manzana / Lote</Label>
                                                        <Input
                                                            value={formData.lot}
                                                            onChange={(e) => setFormData({ ...formData, lot: e.target.value })}
                                                            className="bg-black/40 border-white/5 h-11"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black text-neutral-500 uppercase">Número Casa</Label>
                                                        <Input
                                                            value={formData.houseNumber}
                                                            onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                                                            className="bg-black/40 border-white/5 h-11"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                            {formData.type === 'CASA' && (
                                                <div className="space-y-2 col-span-2">
                                                    <Label className="text-[10px] font-black text-neutral-500 uppercase">Referencia Domiciliaria</Label>
                                                    <Input
                                                        value={formData.houseNumber}
                                                        onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                                                        placeholder="Ej: PH al fondo / Casa 4"
                                                        className="bg-black/40 border-white/5 h-11"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeEditTab === 'location' && (
                                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                                                <MapIcon size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-white uppercase tracking-tight">Geoposicionamiento</h4>
                                                <p className="text-[10px] text-neutral-500 font-bold">Ubicación exacta de la propiedad</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-neutral-500 uppercase">Dirección Física</Label>
                                                <Input
                                                    value={formData.address}
                                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                    className="bg-black/40 border-white/5 h-11"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black text-neutral-500 uppercase text-emerald-500">Mapa Interactivo</Label>
                                                <LocationPicker
                                                    coords={formData.coordinates}
                                                    onChange={(val) => setFormData({ ...formData, coordinates: val })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 bg-neutral-900/30 border-t border-white/5 flex justify-end gap-3">
                                <Button variant="ghost" onClick={() => setShowEditDialog(false)} className="text-neutral-500 hover:text-white font-bold h-11 rounded-xl">
                                    CANCELAR
                                </Button>
                                <Button onClick={handleQuickEdit} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-8 h-11 rounded-xl shadow-xl shadow-blue-600/20">
                                    GUARDAR CAMBIOS
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Sub-Modal: Edit Level */}
            <Dialog open={showLevelsDialog} onOpenChange={setShowLevelsDialog}>
                <DialogContent className="bg-neutral-900 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
                            <Layers size={18} className="text-blue-500" /> Gestionar Nivel {currentLevel}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-4 text-center">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Monitor size={20} className="text-blue-400" />
                            </div>
                            <h5 className="font-bold text-sm">Dispositivos en este nivel</h5>
                            <p className="text-xs text-neutral-500 mb-4">Configurar ubicación de cámaras faciales o lectores LPR</p>
                            <Button variant="outline" className="w-full border-dashed border-neutral-700 h-10 text-xs">
                                <Plus size={14} className="mr-2" /> VINCULAR DISPOSITIVO
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Sub-Modal: View Residents */}
            <Dialog open={showResidentsDialog} onOpenChange={setShowResidentsDialog}>
                <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase flex items-center gap-2">
                            <Users size={18} className="text-emerald-500" /> Residentes del Nivel {currentLevel}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500">
                                            <UserCircle size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold">Residente {i} - Depto {currentLevel}0{i}</p>
                                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Activo • {i} Vehículos</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-neutral-500 hover:text-white">
                                        <ChevronRight size={18} />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #333;
                    border-radius: 10px;
                }
                .leaflet-container {
                    background: #111 !important;
                }
            `}</style>
        </>
    );
}
