import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    Clock,
    User as UserIcon,
    LogIn,
    LogOut,
    Car,
    MapPin,
    ShieldCheck,
    ShieldAlert,
    Calendar,
    Building2,
    Hash,
    Fingerprint,
    Edit2,
    Save,
    X as XIcon,
    AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { getCarLogo } from "@/lib/car-logos";

interface EventDetailsDialogProps {
    event: any;
    children: React.ReactNode;
}

export function EventDetailsDialog({ event, children }: EventDetailsDialogProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedUser, setEditedUser] = useState(event.user?.name || "");
    const [editedUnit, setEditedUnit] = useState(event.user?.unit?.name || "");
    const [isImageHovered, setIsImageHovered] = useState(false);
    const [showPlateActionModal, setShowPlateActionModal] = useState(false);
    const [plateHistory, setPlateHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [dateFilter, setDateFilter] = useState("");

    // Load plate history ONLY when modal opens
    useEffect(() => {
        if (isOpen && event.plateDetected && event.plateDetected !== 'unknown' && plateHistory.length === 0) {
            setLoadingHistory(true);
            fetch(`/api/events?plate=${event.plateDetected}&limit=10`)
                .then(res => res.json())
                .then(data => {
                    // Filter out current event and sort by date
                    const history = (data.events || [])
                        .filter((e: any) => e.id !== event.id)
                        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    setPlateHistory(history);
                })
                .catch(err => console.error('Error loading plate history:', err))
                .finally(() => setLoadingHistory(false));
        }
    }, [isOpen, event.plateDetected, event.id, plateHistory.length]);

    const isGrant = event.decision === "GRANT";
    const plateText = event.plateDetected?.toLowerCase() === 'unknown' || !event.plateDetected
        ? "SIN MATRICULA"
        : event.plateDetected;

    // Helper to parse details
    const parseDetails = (details: string | null) => {
        if (!details) return {};
        const parts = details.split(',').map(p => p.trim());
        const data: any = {};
        parts.forEach(p => {
            const [k, v] = p.split(':').map(s => s.trim());
            if (k && v) data[k] = v;
        });
        return data;
    };

    // Helper to get proper image URL from MinIO
    const getImageUrl = (path: string | null | undefined): string => {
        if (!path) return "/placeholder-camera.jpg";
        // If it's already a full URL or starts with /api/files, use it as is
        if (path.startsWith('http') || path.startsWith('/api/files')) return path;
        // Otherwise, it's a MinIO path that needs to be proxied
        return `/api/files/${path}`;
    };

    const meta = parseDetails(event.details);
    const logoUrl = getCarLogo(meta.Marca);

    // Get the proper image URL
    const eventImageUrl = getImageUrl(event.imagePath || event.snapshotPath || event.user?.cara);
    const userImageUrl = event.user?.cara ? getImageUrl(event.user.cara) : null;

    // Format timestamp
    const dateObj = new Date(event.timestamp);
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = dateObj.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <Dialog onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="p-0 bg-neutral-950 border border-neutral-800 overflow-hidden rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.9)]" aria-describedby="event-description">
                <DialogTitle className="sr-only">Ficha de Evento de Acceso</DialogTitle>
                <p id="event-description" className="sr-only">
                    Detalles completos del evento de acceso incluyendo imagen de captura, información del residente y datos del vehículo
                </p>

                <div className="flex flex-col lg:flex-row w-full bg-neutral-950 relative">

                    {/* FULLSCREEN IMAGE OVERLAY - On Hover */}
                    {isImageHovered && (
                        <div
                            className="absolute inset-0 z-50 bg-black flex items-center justify-center p-8"
                            onMouseLeave={() => setIsImageHovered(false)}
                        >
                            <div className="relative w-full h-full flex items-center justify-center">
                                <div className="relative w-full" style={{ aspectRatio: '16/9', maxHeight: '100%' }}>
                                    <img
                                        src={eventImageUrl}
                                        alt="Vista Completa"
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LEFT: VISUAL EVIDENCE AREA (60%) */}
                    <div
                        className="relative w-full lg:w-[60%] bg-neutral-900 border-r border-neutral-800"
                    >

                        {/* Main Image Container - Using standard img tag */}
                        <div
                            className="relative w-full h-[360px] bg-black cursor-pointer group"
                            onMouseEnter={() => setIsImageHovered(true)}
                        >
                            <img
                                src={eventImageUrl}
                                alt="Evidencia Visual"
                                className="w-full h-full object-cover"
                            />

                            {/* Dark gradient overlay for better text visibility */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/60 pointer-events-none" />

                            {/* STATUS BADGE - Centered Vertically and Horizontally */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                                <div className={cn(
                                    "px-5 py-2 rounded-lg shadow-xl backdrop-blur-2xl border flex items-center gap-2",
                                    isGrant
                                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                                        : "bg-red-500/20 border-red-500/40 text-red-300"
                                )}>
                                    {isGrant ? <ShieldCheck size={16} strokeWidth={2.5} /> : <AlertCircle size={16} strokeWidth={2.5} />}
                                    <span className="text-sm font-black uppercase tracking-wider leading-none">
                                        {isGrant ? "AUTORIZADO" : "DENEGADO"}
                                    </span>
                                </div>
                            </div>

                            {/* Direction Badge - Bottom Right */}
                            <div className="absolute bottom-6 right-6 z-20">
                                <div className={cn(
                                    "flex items-center gap-3 px-6 py-3 rounded-xl backdrop-blur-xl border-2 shadow-xl",
                                    event.direction === 'ENTRY'
                                        ? "bg-blue-600/90 border-blue-400 text-white"
                                        : "bg-orange-600/90 border-orange-400 text-white"
                                )}>
                                    {event.direction === 'ENTRY' ? <LogIn size={24} strokeWidth={2.5} /> : <LogOut size={24} strokeWidth={2.5} />}
                                    <span className="text-lg font-black uppercase tracking-widest">
                                        {event.direction === 'ENTRY' ? 'ENTRADA' : 'SALIDA'}
                                    </span>
                                </div>
                            </div>

                            {/* Plate Display - Bottom Left - CLICKABLE */}
                            <div className="absolute bottom-4 left-4 z-20">
                                <div
                                    className="bg-neutral-950/95 backdrop-blur-xl border-2 border-neutral-700 px-4 py-2 rounded-xl shadow-2xl cursor-pointer hover:border-blue-500 hover:bg-neutral-900/95 transition-all group/plate"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowPlateActionModal(true);
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        {logoUrl && (
                                            <div className="relative w-8 h-8">
                                                <img src={logoUrl} alt="Marca" className="w-full h-full object-contain filter brightness-0 invert opacity-60" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none mb-1">
                                                MATRÍCULA DETECTADA
                                            </p>
                                            <h3 className={cn(
                                                "text-3xl font-black font-mono tracking-wider text-white",
                                                plateText === 'SIN MATRICULA' && "text-red-500 text-xl"
                                            )}>
                                                {plateText}
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Vehicle Metadata Bar */}
                        <div className="bg-neutral-900 border-t border-neutral-800 p-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="flex items-center gap-2">
                                    <Car size={16} className="text-neutral-500" />
                                    <div>
                                        <p className="text-[9px] font-bold text-neutral-600 uppercase">Marca</p>
                                        <p className="text-sm font-black text-white uppercase">{meta.Marca || '---'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full border-2 border-neutral-700"
                                        style={{ backgroundColor: meta.Color?.toLowerCase() === 'blanco' ? '#fff' : meta.Color?.toLowerCase() === 'negro' ? '#000' : meta.Color || '#444' }} />
                                    <div>
                                        <p className="text-[9px] font-bold text-neutral-600 uppercase">Color</p>
                                        <p className="text-sm font-black text-white uppercase">{meta.Color || '---'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Hash size={16} className="text-neutral-500" />
                                    <div>
                                        <p className="text-[9px] font-bold text-neutral-600 uppercase">Tipo</p>
                                        <p className="text-sm font-black text-white uppercase">{meta.Tipo || 'Vehículo'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Plate History Timeline */}
                        {event.accessType === 'PLATE' && plateText !== 'SIN MATRICULA' && (
                            <div className="border-t border-neutral-800">
                                <div className="p-4 pb-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-neutral-500" />
                                                <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                                                    Historial
                                                </h3>
                                            </div>
                                            <input
                                                type="date"
                                                className="bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 px-2 py-0.5 rounded outline-none focus:border-indigo-500 transition-colors"
                                                value={dateFilter}
                                                onChange={(e) => setDateFilter(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {plateHistory.length > 3 && (
                                                <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[9px] font-black uppercase">
                                                    Recurrente
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {loadingHistory ? (
                                        <div className="text-center py-4">
                                            <p className="text-xs text-neutral-600">Cargando historial...</p>
                                        </div>
                                    ) : plateHistory.length === 0 ? (
                                        <div className="text-center py-4">
                                            <p className="text-xs text-neutral-600">Primera detección de esta matrícula</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[128px] overflow-y-auto pr-2 custom-scrollbar">
                                            {plateHistory
                                                .filter(hist => {
                                                    if (!dateFilter) return true;
                                                    const histDate = new Date(hist.timestamp).toISOString().split('T')[0];
                                                    return histDate === dateFilter;
                                                })
                                                .slice(0, 2).map((hist: any, idx: number) => {
                                                    const histDate = new Date(hist.timestamp);
                                                    const histTimeStr = histDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    const histDateStr = histDate.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
                                                    const histImageUrl = getImageUrl(hist.snapshotPath || hist.imagePath);

                                                    return (
                                                        <div key={hist.id} className="flex items-center gap-3 p-2 bg-neutral-900/50 rounded-lg border border-neutral-800/50 hover:border-neutral-700 transition-colors">
                                                            {/* Thumbnail */}
                                                            <div className="relative w-16 h-12 rounded overflow-hidden border border-neutral-700 shrink-0 bg-neutral-950">
                                                                <img
                                                                    src={histImageUrl}
                                                                    alt="Evento"
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        e.currentTarget.src = "/placeholder-camera.jpg";
                                                                    }}
                                                                />
                                                            </div>

                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-xs font-black text-white font-mono">
                                                                        {histDateStr} • {histTimeStr}
                                                                    </p>
                                                                    <Badge className={cn(
                                                                        "text-[8px] font-black px-1.5 py-0",
                                                                        hist.decision === "GRANT"
                                                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                            : "bg-red-500/10 text-red-400 border-red-500/20"
                                                                    )}>
                                                                        {hist.decision === "GRANT" ? "✓" : "✗"}
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-[10px] text-neutral-500 font-bold mt-0.5">
                                                                    {hist.device?.name || 'Cámara LPR'} • {hist.direction === 'ENTRY' ? 'Entrada' : 'Salida'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: IDENTITY & DATA PANEL (40%) */}
                    <div className="w-full lg:w-[40%] bg-neutral-950 flex flex-col">

                        {/* Header Section */}
                        <div className="bg-neutral-900 border-b border-neutral-800 p-4">
                            <h2 className="text-base font-black text-white uppercase tracking-tight mb-0.5">
                                Información del Evento
                            </h2>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                                Sistema de Control de Acceso
                            </p>
                        </div>

                        {/* User Profile Section - EDITABLE */}
                        <div className="p-6 border-b border-neutral-800">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <UserIcon size={12} className="text-neutral-500" />
                                    <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                                        Residente / Propietario
                                    </h3>
                                </div>
                                {event.user && (
                                    <button
                                        onClick={() => {
                                            if (isEditing) {
                                                // TODO: Save changes to database
                                                console.log('Saving:', { name: editedUser, unit: editedUnit });
                                            }
                                            setIsEditing(!isEditing);
                                        }}
                                        className={cn(
                                            "p-2 rounded-lg transition-colors",
                                            isEditing ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                                        )}
                                    >
                                        {isEditing ? <Save size={14} /> : <Edit2 size={14} />}
                                    </button>
                                )}
                            </div>

                            {event.user ? (
                                <div className="bg-neutral-900 rounded-xl p-5 border border-neutral-800">
                                    <div className="flex items-start gap-4">
                                        <div className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-neutral-700 bg-neutral-800 shrink-0">
                                            {userImageUrl ? (
                                                <img src={userImageUrl} alt="Usuario" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <UserIcon size={32} className="text-neutral-600" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <div className="space-y-3">
                                                    <input
                                                        type="text"
                                                        value={editedUser}
                                                        onChange={(e) => setEditedUser(e.target.value)}
                                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white font-bold uppercase text-sm focus:outline-none focus:border-blue-500"
                                                        placeholder="Nombre del residente"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={editedUnit}
                                                        onChange={(e) => setEditedUnit(e.target.value)}
                                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-blue-400 font-bold uppercase text-sm focus:outline-none focus:border-blue-500"
                                                        placeholder="Unidad"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <h4 className="text-xl font-black text-white uppercase tracking-tight truncate mb-2">
                                                        {editedUser || event.user.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Building2 size={12} className="text-blue-400 shrink-0" />
                                                        <p className="text-sm font-bold text-blue-400 uppercase tracking-wide truncate">
                                                            {editedUnit || event.user.unit?.name || 'Sin Unidad'}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-black">
                                                            VERIFICADO
                                                        </Badge>
                                                        <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] font-black">
                                                            RESIDENTE
                                                        </Badge>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-neutral-900 rounded-xl p-8 border border-dashed border-neutral-800 text-center">
                                    <UserIcon size={40} className="text-neutral-700 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-neutral-600 uppercase tracking-wider">
                                        Usuario No Identificado
                                    </p>
                                    <p className="text-xs text-neutral-700 mt-1">
                                        Sin registro en el sistema
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Event Details Section */}
                        <div className="p-5 flex-1">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Calendar size={16} className="text-neutral-500 mt-1 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">
                                            Fecha y Hora
                                        </p>
                                        <p className="text-base font-black text-white font-mono">
                                            {dateStr}
                                        </p>
                                        <p className="text-base font-black text-white font-mono mt-0.5">
                                            {timeStr}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <MapPin size={16} className="text-neutral-500 mt-1 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">
                                            Punto de Acceso
                                        </p>
                                        <p className="text-sm font-black text-white uppercase">
                                            {event.device?.name || 'Dispositivo LPR'}
                                        </p>
                                        <p className="text-xs text-neutral-500 font-bold mt-1">
                                            {event.device?.location || 'Ubicación no especificada'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Fingerprint size={16} className="text-neutral-500 mt-1 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-1">
                                            ID de Evento
                                        </p>
                                        <p className="text-xs font-mono text-neutral-400">
                                            {event.id}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-neutral-900 border-t border-neutral-800 p-4">
                            <p className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.2em] text-center">
                                Sistema LPR SecureAccess v3.0
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>

            {/* PLATE ACTION MODAL */}
            {showPlateActionModal && (
                <div
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center"
                    onClick={() => setShowPlateActionModal(false)}
                >
                    <div
                        className="bg-neutral-900 border border-neutral-700 rounded-xl p-8 max-w-md w-[90vw] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
                            Acción sobre Matrícula
                        </h3>
                        <p className="text-sm text-neutral-400 mb-6">
                            ¿Qué deseas hacer con la matrícula <span className="font-mono font-black text-white">{plateText}</span>?
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    // TODO: Implement add to whitelist
                                    console.log('Add to whitelist:', plateText);
                                    setShowPlateActionModal(false);
                                }}
                                className="w-full flex items-center gap-3 px-6 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg transition-all group"
                            >
                                <ShieldCheck size={20} className="text-emerald-400" />
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-black text-emerald-400 uppercase">Agregar a Lista Blanca</p>
                                    <p className="text-xs text-emerald-400/60">Permitir acceso automático</p>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    // TODO: Implement block
                                    console.log('Block plate:', plateText);
                                    setShowPlateActionModal(false);
                                }}
                                className="w-full flex items-center gap-3 px-6 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-all group"
                            >
                                <ShieldAlert size={20} className="text-red-400" />
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-black text-red-400 uppercase">Bloquear Matrícula</p>
                                    <p className="text-xs text-red-400/60">Denegar acceso permanente</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setShowPlateActionModal(false)}
                                className="w-full px-6 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-all text-sm font-bold text-neutral-400 uppercase"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Dialog>
    );
}
