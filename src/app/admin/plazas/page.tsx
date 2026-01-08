"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    LayoutGrid,
    Upload,
    Plus,
    Trash2,
    Save,
    Pencil,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
    const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
    const [showUnitSelector, setShowUnitSelector] = useState(false);
    const [searchUnit, setSearchUnit] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const mapWrapperRef = useRef<HTMLDivElement>(null);

    // State for editing vertices
    const [editingVertex, setEditingVertex] = useState<{ slotId: string; pointIndex: number } | null>(null);

    const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

    // Resize Observer for responsive map
    useEffect(() => {
        if (!containerRef.current) return;

        const updateDimensions = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setContainerDimensions({ width, height });
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            updateDimensions();
        });

        resizeObserver.observe(containerRef.current);
        updateDimensions(); // Initial check

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        const loadData = async () => {
            const [slotsData, unitsData, mapUrl] = await Promise.all([
                getParkingSlots(),
                getUnitsWithDetails(),
                getParkingMap()
            ]);

            // Migrate old rectangle format to polygon format
            const migratedSlots = (slotsData as any[]).map(slot => {
                // Only migrate if it's TRULY old format: has x/width but NO points array
                if ((!slot.points || slot.points.length === 0) && slot.x !== undefined && slot.width !== undefined && slot.width > 0) {
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
                // Already in polygon format - use as is
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

            // Serialize slots to JSON string to preserve nested structure
            const slotsJson = JSON.stringify(slots);

            const result = await saveParkingSlots(slotsJson);
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

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!mapWrapperRef.current || !mapImage) return;
        if (e.button === 0) { // Left click
            const rect = mapWrapperRef.current.getBoundingClientRect();
            // Store as percentage (0-1) relative to the map wrapper
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;

            // Clamp to 0-1 range
            const clampedX = Math.max(0, Math.min(1, x));
            const clampedY = Math.max(0, Math.min(1, y));

            setCurrentPoints([...currentPoints, { x: clampedX, y: clampedY }]);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!editingVertex || !mapWrapperRef.current) return;

        const rect = mapWrapperRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        setSlots(slots.map(slot => {
            if (slot.id === editingVertex.slotId) {
                const newPoints = [...slot.points];
                newPoints[editingVertex.pointIndex] = { x, y };
                return { ...slot, points: newPoints };
            }
            return slot;
        }));
    };

    const handleMouseUp = () => {
        setEditingVertex(null);
    };

    const startEditingVertex = (slotId: string, pointIndex: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingVertex({ slotId, pointIndex });
    };

    const finishPolygon = () => {
        if (currentPoints.length >= 3) {
            const newSlot: ParkingSlot = {
                id: Math.random().toString(36).substr(2, 9),
                points: currentPoints,
                label: "P-" + (slots.length + 1),
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

    const updateSlotLabel = (slotId: string, newLabel: string) => {
        setSlots(slots.map(s => s.id === slotId ? { ...s, label: newLabel } : s));
    };

    const getPolygonPath = (points: { x: number; y: number }[]) => {
        if (!points || points.length === 0) return '';
        const { width, height } = containerDimensions;
        if (width === 0 || height === 0) return '';

        return points.map((p, i) => {
            // Check if point is percentage (<= 2.0 to be safe against small pixel values, usually safe assumption for maps > 2px)
            // Or just assume new points are %.
            // Legacy handling: if x > 1, treat as pixels.
            // But we actually want to migrate. For now, strict check:
            const px = p.x <= 2 ? p.x * width : p.x;
            const py = p.y <= 2 ? p.y * height : p.y;
            return (i === 0 ? 'M' : 'L') + ' ' + px + ' ' + py;
        }).join(' ') + ' Z';
    };

    const getPolygonCenter = (points: { x: number; y: number }[]) => {
        if (!points || points.length === 0) return { x: 0, y: 0 };
        const { width, height } = containerDimensions;

        const xs = points.map(p => p.x <= 2 ? p.x * width : p.x);
        const ys = points.map(p => p.y <= 2 ? p.y * height : p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            x: minX + (maxX - minX) / 2,
            y: minY + (maxY - minY) / 2
        };
    };
    const filteredUnits = units.filter(u => {
        const searchLower = searchUnit.toLowerCase();
        const name = (u.name || '').toLowerCase();
        const number = (u.number || '').toLowerCase();
        return name.includes(searchLower) || number.includes(searchLower);
    });

    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setImageDimensions({ width: naturalWidth, height: naturalHeight });
    };

    // Calculate wrapper dimensions to fit image within container while preserving aspect ratio
    const getWrapperStyle = () => {
        // Fallback to 100% if dimensions not ready yet
        if (!containerDimensions.width || !containerDimensions.height || !imageDimensions.width) {
            return {
                width: '100%',
                height: '100%',
                position: 'relative' as const,
            };
        }

        const containerRatio = containerDimensions.width / containerDimensions.height;
        const imageRatio = imageDimensions.width / imageDimensions.height;

        let finalWidth, finalHeight;

        if (containerRatio > imageRatio) {
            // Container is wider than image -> constrain by height
            finalHeight = containerDimensions.height;
            finalWidth = finalHeight * imageRatio;
        } else {
            // Container is taller than image -> constrain by width
            finalWidth = containerDimensions.width;
            finalHeight = finalWidth / imageRatio;
        }

        return {
            width: finalWidth,
            height: finalHeight,
            position: 'relative' as const,
        };
    };

    return (
        <div className="w-full h-full relative bg-[#0a0a0a] overflow-hidden animate-in fade-in duration-700 flex items-center justify-center">
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
                            onClick={() => { setMapImage(null); setSlots([]); setImageDimensions({ width: 0, height: 0 }); }}
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

            {/* Right Side Panel - Stats & List */}
            {mapImage && (
                <div className="absolute top-6 right-6 bottom-6 z-20 flex flex-col w-64 gap-4 pointer-events-none">
                    {/* Stats Card */}
                    <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-800 rounded-xl p-4 shadow-2xl pointer-events-auto shrink-0">
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

                    {/* Slots List */}
                    <div className="flex-1 bg-neutral-900/90 backdrop-blur-xl border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto min-h-0">
                        <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-0">
                                <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Square size={14} className="text-blue-400" />
                                    Lista de Plazas
                                </h4>
                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-neutral-400 font-mono">{slots.length}</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-black/20">
                            {slots.map(slot => {
                                const unit = units.find(u => u.id === slot.unitId);
                                const firstUser = unit?.users?.[0];

                                return (
                                    <button
                                        key={slot.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSlot(slot.id);
                                        }}
                                        onMouseEnter={() => setHoveredSlot(slot.id)}
                                        onMouseLeave={() => setHoveredSlot(null)}
                                        className={cn(
                                            "w-full text-left p-2.5 rounded-lg flex items-center justify-between transition-all group border",
                                            selectedSlot === slot.id
                                                ? "bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                                                : (hoveredSlot === slot.id ? "bg-white/10 border-white/20" : "border-transparent hover:bg-white/5 hover:border-white/5")
                                        )}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {/* User Avatar or Status Dot */}
                                            {slot.unitId && firstUser ? (
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg shadow-emerald-500/20">
                                                    {firstUser.name?.charAt(0) || 'U'}
                                                </div>
                                            ) : (
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full shrink-0 flex items-center justify-center",
                                                    slot.unitId ? "bg-emerald-500/20" : "bg-orange-500/20"
                                                )}>
                                                    <div className={cn(
                                                        "w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]",
                                                        slot.unitId ? "bg-emerald-500 text-emerald-500" : "bg-orange-500 text-orange-500"
                                                    )} />
                                                </div>
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <span className={cn(
                                                    "text-xs font-black uppercase tracking-wider truncate transition-colors",
                                                    selectedSlot === slot.id ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"
                                                )}>
                                                    {slot.label}
                                                </span>
                                                {unit && (
                                                    <span className="text-[9px] text-neutral-500 font-bold truncate">
                                                        {unit.number} {firstUser ? `• ${firstUser.name}` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {selectedSlot === slot.id && (
                                            <div
                                                className="h-6 w-6 flex items-center justify-center rounded-md text-blue-400 hover:text-white hover:bg-blue-500/20 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowUnitSelector(true);
                                                }}
                                                title="Editar"
                                            >
                                                <Pencil size={12} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Integrated Save Button */}
                        <div className="p-4 border-t border-white/5 bg-black/40">
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black h-10 rounded-lg shadow-lg shadow-blue-500/20 uppercase tracking-widest text-[10px]"
                            >
                                <Save size={14} className="mr-2" />
                                {isSaving ? "Guardando..." : "Guardar"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}



            {/* Map Canvas */}
            <div
                ref={containerRef}
                className="absolute inset-0 bg-transparent border-none overflow-hidden transition-all duration-300 flex items-center justify-center p-6"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            >
                {mapImage ? (
                    <div ref={mapWrapperRef} style={getWrapperStyle()}>
                        <img
                            src={mapImage}
                            alt="Parking Map"
                            className="w-full h-full object-contain grayscale opacity-50 invert"
                            onLoad={handleImageLoad}
                        />

                        <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                        >
                            <defs>
                                <pattern id="diagonalHatchOrange" patternUnits="userSpaceOnUse" width="2" height="2" patternTransform="rotate(45)">
                                    <rect width="2" height="2" fill="rgba(249, 115, 22, 0.1)" />
                                    <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" stroke="rgba(249, 115, 22, 0.8)" strokeWidth="0.5" />
                                </pattern>
                            </defs>

                            {/* Existing Polygons */}
                            {slots.filter(slot => slot.points && slot.points.length > 0).map((slot) => {
                                // Convert points to 0-100 scale for viewBox
                                const scaledPoints = slot.points.map(p => ({
                                    x: p.x <= 1 ? p.x * 100 : p.x,
                                    y: p.y <= 1 ? p.y * 100 : p.y
                                }));

                                const center = getPolygonCenter(slot.points); // Pass original 0-1 points logic or update helper
                                const textX = center.x <= 1 ? center.x * 100 : center.x;
                                const textY = center.y <= 1 ? center.y * 100 : center.y;

                                const unit = units.find(u => u.id === slot.unitId);
                                const isSelected = selectedSlot === slot.id;
                                const isHovered = hoveredSlot === slot.id;

                                return (
                                    <TooltipProvider key={slot.id}>
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <g
                                                    key={slot.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedSlot(slot.id);
                                                        setShowUnitSelector(true);
                                                    }}
                                                    onMouseEnter={() => setHoveredSlot(slot.id)}
                                                    onMouseLeave={() => setHoveredSlot(null)}
                                                    className="cursor-pointer group pointer-events-auto"
                                                >
                                                    <path
                                                        d={scaledPoints.map((p, i) => (i === 0 ? 'M' : 'L') + ' ' + p.x + ' ' + p.y).join(' ') + ' Z'}
                                                        fill={slot.unitId ? "rgba(16, 185, 129, 0.5)" : "url(#diagonalHatchOrange)"}
                                                        stroke={isSelected ? "#3b82f6" : (slot.unitId ? "#34d399" : "#f97316")}
                                                        strokeWidth={isSelected ? 1 : 0.5}
                                                        vectorEffect="non-scaling-stroke"
                                                        strokeLinejoin="round"
                                                        className="transition-all duration-300"
                                                        style={{
                                                            filter: isSelected ? "drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))" : "drop-shadow(0 0 2px rgba(0,0,0,0.5))",
                                                            animation: (isSelected || isHovered) ? "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite" : undefined
                                                        }}
                                                    />

                                                    {/* Vertex editing circles - only show when selected */}
                                                    {isSelected && scaledPoints.map((point, idx) => (
                                                        <circle
                                                            key={idx}
                                                            cx={point.x}
                                                            cy={point.y}
                                                            r="0.8"
                                                            fill="#3b82f6"
                                                            stroke="white"
                                                            strokeWidth="0.2"
                                                            vectorEffect="non-scaling-stroke"
                                                            className="cursor-move pointer-events-auto hover:fill-blue-300 transition-colors"
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                startEditingVertex(slot.id, idx, e);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    ))}

                                                    {/* Slot Label */}
                                                    <text
                                                        x={textX}
                                                        y={textY - (unit ? 2 : 0)}
                                                        fontSize="3"
                                                        className="font-black fill-white pointer-events-none select-none"
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                        style={{ textShadow: "0px 1px 3px rgba(0,0,0,0.9)" }}
                                                    >
                                                        {slot.label}
                                                    </text>

                                                    {/* Unit/User Info */}
                                                    {unit && (
                                                        <>
                                                            <text
                                                                x={textX}
                                                                y={textY + 2}
                                                                fontSize="2"
                                                                className="font-bold fill-emerald-300 pointer-events-none select-none"
                                                                textAnchor="middle"
                                                                dominantBaseline="middle"
                                                                style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.9)" }}
                                                            >
                                                                {unit.number || unit.name}
                                                            </text>
                                                            {unit.users?.[0] && (
                                                                <text
                                                                    x={textX}
                                                                    y={textY + 5}
                                                                    fontSize="1.8"
                                                                    className="font-medium fill-white/70 pointer-events-none select-none"
                                                                    textAnchor="middle"
                                                                    dominantBaseline="middle"
                                                                    style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.9)" }}
                                                                >
                                                                    {unit.users[0].name}
                                                                </text>
                                                            )}
                                                        </>
                                                    )}
                                                </g>
                                            </TooltipTrigger>

                                            {/* Tooltip Content remains same... */}
                                            <TooltipContent side="top" className="bg-black/90 border-neutral-800 p-0 overflow-hidden shadow-xl rounded-xl z-50">
                                                {/* ... same tooltip content ... */}
                                                {unit ? (
                                                    <div className="w-64">
                                                        <div className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 p-3 border-b border-white/5 flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                                                <Warehouse size={16} className="text-emerald-400" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-white uppercase">{unit.number || unit.name}</p>
                                                                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Ocupada</p>
                                                            </div>
                                                        </div>
                                                        <div className="p-3 space-y-3">
                                                            {(unit.users && unit.users.length > 0) ? (
                                                                <div className="space-y-2">
                                                                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                                                        <UserIcon size={10} /> Residentes
                                                                    </p>
                                                                    <div className="space-y-1">
                                                                        {unit.users.slice(0, 3).map((u: any, i: number) => (
                                                                            <div key={i} className="flex items-center gap-2 text-xs text-neutral-300">
                                                                                <div className="w-4 h-4 rounded-full bg-neutral-700 flex items-center justify-center text-[8px] font-bold">
                                                                                    {u.name.charAt(0)}
                                                                                </div>
                                                                                <span className="truncate">{u.name}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : <p className="text-xs text-neutral-500 italic">Sin residentes</p>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-2 text-xs font-bold text-neutral-400 flex items-center gap-2">
                                                        <Info size={14} /> Plaza Disponible
                                                    </div>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}

                            {/* Being Drawn Polygon */}
                            {currentPoints.length > 0 && (
                                <path
                                    d={currentPoints.map((p, i) => {
                                        const x = p.x <= 1 ? p.x * 100 : p.x;
                                        const y = p.y <= 1 ? p.y * 100 : p.y;
                                        return (i === 0 ? 'M' : 'L') + ' ' + x + ' ' + y;
                                    }).join(' ') + (isDrawing ? "" : " Z")}
                                    className="fill-blue-500/20 stroke-blue-500"
                                    strokeWidth="0.5"
                                    vectorEffect="non-scaling-stroke"
                                    strokeDasharray="1,1"
                                />
                            )}
                        </svg>
                    </div>
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
                                            Gestionar Plaza
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

                            {/* Controls */}
                            <div className="mt-6 space-y-4">
                                {/* Name Input */}
                                <div>
                                    <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1.5 block">Identificador</label>
                                    <input
                                        type="text"
                                        value={slots.find(s => s.id === selectedSlot)?.label || ''}
                                        onChange={(e) => updateSlotLabel(selectedSlot!, e.target.value)}
                                        className="w-full h-10 px-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-black uppercase tracking-widest"
                                    />
                                </div>

                                {/* Current Assignment - Show if assigned */}
                                {slots.find(s => s.id === selectedSlot)?.unitId && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                                    <Home size={16} className="text-emerald-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-emerald-300 font-bold">Asignado a:</p>
                                                    <p className="text-sm text-white font-black">
                                                        {units.find(u => u.id === slots.find(s => s.id === selectedSlot)?.unitId)?.number ||
                                                            units.find(u => u.id === slots.find(s => s.id === selectedSlot)?.unitId)?.name}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSlots(slots.map(s =>
                                                        s.id === selectedSlot ? { ...s, unitId: null } : s
                                                    ));
                                                }}
                                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 text-xs font-bold"
                                            >
                                                <Trash2 size={14} className="mr-1" />
                                                Desasignar
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Search Bar */}
                                <div>
                                    <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1.5 block">
                                        {slots.find(s => s.id === selectedSlot)?.unitId ? 'Cambiar Unidad / Lote' : 'Asignar Unidad / Lote'}
                                    </label>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por número o nombre..."
                                            value={searchUnit}
                                            onChange={(e) => setSearchUnit(e.target.value)}
                                            className="w-full h-10 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50 focus:bg-black/60 transition-all"
                                            autoFocus
                                        />
                                    </div>
                                </div>
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
                                            style={{ animationDelay: (index * 30) + "ms" }}
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
