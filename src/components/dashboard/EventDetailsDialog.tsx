
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
    AlertCircle,
    Activity,
    CreditCard,
    Key,
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getCarLogo } from "@/lib/car-logos";
import { getRelatedSessionEvents } from "@/app/actions/history";

interface EventDetailsDialogProps {
    event: any;
    children: React.ReactNode;
    timeStatus?: { label: string; value: string; color: string } | null;
}

export function EventDetailsDialog({ event, children, timeStatus }: EventDetailsDialogProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [editedUser, setEditedUser] = useState(event.user?.name || "");
    const [editedUnit, setEditedUnit] = useState(event.user?.unit?.name || "");
    const [isImageHovered, setIsImageHovered] = useState(false);
    const [showPlateActionModal, setShowPlateActionModal] = useState(false);
    const [plateHistory, setPlateHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [dateFilter, setDateFilter] = useState("");

    // Session / Sequence State
    const [sessionEvents, setSessionEvents] = useState<any[]>([]);
    const [loadingSession, setLoadingSession] = useState(false);

    const isGrant = event.decision === "GRANT";

    // Determine Type
    const isLPR = event.accessType === 'PLATE' || (!event.accessType && event.plateDetected && event.plateDetected !== 'unknown' && event.plateDetected !== 'NO_LEIDA');
    const accessType = event.accessType || (isLPR ? 'PLATE' : 'OTHER');

    const plateText = event.plateDetected?.toLowerCase() === 'unknown' || !event.plateDetected
        ? "SIN MATRICULA"
        : event.plateDetected;

    // Load data when modal opens
    useEffect(() => {
        if (!isOpen) return;

        // 1. Load Plate History if LPR
        if (isLPR && event.plateDetected && event.plateDetected !== 'unknown' && plateHistory.length === 0) {
            setLoadingHistory(true);
            fetch(`/api/events?plate=${event.plateDetected}&limit=10`)
                .then(res => res.json())
                .then(data => {
                    const history = (data.events || [])
                        .filter((e: any) => e.id !== event.id)
                        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    setPlateHistory(history);
                })
                .catch(err => console.error('Error loading plate history:', err))
                .finally(() => setLoadingHistory(false));
        }

        // 2. Load Session Sequence (Related events)
        setLoadingSession(true);
        getRelatedSessionEvents(event.id)
            .then(events => {
                setSessionEvents(events);
            })
            .catch(err => console.error("Error loading session:", err))
            .finally(() => setLoadingSession(false));

    }, [isOpen, event.id, event.plateDetected, isLPR, plateHistory.length]);

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
        if (path.startsWith('http') || path.startsWith('/api/files')) return path;
        return `/api/files/${path}`;
    };

    const meta = parseDetails(event.details);
    const logoUrl = isLPR ? getCarLogo(meta.Marca) : null;
    const eventImageUrl = getImageUrl(event.imagePath || event.snapshotPath || event.user?.cara);
    const userImageUrl = event.user?.cara ? getImageUrl(event.user.cara) : null;

    const dateObj = new Date(event.timestamp);
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = dateObj.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <Dialog onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="p-0 bg-neutral-950 border border-neutral-800 overflow-hidden rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.9)] w-[95vw] max-w-5xl" aria-describedby="event-description">
                <DialogTitle className="sr-only">Ficha de Evento de Acceso</DialogTitle>
                <p id="event-description" className="sr-only">Detalles del evento</p>


                <div className="flex flex-col lg:flex-row w-full bg-neutral-950 relative h-full max-h-[90vh]">

                    {/* FULLSCREEN IMAGE OVERLAY */}
                    {isImageHovered && (
                        <div
                            className="absolute inset-0 z-50 bg-black flex items-center justify-center p-8"
                            onMouseLeave={() => setIsImageHovered(false)}
                        >
                            <div className="relative w-full h-full flex items-center justify-center">
                                <div className="relative w-full" style={{ aspectRatio: isLPR ? '16/9' : 'auto', maxHeight: '100%' }}>
                                    <img src={eventImageUrl} alt="Vista" className={cn("w-full h-full object-contain", !isLPR && "max-w-[400px] mx-auto")} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LEFT: VISUAL EVIDENCE (Dynamic Width based on content) */}
                    <div className={cn("relative flex flex-col overflow-y-auto custom-scrollbar bg-neutral-900 border-r border-neutral-800", (isLPR || event.accessType === 'FACE') ? "w-full lg:w-[60%]" : "w-full lg:w-[45%]")}>

                        {/* Main Image Container */}
                        <div
                            className={cn(
                                "relative bg-black cursor-pointer group shrink-0 flex items-center justify-center overflow-hidden",
                                isLPR ? "w-full aspect-video" :
                                    event.accessType === 'FACE' ? "w-full h-[500px] lg:h-auto lg:flex-1" : // Face takes full available height
                                        "w-full p-8 aspect-square bg-neutral-950"
                            )}
                            onMouseEnter={() => setIsImageHovered(true)}
                        >
                            <img
                                src={eventImageUrl}
                                alt="Evidencia"
                                className={cn(
                                    "w-full h-full",
                                    (isLPR || event.accessType === 'FACE') ? "object-cover" : "object-contain max-h-[400px] max-w-[400px] rounded-lg shadow-2xl border border-neutral-800"
                                )}
                            />

                            {/* Overlay Gradient for readability */}
                            {(isLPR || event.accessType === 'FACE') && (
                                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />
                            )}

                            {/* FACE SPECIFIC OVERLAYS */}
                            {event.accessType === 'FACE' && (
                                <>
                                    {/* Name & List Info (Bottom Left) */}
                                    <div className="absolute bottom-8 left-8 z-30 max-w-[70%]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="px-2 py-0.5 rounded bg-white/20 backdrop-blur-md border border-white/20 text-[10px] font-bold text-white uppercase tracking-widest">
                                                Lista Permitida
                                            </div>
                                            {meta.Similitud && (
                                                <div className="px-2 py-0.5 rounded bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-[10px] font-bold text-emerald-300 uppercase tracking-widest">
                                                    {meta.Similitud}% Similitud
                                                </div>
                                            )}
                                        </div>
                                        <h1 className="text-4xl font-black text-white uppercase tracking-tight leading-none drop-shadow-xl">
                                            {event.user?.name || meta.Rostro || "Desconocido"}
                                        </h1>

                                        {/* Direction Pill (Modern) */}
                                        <div className="mt-4 inline-flex">
                                            <div className={cn(
                                                "flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl border shadow-lg transition-all",
                                                event.direction === 'ENTRY'
                                                    ? "bg-blue-600/40 border-blue-400/50 text-white hover:bg-blue-600/60"
                                                    : "bg-orange-600/40 border-orange-400/50 text-white hover:bg-orange-600/60"
                                            )}>
                                                {event.direction === 'ENTRY' ? <LogIn size={16} strokeWidth={3} /> : <LogOut size={16} strokeWidth={3} />}
                                                <span className="text-xs font-black uppercase tracking-widest">
                                                    {event.direction === 'ENTRY' ? 'Entrada' : 'Salida'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Face Crop (Bottom Right) */}
                                    {meta.FaceImage && (
                                        <div className="absolute bottom-8 right-8 z-40 w-32 h-32 rounded-xl overflow-hidden border-2 border-white/50 shadow-2xl bg-black transition-transform hover:scale-110 origin-bottom-right group-hover:border-white">
                                            <img
                                                src={getImageUrl(meta.FaceImage)}
                                                className="w-full h-full object-cover"
                                                alt="Rostro"
                                            />
                                        </div>
                                    )}
                                </>
                            )}


                            {/* STATUS BADGE (Top Right for Face/Non-LPR) */}
                            {!isLPR && (
                                <div className="absolute top-6 right-6 z-30">
                                    <div className={cn(
                                        "px-4 py-1.5 rounded-full shadow-2xl backdrop-blur-xl border flex items-center gap-2",
                                        isGrant ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-red-500/20 border-red-500/40 text-red-300"
                                    )}>
                                        {isGrant ? <ShieldCheck size={14} strokeWidth={2.5} /> : <AlertCircle size={14} strokeWidth={2.5} />}
                                        <span className="text-xs font-black uppercase tracking-wider leading-none">
                                            {isGrant ? "AUTORIZADO" : "DENEGADO"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* LPR Direction Badge (Existing Style preserved if needed, or unify?) 
                                Converting LPR to new simple pill style for consistency if LPR */
                            }
                            {/* Top Left Stack: Duration & Direction */}
                            {/* LPR Direction (Side, Solid, Loop) */}
                            {isLPR && (
                                <div className={cn(
                                    "absolute inset-x-12 top-1/2 -translate-y-1/2 z-10 flex pointer-events-none",
                                    event.direction === 'ENTRY' ? "justify-end" : "justify-start"
                                )}>
                                    <div className={cn(
                                        "flex flex-col items-center animate-pulse",
                                        event.direction === 'ENTRY' ? "text-blue-500" : "text-orange-500"
                                    )}>
                                        {event.direction === 'ENTRY' ? <LogIn size={50} strokeWidth={2} /> : <LogOut size={50} strokeWidth={2} />}
                                        <h1 className="text-2xl font-black uppercase tracking-tighter leading-none mt-2 drop-shadow-md">
                                            {event.direction === 'ENTRY' ? 'ENTRADA' : 'SALIDA'}
                                        </h1>
                                    </div>
                                </div>
                            )}

                            {/* Top Left Stack: Duration Only (Direction moved to center for LPR) */}
                            <div className="absolute top-6 left-6 z-20 flex flex-col items-start gap-2">
                                {timeStatus && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-sm bg-neutral-900/80 border-white/20 text-white animate-in zoom-in slide-in-from-left-2 shadow-xl">
                                        <Clock size={14} className={timeStatus.color} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                            <span className={timeStatus.color}>{timeStatus.label}</span> <span className="text-neutral-500 mx-1">•</span> {timeStatus.value}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* LPR Only: Plate Display */}
                            {isLPR && (() => {
                                const colorName = meta.Color?.toLowerCase() || '';
                                let bgStyle = '#171717'; // Default Neutral-900 like
                                let isLight = false;

                                // Color Mapping Logic
                                if (colorName.includes('blanc') || colorName.includes('white')) { bgStyle = '#ffffff'; isLight = true; }
                                else if (colorName.includes('plat') || colorName.includes('silver')) { bgStyle = '#d1d5db'; isLight = true; } // Gray-300
                                else if (colorName.includes('gris') || colorName.includes('gray')) { bgStyle = '#4b5563'; isLight = false; } // Gray-600
                                else if (colorName.includes('neg') || colorName.includes('black')) { bgStyle = '#000000'; isLight = false; }
                                else if (colorName.includes('roj') || colorName.includes('red')) { bgStyle = '#dc2626'; isLight = false; } // Red-600
                                else if (colorName.includes('azu') || colorName.includes('blue')) { bgStyle = '#2563eb'; isLight = false; } // Blue-600
                                else if (colorName.includes('amar') || colorName.includes('yellow')) { bgStyle = '#facc15'; isLight = true; } // Yellow-400
                                else if (colorName.includes('verd') || colorName.includes('green')) { bgStyle = '#16a34a'; isLight = false; } // Green-600
                                else if (colorName.includes('naran') || colorName.includes('orange')) { bgStyle = '#ea580c'; isLight = false; } // Orange-600

                                return (
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-stretch gap-2 origin-bottom">
                                        {/* 1. LOGO (White Box) - Smaller */}
                                        {logoUrl && (
                                            <div className="bg-white rounded-lg w-14 flex items-center justify-center shadow-2xl border border-white/50 shrink-0">
                                                <div className="relative w-8 h-8">
                                                    <img src={logoUrl} alt="Marca" className="w-full h-full object-contain" />
                                                </div>
                                            </div>
                                        )}

                                        {/* 2. PLATE (Vehicle Color) - Smaller */}
                                        <div
                                            className={cn(
                                                "px-4 py-1 rounded-lg shadow-2xl cursor-pointer transition-all hover:scale-105 group/plate flex flex-col justify-center border min-w-[100px]",
                                                isLight ? "text-black border-black/10" : "text-white border-white/20"
                                            )}
                                            style={{ backgroundColor: bgStyle }}
                                            onClick={(e) => { e.stopPropagation(); setShowPlateActionModal(true); }}
                                        >
                                            <p className={cn("text-[8px] font-bold uppercase tracking-widest leading-none mb-0.5 opacity-70")}>
                                                MATRÍCULA
                                            </p>
                                            <h3 className={cn("text-2xl font-black font-mono tracking-wider leading-none", plateText === 'SIN MATRICULA' && "text-red-500")}>
                                                {plateText}
                                            </h3>
                                        </div>

                                        {/* 3. STATUS (Right of Plate) - Smaller */}
                                        <div className={cn(
                                            "px-2 rounded-lg shadow-xl backdrop-blur-xl border flex flex-col items-center justify-center gap-0.5 min-w-[60px]",
                                            isGrant ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-red-500/20 border-red-500/40 text-red-300"
                                        )}>
                                            {isGrant ? <ShieldCheck size={16} strokeWidth={2.5} /> : <AlertCircle size={16} strokeWidth={2.5} />}
                                            <span className="text-[7px] font-black uppercase tracking-wider leading-none text-center">
                                                {isGrant ? "AUTORIZADO" : "DENEGADO"}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* CONTENT BELOW IMAGE */}
                        {isLPR ? (
                            /* LPR SPECIFIC CONTENT */
                            <>
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
                                <div className="border-t border-neutral-800 p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} className="text-neutral-500" />
                                            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Historial LPR</h3>
                                        </div>
                                        <button
                                            onClick={() => router.push(`/admin/history?q=${plateText}`)}
                                            className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors text-[10px] font-bold text-neutral-300 uppercase tracking-wider"
                                        >
                                            <FileText size={12} /> Reporte Instantáneo
                                        </button>
                                    </div>

                                    {loadingHistory ? <p className="text-xs text-neutral-600 text-center">Cargando...</p> : (
                                        <div className="space-y-2 max-h-[128px] overflow-y-auto custom-scrollbar">
                                            {plateHistory.slice(0, 3).map((hist: any) => (
                                                <div key={hist.id} className="flex items-center gap-3 p-2 bg-neutral-900/50 rounded-lg border border-neutral-800/50">
                                                    <div className="text-xs text-neutral-400 font-mono">{new Date(hist.timestamp).toLocaleTimeString()}</div>
                                                    <Badge variant={hist.decision === 'GRANT' ? 'default' : 'destructive'} className="text-[9px] h-5">{hist.decision}</Badge>
                                                    <div className="text-[10px] text-neutral-500">{hist.device?.name}</div>
                                                </div>
                                            ))}
                                            {plateHistory.length === 0 && <p className="text-xs text-neutral-600 text-center">Sin historial reciente</p>}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            /* NON-LPR SPECIFIC CONTENT (FACE / RFID / PIN) 
                               If FACE, this sits below the flex-1 image. 
                            */
                            <div className="p-4 bg-neutral-900 border-t border-neutral-800 shrink-0">
                                {/* Credential Info Block */}
                                <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 flex items-center gap-4">
                                    <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 shrink-0">
                                        {accessType === 'FACE' || event.accessType === 'FACE' ? <UserIcon size={24} className="text-blue-400" /> :
                                            accessType === 'TAG' ? <CreditCard size={24} className="text-purple-400" /> :
                                                accessType === 'PIN' ? <Hash size={24} className="text-orange-400" /> :
                                                    <ShieldCheck size={24} className="text-emerald-400" />}
                                    </div>
                                    <div>
                                        <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-1">
                                            Credencial Utilizada
                                        </h3>
                                        <p className="text-sm font-black text-white uppercase tracking-tight">
                                            {accessType === 'FACE' || event.accessType === 'FACE' ? 'Reconocimiento Facial' :
                                                accessType === 'TAG' ? 'Tarjeta RFID / Tag' :
                                                    accessType === 'PIN' ? 'Código PIN' : 'Acceso Estándar'}
                                        </p>
                                        <p className="text-xs text-neutral-500 font-mono mt-0.5 break-all">
                                            {event.credentialId ? `Ref: ${event.credentialId}` : 'ID de Acceso Seguro'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}


                    </div>

                    {/* RIGHT: IDENTITY & DATA (Dynamic Width) */}
                    <div className={cn("bg-neutral-950 flex flex-col overflow-y-auto custom-scrollbar border-l border-neutral-800", (isLPR || event.accessType === 'FACE') ? "w-full lg:w-[40%]" : "w-full lg:w-[55%]")}>
                        {/* Header */}
                        <div className="bg-neutral-900 border-b border-neutral-800 p-4 shrink-0">
                            <h2 className="text-base font-black text-white uppercase tracking-tight mb-0.5">Información del Evento</h2>
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Sistema de Control de Acceso</p>
                        </div>

                        {/* User Profile */}
                        <div className="p-6 border-b border-neutral-800 shrink-0">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <UserIcon size={12} className="text-neutral-500" />
                                    <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Sujeto Identificado</h3>
                                </div>
                                {event.user && (
                                    <button onClick={() => setIsEditing(!isEditing)} className={cn("p-2 rounded-lg transition-colors", isEditing ? "text-emerald-400 bg-emerald-500/10" : "text-neutral-400 bg-neutral-800")}>
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
                                                <div className="w-full h-full flex items-center justify-center"><UserIcon size={32} className="text-neutral-600" /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <div className="space-y-2">
                                                    <input value={editedUser} onChange={(e) => setEditedUser(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white" placeholder="Nombre" />
                                                    <input value={editedUnit} onChange={(e) => setEditedUnit(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-blue-400" placeholder="Unidad" />
                                                </div>
                                            ) : (
                                                <>
                                                    <h4 className="text-lg font-black text-white uppercase truncate">{editedUser || event.user.name}</h4>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Building2 size={12} className="text-blue-400" />
                                                        <p className="text-sm font-bold text-blue-400 uppercase truncate">{editedUnit || event.user.unit?.name || 'Sin Unidad'}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]">VERIFICADO</Badge>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-neutral-900 rounded-xl p-8 border border-dashed border-neutral-800 text-center">
                                    <UserIcon size={40} className="text-neutral-700 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-neutral-600 uppercase">Desconocido</p>
                                </div>
                            )}
                        </div>

                        {/* Details List */}
                        <div className="p-5 flex-1 space-y-4">
                            <div className="flex items-start gap-3">
                                <Calendar size={16} className="text-neutral-500 mt-1" />
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-600 uppercase mb-1">Fecha</p>
                                    <p className="text-base font-black text-white font-mono">{dateStr} {timeStr}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <MapPin size={16} className="text-neutral-500 mt-1" />
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-600 uppercase mb-1">Dispositivo</p>
                                    <p className="text-sm font-black text-white uppercase">{event.device?.name || '---'}</p>
                                    <p className="text-xs text-neutral-500 mt-1">{event.device?.location || '---'}</p>
                                </div>
                            </div>

                            {/* DYNAMIC EXTRA DETAILS (e.g. Call Destination) */}
                            {Object.entries(meta).map(([key, value]) => {
                                if (['Marca', 'Color', 'Tipo', 'Modelo', 'FaceImage'].includes(key)) return null;
                                return (
                                    <div key={key} className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2">
                                        <AlertCircle size={16} className="text-indigo-500 mt-1" />
                                        <div>
                                            <p className="text-[10px] font-bold text-neutral-600 uppercase mb-1">{key}</p>
                                            <p className="text-sm font-black text-white">{value as string}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="bg-neutral-900 border-t border-neutral-800 p-4 text-center shrink-0">
                            <p className="text-[9px] font-black text-neutral-700 uppercase tracking-widest">LPR SecureAccess v3.0</p>
                        </div>
                    </div>
                </div>

                {/* Plate Action Modal */}
                {showPlateActionModal && (
                    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowPlateActionModal(false)}>
                        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-8 max-w-md w-[90vw]" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-xl font-black text-white uppercase mb-4">Acciones para {plateText}</h3>
                            <button className="w-full p-4 bg-neutral-800 hover:bg-neutral-700 rounded text-center text-white font-bold" onClick={() => setShowPlateActionModal(false)}>Cerrar</button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
