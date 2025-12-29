"use client";

import { useState, useRef, useEffect } from "react";
import {
    LayoutGrid,
    Upload,
    Plus,
    Trash2,
    Save,
    MousePointer2,
    Warehouse,
    Info,
    CheckCircle2,
    XCircle,
    Map,
    Home,
    Square,
    Pentagon,
    X,
    Search,
    User as UserIcon,
    Car
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getParkingSlots, saveParkingSlots, getParkingMap, uploadParkingMap } from "@/app/actions/plazas";
import { getUnitsWithDetails } from "@/app/actions/units";
import { toast } from "sonner";

interface ParkingSlot {
    id: string;
    points: { x: number; y: number }[]; // Polygon points
    label: string;
    unitId: string | null; // Link to Unit/Lote
    isOccupied: boolean;
}

interface Unit {
    id: string;
    name: string;
    number: string;
}

export default function PlazasPage() {
    const [mapImage, setMapImage] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [slots, setSlots] = useState<ParkingSlot[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [showUnitSelector, setShowUnitSelector] = useState(false);
    const [searchUnit, setSearchUnit] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadData = async () => {
            const [slotsData, unitsData, mapUrl] = await Promise.all([
                getParkingSlots(),
                getUnitsWithDetails(),
                getParkingMap()
            ]);

            // Migrate old rectangle format to polygon format
            const migratedSlots = (slotsData as any[]).map(slot => {
                // If it's old format (has x, y, width, height)
                if (slot.x !== undefined && slot.width !== undefined) {
                    return {
                        id: slot.id,
                        points: [
                            { x: slot.x, y: slot.y },
                            { x: slot.x + slot.width, y: slot.y },
                            { x: slot.x + slot.width, y: slot.y + slot.height },
                            { x: slot.x, y: slot.y + slot.height }
                        ],
                        label: slot.label,
                        unitId: slot.unitId || null,
                        isOccupied: slot.isOccupied || false
                    };
                }
                // Already in polygon format
                return slot;
            });

            setSlots(migratedSlots);
            // @ts-ignore
            setUnits(unitsData);
            if (mapUrl) setMapImage(mapUrl);
        };
        loadData();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (imageFile) {
                const formData = new FormData();
                formData.append("file", imageFile);
                await uploadParkingMap(formData);
                setImageFile(null);
            }

            const result = await saveParkingSlots(slots);
            if (result.success) {
                toast.success("¡Configuración Guardada!", {
                    description: result.message || "Las plazas se han guardado correctamente",
                    duration: 3000,
                });
            } else {
                toast.error("Error al Guardar", {
                    description: result.error || "No se pudo guardar la configuración",
                    duration: 4000,
                });
            }
        } catch (error: any) {
            toast.error("Error Inesperado", {
                description: error.message || "Ocurrió un error al guardar",
                duration: 4000,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setMapImage(url);
            setImageFile(file);
        }
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (!containerRef.current || !mapImage) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setCurrentPoints([...currentPoints, { x, y }]);
    };

    const finishPolygon = () => {
        if (currentPoints.length >= 3) {
            const newSlot: ParkingSlot = {
                id: Math.random().toString(36).substr(2, 9),
                points: currentPoints,
                label: `P-${slots.length + 1}`,
                unitId: null,
                isOccupied: false
            };
            setSlots([...slots, newSlot]);
        }
        setCurrentPoints([]);
    };

    const cancelDrawing = () => {
        setCurrentPoints([]);
    };

    const removeSlot = (id: string) => {
        setSlots(slots.filter(s => s.id !== id));
        if (selectedSlot === id) setSelectedSlot(null);
    };

    const linkSlotToUnit = (slotId: string, unitId: string) => {
        setSlots(slots.map(s => s.id === slotId ? { ...s, unitId } : s));
        setShowUnitSelector(false);
        setSelectedSlot(null);
    };

    const getPolygonPath = (points: { x: number; y: number }[]) => {
        if (!points || points.length === 0) return '';
        return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
    };

    const getPolygonCenter = (points: { x: number; y: number }[]) => {
        if (!points || points.length === 0) return { x: 0, y: 0 };
        const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        return { x, y };
    };

    const filteredUnits = units.filter(u => {
        const searchLower = searchUnit.toLowerCase();
        const name = (u.name || '').toLowerCase();
        const number = (u.number || '').toLowerCase();
        return name.includes(searchLower) || number.includes(searchLower);
    });

    return (
        <div className="fixed inset-0 lg:left-64 bg-[#0a0a0a] overflow-hidden animate-in fade-in duration-700">
            {/* Floating Controls - Top Left */}
            <div className="absolute top-6 left-6 z-20 space-y-3">
                {!mapImage ? (
                    <div className="relative">
                        <input
                            type="file"
                            onChange={handleImageUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            accept="image/*"
                        />
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 h-12 rounded-xl flex items-center gap-2 shadow-2xl shadow-blue-500/20 uppercase text-xs tracking-widest">
                            <Upload size={16} /> Cargar Plano
                        </Button>
                    </div>
                ) : (
                    <>
                        <Button
                            variant="outline"
                            onClick={() => { setMapImage(null); setSlots([]); }}
                            className="bg-neutral-900/90 backdrop-blur-xl border-neutral-700 text-neutral-300 hover:bg-red-500/20 hover:text-red-400 h-12 px-6 rounded-xl font-black transition-all text-xs uppercase tracking-widest shadow-2xl"
                        >
                            <X size={16} className="mr-2" /> Resetear
                        </Button>

                        {currentPoints.length > 0 && (
                            <div className="bg-neutral-900/90 backdrop-blur-xl border border-blue-500/30 rounded-xl p-4 shadow-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <Pentagon size={16} className="text-blue-400" />
                                    <span className="text-xs font-black text-white uppercase tracking-widest">
                                        Dibujando ({currentPoints.length} puntos)
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={finishPolygon}
                                        disabled={currentPoints.length < 3}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-4 rounded-lg text-xs font-black uppercase"
                                    >
                                        <CheckCircle2 size={14} className="mr-1" /> Finalizar
                                    </Button>
                                    <Button
                                        onClick={cancelDrawing}
                                        variant="outline"
                                        className="border-neutral-700 bg-neutral-800 text-neutral-300 h-10 px-4 rounded-lg text-xs font-black uppercase"
                                    >
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Floating Stats - Top Right */}
            {mapImage && (
                <div className="absolute top-6 right-6 z-20 bg-neutral-900/90 backdrop-blur-xl border border-neutral-800 rounded-xl p-4 shadow-2xl min-w-[200px]">
                    <div className="flex items-center gap-2 mb-3">
                        <LayoutGrid size={16} className="text-orange-500" />
                        <span className="text-xs font-black text-white uppercase tracking-widest">Estadísticas</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-neutral-500 font-bold">Total Plazas:</span>
                            <span className="text-white font-black">{slots.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-neutral-500 font-bold">Asignadas:</span>
                            <span className="text-emerald-400 font-black">{slots.filter(s => s.unitId).length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-neutral-500 font-bold">Sin Asignar:</span>
                            <span className="text-red-400 font-black">{slots.filter(s => !s.unitId).length}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Save Button - Bottom Right */}
            {mapImage && slots.length > 0 && (
                <div className="absolute bottom-6 right-6 z-20">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-black h-14 px-8 rounded-xl shadow-2xl shadow-blue-500/30 uppercase tracking-widest text-sm"
                    >
                        <Save size={18} className="mr-2" />
                        {isSaving ? "Guardando..." : "Guardar Configuración"}
                    </Button>
                </div>
            )}

            {/* Map Canvas */}
            <div
                ref={containerRef}
                onClick={handleCanvasClick}
                className={cn(
                    "w-full h-full relative flex items-center justify-center overflow-hidden",
                    currentPoints.length > 0 && "cursor-crosshair"
                )}
            >
                {mapImage ? (
                    <svg className="w-full h-full absolute inset-0">
                        <image
                            href={mapImage}
                            className="w-full h-full object-contain opacity-30 grayscale"
                            preserveAspectRatio="xMidYMid meet"
                        />

                        {/* Existing Polygons */}
                        {slots.filter(slot => slot.points && slot.points.length > 0).map((slot) => {
                            const center = getPolygonCenter(slot.points);
                            const unit = units.find(u => u.id === slot.unitId);
                            return (
                                <g key={slot.id}>
                                    <path
                                        d={getPolygonPath(slot.points)}
                                        className={cn(
                                            "transition-all duration-300 cursor-pointer",
                                            slot.unitId
                                                ? "fill-emerald-500/10 stroke-emerald-500/60"
                                                : "fill-red-500/10 stroke-red-500/60",
                                            selectedSlot === slot.id && "stroke-blue-500 stroke-[3]"
                                        )}
                                        strokeWidth="2"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSlot(slot.id);
                                            setShowUnitSelector(true);
                                        }}
                                    />
                                    <text
                                        x={center.x}
                                        y={center.y}
                                        className="text-xs font-black fill-white pointer-events-none"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                    >
                                        {slot.label}
                                    </text>
                                    {unit && (
                                        <text
                                            x={center.x}
                                            y={center.y + 15}
                                            className="text-[10px] font-bold fill-emerald-400 pointer-events-none"
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                        >
                                            {unit.number}
                                        </text>
                                    )}
                                </g>
                            );
                        })}

                        {/* Current Drawing */}
                        {currentPoints.length > 0 && (
                            <>
                                <path
                                    d={getPolygonPath([...currentPoints])}
                                    className="fill-blue-500/20 stroke-blue-500"
                                    strokeWidth="2"
                                    strokeDasharray="5,5"
                                />
                                {currentPoints.map((point, i) => (
                                    <circle
                                        key={i}
                                        cx={point.x}
                                        cy={point.y}
                                        r="4"
                                        className="fill-blue-500"
                                    />
                                ))}
                            </>
                        )}
                    </svg>
                ) : (
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-24 h-24 bg-neutral-900 rounded-2xl border border-neutral-800 flex items-center justify-center">
                            <Map size={40} className="text-neutral-700" />
                        </div>
                        <p className="text-neutral-600 font-black uppercase tracking-widest text-sm">
                            Carga un plano para comenzar
                        </p>
                    </div>
                )}
            </div>

            {/* Unit Selector Modal - Enhanced */}
            {showUnitSelector && selectedSlot && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-gradient-to-br from-neutral-900/95 to-neutral-950/95 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl shadow-blue-500/10 animate-in zoom-in-95 duration-300">
                        {/* Header with Gradient */}
                        <div className="relative p-8 border-b border-white/5 bg-gradient-to-r from-blue-500/5 to-purple-500/5 overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -ml-16 -mb-16" />

                            <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl border border-blue-500/30 shadow-lg shadow-blue-500/10">
                                        <Home size={24} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-300 uppercase tracking-tight">
                                            Asignar Unidad
                                        </h3>
                                        <p className="text-xs text-neutral-500 font-bold mt-1 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                            Plaza: {slots.find(s => s.id === selectedSlot)?.label}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setShowUnitSelector(false);
                                        setSelectedSlot(null);
                                    }}
                                    className="text-neutral-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                                >
                                    <X size={20} />
                                </Button>
                            </div>

                            {/* Search Bar */}
                            <div className="relative mt-6">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar por número o nombre..."
                                    value={searchUnit}
                                    onChange={(e) => setSearchUnit(e.target.value)}
                                    className="w-full h-12 pl-12 pr-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50 focus:bg-black/60 transition-all"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Units List with Scroll */}
                        <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-2">
                            {filteredUnits.length === 0 ? (
                                <div className="py-16 text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-neutral-800/50 rounded-2xl flex items-center justify-center">
                                        <Search size={24} className="text-neutral-600" />
                                    </div>
                                    <p className="text-neutral-500 text-sm font-bold">No se encontraron unidades</p>
                                    <p className="text-neutral-700 text-xs mt-1">Intenta con otro término de búsqueda</p>
                                </div>
                            ) : (
                                filteredUnits.map((unit: any, index) => {
                                    const plates = unit.users?.flatMap((u: any) =>
                                        u.credentials?.map((c: any) => c.value) || []
                                    ) || [];
                                    const userCount = unit.users?.length || 0;

                                    return (
                                        <button
                                            key={unit.id}
                                            onClick={() => linkSlotToUnit(selectedSlot, unit.id)}
                                            className="w-full p-4 bg-gradient-to-r from-neutral-800/50 to-neutral-800/30 hover:from-blue-500/10 hover:to-purple-500/10 border border-white/5 hover:border-blue-500/30 rounded-xl text-left transition-all group relative overflow-hidden animate-in slide-in-from-bottom-2 duration-300"
                                            style={{ animationDelay: `${index * 30}ms` }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-500" />
                                            <div className="relative space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                                                            <Home size={16} className="text-blue-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">{unit.number || unit.name}</p>
                                                            <p className="text-xs text-neutral-500 font-bold mt-0.5">{unit.name}</p>
                                                        </div>
                                                    </div>
                                                    <CheckCircle2 size={18} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-all scale-0 group-hover:scale-100" />
                                                </div>

                                                {/* Users and Plates Info */}
                                                {(userCount > 0 || plates.length > 0) && (
                                                    <div className="pl-13 space-y-1.5 pt-2 border-t border-white/5">
                                                        {userCount > 0 && (
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <UserIcon size={12} className="text-neutral-600" />
                                                                <span className="text-neutral-500 font-bold">
                                                                    {userCount} {userCount === 1 ? 'residente' : 'residentes'}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {plates.length > 0 && (
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Car size={12} className="text-neutral-600" />
                                                                <div className="flex flex-wrap gap-1">
                                                                    {plates.slice(0, 3).map((plate: string, i: number) => (
                                                                        <span key={i} className="px-1.5 py-0.5 bg-neutral-700/50 rounded text-[10px] font-mono text-neutral-400">
                                                                            {plate}
                                                                        </span>
                                                                    ))}
                                                                    {plates.length > 3 && (
                                                                        <span className="text-neutral-600 text-[10px] font-bold">
                                                                            +{plates.length - 3}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-white/5 bg-black/20 flex gap-3 rounded-b-3xl">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (selectedSlot) {
                                        linkSlotToUnit(selectedSlot, '');
                                    }
                                }}
                                className="flex-1 border-neutral-700 bg-neutral-800/50 text-neutral-300 hover:bg-neutral-700 hover:text-white h-11 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                            >
                                <XCircle size={16} className="mr-2" />
                                Desasignar
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => removeSlot(selectedSlot)}
                                className="border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 h-11 px-6 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                            >
                                <Trash2 size={16} className="mr-2" />
                                Eliminar Plaza
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(to bottom, #2563eb, #7c3aed);
                }
            `}</style>
        </div>
    );
}
