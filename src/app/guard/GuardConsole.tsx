"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Camera,
    Loader2,
    LogIn,
    LogOut,
    RefreshCcw,
    Trash2,
    User as UserIcon,
    Shield,
    Clock,
    Activity,
    ChevronRight,
    Search,
    History as HistoryIcon,
    FileText,
    Bell,
    Settings,
    CameraOff,
    CheckCircle2,
    X,
    Image as ImageIcon,
    MapPin,
    Mic,
    Square,
    Play,
    Volume2,
    Building2,
    UserCheck,
    Briefcase,
    Home,
    Plus,
    Flame,
    Siren,
    Landmark,
    Delete
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createBitacoraEntry, deleteBitacoraEntry } from "@/app/actions/bitacora";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface GuardConsoleProps {
    initialEntries: any[];
    logo: string;
    units: any[];
}

type TabType = "control" | "history" | "alerts" | "devices";

export default function GuardConsole({ initialEntries, logo, units }: GuardConsoleProps) {
    const [activeTab, setActiveTab] = useState<TabType>("control");
    const [entries, setEntries] = useState(initialEntries);
    const [type, setType] = useState<"ENTRY" | "EXIT">("ENTRY");
    const [plate, setPlate] = useState("");
    const [notes, setNotes] = useState("");
    const [name, setName] = useState("");
    const [dni, setDni] = useState("");
    const [matchingEntry, setMatchingEntry] = useState<any>(null);
    const [showMatchPrompt, setShowMatchPrompt] = useState(false);
    const [originType, setOriginType] = useState<"PARTICULAR" | "EMPRESA" | "IMM" | "POLICIA" | "BOMBEROS" | "AMBULANCIA">("PARTICULAR");
    const [company, setCompany] = useState("");
    const [guardName, setGuardName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Unit Selection States
    const [unitSearch, setUnitSearch] = useState("");
    const [showUnitResults, setShowUnitResults] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState<any>(null);

    // Audio States
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const hiddenInputRef = useRef<HTMLInputElement>(null);

    const handleTabChange = (tab: TabType) => {
        if (tab === activeTab) return;
        setIsTransitioning(true);
        setTimeout(() => {
            setActiveTab(tab);
            setTimeout(() => {
                setIsTransitioning(false);
            }, 600);
        }, 400);
    };

    // Filtered Units
    const filteredUnits = units.filter(u =>
        u.name.toLowerCase().includes(unitSearch.toLowerCase()) ||
        (u.number && u.number.toLowerCase().includes(unitSearch.toLowerCase()))
    ).slice(0, 5);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Geolocation
    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.error("Geolocation error:", error);
                }
            );
        }
    }, []);

    // Load guard name
    useEffect(() => {
        const savedGuard = localStorage.getItem("bitacora_guard_name");
        if (savedGuard) setGuardName(savedGuard);
    }, []);

    const saveGuardName = (val: string) => {
        setGuardName(val);
        localStorage.setItem("bitacora_guard_name", val);
    };

    // TACTILE SOUND UTILITY
    const playTactileSound = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) { }
    };

    // PLATE MATCH DETECTION
    useEffect(() => {
        if (plate.length >= 6) {
            const match = entries.find(e => e.plate?.toUpperCase() === plate.toUpperCase());
            if (match && !showMatchPrompt && (name !== match.name || dni !== match.dni)) {
                setMatchingEntry(match);
                setShowMatchPrompt(true);
            }
        } else {
            setShowMatchPrompt(false);
        }
    }, [plate, entries]);

    const handleAutocomplete = () => {
        if (matchingEntry) {
            setName(matchingEntry.name || "");
            setDni(matchingEntry.dni || "");
            if (matchingEntry.company) {
                if (["PARTICULAR", "IMM", "POLICIA", "BOMBEROS", "AMBULANCIA"].includes(matchingEntry.company)) {
                    setOriginType(matchingEntry.company);
                } else {
                    setOriginType("EMPRESA");
                    setCompany(matchingEntry.company);
                }
            }
            // Try to find matching unit
            const unitMatch = units.find(u =>
                (u.name + (u.number ? ` (${u.number})` : "")) === matchingEntry.destination
            );
            if (unitMatch) setSelectedUnit(unitMatch);

            setShowMatchPrompt(false);
            toast.success("Datos autocompletados");
            playTactileSound();
        }
    };

    // Camera Lifecycle
    useEffect(() => {
        async function startCamera() {
            if (!isCameraActive) return;

            // CHECK SECURE CONTEXT
            if (!window.isSecureContext) {
                toast.error("⚠️ NAVEGADOR BLOQUEA CÁMARA: Se requiere HTTPS o habilitar 'Insecure Origin' en Chrome Flags.", {
                    duration: 10000,
                    description: "Vaya a chrome://flags/#unsafely-treat-insecure-origin-as-secure y añada esta IP."
                });
                // Allow them to continue but warn
                setIsCameraActive(false);
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" },
                    audio: false
                });
                streamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err: any) {
                console.error("Camera error:", err);
                const msg = err.name === "NotAllowedError" ? "Permiso de cámara denegado" : "Error de hardware o acceso a cámara";
                toast.error(msg);
                setIsCameraActive(false);
            }
        }

        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, [isCameraActive]);

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext("2d");
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);
                const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.85);
                setCapturedPhoto(dataUrl);
                setIsCameraActive(false);
            }
        }
    };

    // Audio recording functions
    const startRecording = async () => {
        if (!window.isSecureContext) {
            toast.error("⚠️ Microsfono Bloqueado por HTTP", {
                description: "Use HTTPS para habilitar hardware de grabación."
            });
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err: any) {
            console.error("Mic error:", err);
            const msg = err.name === "NotAllowedError" ? "Permiso de micrófono denegado" : "Error al acceder al micrófono";
            toast.error(msg);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleSubmit = async () => {
        if (!capturedPhoto && window.isSecureContext) { toast.error("Se requiere fotografía"); return; }
        if (!capturedPhoto && !window.isSecureContext) {
            const proceed = confirm("⚠️ Sin Foto: El navegador bloquea la cámara por no ser HTTPS. ¿Desea registrar sin foto?");
            if (!proceed) return;
        }
        if (!guardName) { toast.error("Ingrese su nombre de guardia"); return; }
        if (!selectedUnit) { toast.error("Debe seleccionar una unidad de destino"); return; }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("type", type);
            formData.append("plate", plate.trim());
            formData.append("notes", notes.trim());
            formData.append("name", name.trim());
            formData.append("dni", dni.trim());
            formData.append("company", originType === "EMPRESA" ? company.trim() : originType);
            formData.append("destination", selectedUnit.name + (selectedUnit.number ? ` (${selectedUnit.number})` : ""));
            formData.append("guardName", guardName.trim());

            if (location) {
                formData.append("latitude", location.lat.toString());
                formData.append("longitude", location.lng.toString());
            }

            if (capturedPhoto) {
                const res = await fetch(capturedPhoto);
                const blob = await res.blob();
                formData.append("photo", blob, "capture.jpg");
            }

            if (audioBlob) {
                formData.append("audio", audioBlob, "note.webm");
            }

            const newEntry = await createBitacoraEntry(formData);

            setShowSuccessOverlay(true);
            setTimeout(() => {
                setEntries(prev => [newEntry as any, ...prev]);
                setPlate(""); setNotes(""); setName(""); setDni(""); setCompany("");
                setSelectedUnit(null); setUnitSearch("");
                setCapturedPhoto(null);
                setAudioBlob(null);
                setAudioUrl(null);
                setShowSuccessOverlay(false);
            }, 1500);

            toast.success("Registro completado exitosamente");
        } catch (err) {
            console.error("Submit error:", err);
            toast.error("Error al guardar el registro");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Está seguro de eliminar este registro?")) {
            try {
                await deleteBitacoraEntry(id);
                setEntries(prev => prev.filter((e: any) => e.id !== id));
                toast.success("Registro eliminado");
            } catch (error) {
                toast.error("Error al eliminar");
            }
        }
    };

    return (
        <div className="h-screen w-screen bg-[#0a0a0b] text-white flex overflow-hidden font-sans select-none">

            {/* LOGO TRANSITION LOADER */}
            <AnimatePresence>
                {isTransitioning && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] bg-[#0a0a0b] flex flex-col items-center justify-center"
                    >
                        <motion.div
                            animate={{
                                opacity: [0.4, 1, 0.4],
                                scale: [0.95, 1.05, 0.95],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="w-40 h-40 flex items-center justify-center p-6 mb-4"
                        >
                            <Image src={logo} alt="Loading" width={120} height={120} className="object-contain" />
                        </motion.div>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-8 text-[11px] font-black uppercase tracking-[0.4em] text-[#B20D30]"
                        >
                            Cargando {activeTab === "control" ? "Consola" : activeTab === "history" ? "Historial" : "Alertas"}...
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* SUCCESS OVERLAY ANIMATION */}
            <AnimatePresence>
                {showSuccessOverlay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-[#B20D30] flex flex-col items-center justify-center text-white"
                    >
                        <motion.div
                            initial={{ scale: 0.5, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="w-32 h-32 rounded-full border-[6px] border-white flex items-center justify-center mb-6"
                        >
                            <CheckCircle2 size={64} strokeWidth={3} />
                        </motion.div>
                        <motion.h2
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-4xl font-black uppercase tracking-tighter"
                        >
                            Registro Exitoso
                        </motion.h2>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AUTOCOMPLETE PROMPT MODAL */}
            <AnimatePresence>
                {showMatchPrompt && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed inset-0 z-[150] flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                            onClick={() => setShowMatchPrompt(false)}
                        />

                        <div className="bg-[#121214] border-2 border-[#B20D30] rounded-3xl p-8 shadow-[0_30px_100px_rgba(178,13,48,0.3)] max-w-sm w-full relative z-10 pointer-events-auto backdrop-blur-3xl overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#B20D30]/10 rounded-full blur-3xl -mr-16 -mt-16" />

                            <div className="w-16 h-16 bg-[#B20D30]/10 rounded-2xl flex items-center justify-center text-[#B20D30] mb-6 mx-auto relative z-10">
                                <UserCheck size={32} />
                            </div>
                            <h3 className="text-xl font-black text-center uppercase tracking-tighter mb-2 relative z-10">¿Autocompletar?</h3>
                            <p className="text-zinc-500 text-center text-[10px] font-bold uppercase tracking-widest leading-relaxed mb-8 relative z-10 px-4">
                                Se ha encontrado un registro previo para la matrícula <span className="text-white">{plate}</span>.
                            </p>

                            <div className="space-y-3 relative z-10">
                                <Button onClick={handleAutocomplete} className="w-full h-14 rounded-xl bg-[#B20D30] hover:bg-[#910a28] text-white font-black uppercase text-[11px] tracking-widest shadow-xl">
                                    Sí, Cargar Datos
                                </Button>
                                <Button onClick={() => setShowMatchPrompt(false)} variant="ghost" className="w-full h-12 rounded-xl text-zinc-500 hover:text-white font-bold uppercase text-[9px] tracking-widest">
                                    No, Ingresar Manual
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MAIN WINDOW */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <header className="h-24 flex items-center justify-between px-8 bg-[#121214]/60 backdrop-blur-xl border-b border-white/5 shrink-0 z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 flex items-center justify-center shrink-0">
                            <Image src={logo} alt="Logo" width={60} height={60} className="object-contain" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase italic">
                                    {activeTab === "control" && "Registro de Acceso"}
                                    {activeTab === "history" && "Historial Eventos"}
                                    {activeTab === "alerts" && "Centro Notificaciones"}
                                    {activeTab === "devices" && "Dispositivos en Línea"}
                                </h1>
                                <span className="px-1.5 py-0.5 bg-[#B20D30]/20 text-[#B20D30] text-[9px] font-black rounded border border-[#B20D30]/30 uppercase tracking-tighter">Sildan Secure</span>
                            </div>
                            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5">Physical Security Management</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col items-end">
                            <p className="text-2xl font-black tabular-nums tracking-tighter">{currentTime.toLocaleTimeString('es-UY', { hour12: false, hour: '2-digit', minute: '2-digit' })}</p>
                            <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em]">{currentTime.toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative">
                    <AnimatePresence mode="wait">
                        {activeTab === "control" && (
                            <motion.div key="control" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.2 }} className="h-full w-full overflow-y-auto p-4 md:p-8 pb-40 custom-scrollbar">
                                <div className="flex-1 max-w-6xl mx-auto flex flex-col xl:flex-row gap-8">
                                    {/* FORM */}
                                    <div className="flex-1 min-w-0 flex flex-col gap-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <button onClick={() => { playTactileSound(); setType("ENTRY"); }} className={cn("h-28 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative", type === "ENTRY" ? "bg-[#B20D30]/10 border-[#B20D30] text-[#B20D30]" : "bg-white/5 border-white/5 text-zinc-500")}>
                                                <LogIn size={28} />
                                                <span className="font-bold text-xs uppercase tracking-widest">Entrada de Vehículo</span>
                                            </button>
                                            <button onClick={() => { playTactileSound(); setType("EXIT"); }} className={cn("h-28 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative", type === "EXIT" ? "bg-orange-600/10 border-orange-600 text-orange-500" : "bg-white/5 border-white/5 text-zinc-500")}>
                                                <LogOut size={28} />
                                                <span className="font-bold text-xs uppercase tracking-widest">Salida de Vehículo</span>
                                            </button>
                                        </div>
                                        <div className="space-y-12 py-4">
                                            <div className="space-y-4">
                                                <Label className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.4em] ml-2">Identificación de Matrícula</Label>

                                                {/* PHYSICAL LICENSE PLATE STYLE */}
                                                <div className="relative mx-auto w-full max-w-2xl group">
                                                    {/* Plate Container */}
                                                    <div className="h-44 bg-[#f2f2f2] rounded-xl border-[4px] border-black shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col relative">
                                                        {/* Mercosur Strip (Clean) */}
                                                        <div className="h-10 bg-[#0033aa] w-full flex items-center justify-center px-6 shrink-0 border-b border-black">
                                                            <div className="absolute left-6 w-7 h-5 bg-white/10 rounded-sm border border-white/5" />
                                                            {/* Custom Label Area (Previously Uruguay) */}
                                                            <div className="px-4 py-0.5 rounded bg-black/5 flex items-center gap-2">
                                                                <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
                                                                <span className="text-[9px] font-black text-white/50 tracking-[0.6em] uppercase">SILDAN LPR CORE</span>
                                                            </div>
                                                            <div className="absolute right-6 w-7 h-5 bg-white/10 rounded-sm border border-white/5" />
                                                        </div>

                                                        {/* TACTILE MATRIX INPUT - CREATIVE & FAST */}
                                                        <div className="flex-1 flex flex-col items-center justify-center relative bg-white overflow-hidden p-4">
                                                            <TactilePlateInput value={plate} onChange={setPlate} />

                                                            {/* Hidden bolts (subtle) */}
                                                            <div className="absolute top-5 left-5 w-2 h-2 rounded-full bg-zinc-200 border border-black/5 z-30" />
                                                            <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-zinc-200 border border-black/5 z-30" />
                                                            <div className="absolute bottom-5 left-5 w-2 h-2 rounded-full bg-zinc-200 border border-black/5 z-30" />
                                                            <div className="absolute bottom-5 right-5 w-2 h-2 rounded-full bg-zinc-200 border border-black/5 z-30" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <AppField label="Nombre del Visitante" icon={<UserIcon size={14} />} value={name} onChange={setName} placeholder="Visitante..." />
                                                <AppField label="Cédula / Pasaporte" icon={<FileText size={14} />} value={dni} onChange={setDni} placeholder="Documento..." />

                                                {/* ORIGIN SELECTION GRID */}
                                                <div className="col-span-1 md:col-span-2 space-y-3 pt-2">
                                                    <Label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5 ml-1">
                                                        <Shield size={14} /> Clasificación de Origen
                                                    </Label>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        <OriginButton
                                                            active={originType === "PARTICULAR"}
                                                            onClick={() => setOriginType("PARTICULAR")}
                                                            icon={<UserCheck size={20} />}
                                                            label="Particular"
                                                            activeClass="bg-white text-black border-white"
                                                        />
                                                        <OriginButton
                                                            active={originType === "EMPRESA"}
                                                            onClick={() => setOriginType("EMPRESA")}
                                                            icon={<Briefcase size={20} />}
                                                            label="Empresa"
                                                            activeClass="bg-[#B20D30] text-white border-[#B20D30]"
                                                        />
                                                        <OriginButton
                                                            active={originType === "IMM"}
                                                            onClick={() => setOriginType("IMM")}
                                                            icon={<Landmark size={20} />}
                                                            label="IMM"
                                                            activeClass="bg-blue-600 text-white border-blue-600"
                                                        />
                                                        <OriginButton
                                                            active={originType === "POLICIA"}
                                                            onClick={() => setOriginType("POLICIA")}
                                                            icon={<Shield size={20} />}
                                                            label="Policía"
                                                            activeClass="bg-indigo-900 text-white border-indigo-900"
                                                        />
                                                        <OriginButton
                                                            active={originType === "BOMBEROS"}
                                                            onClick={() => setOriginType("BOMBEROS")}
                                                            icon={<Flame size={20} />}
                                                            label="Bomberos"
                                                            activeClass="bg-red-600 text-white border-red-600"
                                                        />
                                                        <OriginButton
                                                            active={originType === "AMBULANCIA"}
                                                            onClick={() => setOriginType("AMBULANCIA")}
                                                            icon={<Plus size={20} />}
                                                            label="Ambulancia"
                                                            activeClass="bg-emerald-600 text-white border-emerald-600"
                                                        />
                                                    </div>
                                                    {originType === "EMPRESA" && (
                                                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                                                            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nombre de la empresa..." className="h-14 bg-white/5 border-white/10 rounded-xl text-white focus:border-[#B20D30]" />
                                                        </motion.div>
                                                    )}
                                                </div>

                                                {/* UNIT SELECTION (SEARCHABLE) */}
                                                <div className="col-span-1 md:col-span-2 space-y-3 pt-2 relative">
                                                    <Label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5 ml-1">
                                                        <Building2 size={14} /> Unidad de Destino
                                                    </Label>

                                                    {selectedUnit ? (
                                                        <div className="h-16 bg-[#B20D30]/10 border-2 border-[#B20D30] rounded-xl flex items-center justify-between px-6">
                                                            <div className="flex items-center gap-4">
                                                                <Home className="text-[#B20D30]" size={24} />
                                                                <div>
                                                                    <p className="font-black text-white uppercase text-sm">{selectedUnit.name}</p>
                                                                    <p className="text-[10px] text-zinc-500 font-bold uppercase">{selectedUnit.number || "Sin número"}</p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => { setSelectedUnit(null); setUnitSearch(""); }} className="p-2 text-zinc-500 hover:text-white transition-colors">
                                                                <X size={20} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                                                            <Input
                                                                value={unitSearch}
                                                                onFocus={() => setShowUnitResults(true)}
                                                                onChange={(e) => { setUnitSearch(e.target.value); setShowUnitResults(true); }}
                                                                placeholder="Buscar unidad..."
                                                                className="h-16 pl-14 bg-white/5 border-white/10 rounded-xl text-white focus:border-[#B20D30] text-lg font-bold"
                                                            />

                                                            {showUnitResults && unitSearch.length > 0 && (
                                                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#121214] border border-white/10 rounded-xl overflow-hidden z-[50] shadow-2xl">
                                                                    {filteredUnits.length > 0 ? (
                                                                        filteredUnits.map(u => (
                                                                            <button
                                                                                key={u.id}
                                                                                onClick={() => { setSelectedUnit(u); setShowUnitResults(false); }}
                                                                                className="w-full h-14 px-6 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                                                                            >
                                                                                <span className="font-bold text-sm uppercase">{u.name}</span>
                                                                                <span className="text-[10px] text-zinc-500 font-black tracking-widest">{u.number}</span>
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="h-14 flex items-center justify-center text-[10px] font-black text-zinc-600 uppercase tracking-widest">No se encontraron unidades</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-2">Observaciones</Label>
                                                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motivo de visita..." className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#B20D30]/50 resize-none transition-all" />
                                            </div>
                                        </div>
                                        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 flex flex-col md:flex-row items-center gap-8">
                                            <div className="flex-1 space-y-1">
                                                <p className="text-[11px] font-black uppercase text-zinc-500 tracking-widest">Vigilante en Servicio</p>
                                                <Input value={guardName} onChange={(e) => saveGuardName(e.target.value.toUpperCase())} placeholder="NOMBRE DEL GUARDIA" className="border-none bg-transparent p-0 h-8 text-xl font-black text-[#B20D30] uppercase placeholder:text-zinc-800 shadow-none focus-visible:ring-0" />
                                            </div>
                                            <Button
                                                disabled={isSubmitting || !selectedUnit || (!capturedPhoto && window.isSecureContext)}
                                                onClick={() => { playTactileSound(); handleSubmit(); }}
                                                className={cn("w-full md:w-auto h-20 px-12 rounded-xl font-black text-xl uppercase tracking-widest transition-all", type === "ENTRY" ? "bg-[#B20D30] hover:bg-[#910a28] text-white shadow-2xl shadow-[#B20D30]/20" : "bg-orange-600 hover:bg-orange-700 text-white shadow-2xl shadow-orange-600/20")}
                                            >
                                                {isSubmitting ? <Loader2 className="animate-spin" /> : "Finalizar Registro"}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* CAMERA & MAP */}
                                    <div className="w-full xl:w-[400px] shrink-0 flex flex-col gap-6">
                                        {/* CAMERA SECTION */}
                                        <div className="min-h-[300px] flex-[1.5] bg-[#121214] border border-white/10 rounded-2xl overflow-hidden relative group flex flex-col">
                                            {capturedPhoto ? (
                                                <div className="h-full w-full relative">
                                                    <Image src={capturedPhoto} alt="Capture" fill className="object-cover" />

                                                    {/* Floating Buttons on capture */}
                                                    <div className="absolute top-6 right-6 flex flex-col gap-3">
                                                        <button onClick={() => { setCapturedPhoto(null); setIsCameraActive(true); }} className="w-12 h-12 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-[#B20D30] transition-all shadow-xl">
                                                            <RefreshCcw size={20} />
                                                        </button>

                                                        {/* AUDIO ACTION IN CAMERA BLOCK */}
                                                        <AudioRecordingButton
                                                            isRecording={isRecording}
                                                            audioUrl={audioUrl}
                                                            onStart={startRecording}
                                                            onStop={stopRecording}
                                                            onClear={() => { setAudioUrl(null); setAudioBlob(null); }}
                                                        />
                                                    </div>

                                                    <div className="absolute bottom-10 left-6 right-6 p-4 bg-[#B20D30]/90 backdrop-blur-md rounded-2xl flex items-center justify-between shadow-2xl border border-white/10">
                                                        <div className="flex items-center gap-3">
                                                            <CheckCircle2 className="text-white" size={24} />
                                                            <span className="text-white font-black uppercase text-xs tracking-widest">Foto Capturada</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : isCameraActive ? (
                                                <div className="h-full w-full relative">
                                                    <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                                                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 z-10">
                                                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={takePhoto} className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-black shadow-2xl">
                                                            <Camera size={32} />
                                                        </motion.button>
                                                    </div>

                                                    <button onClick={() => setIsCameraActive(false)} className="absolute top-6 right-6 w-10 h-10 bg-black/40 rounded-full flex items-center justify-center">
                                                        <X size={20} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="h-full w-full flex flex-col items-center justify-center gap-6 p-8 text-center relative bg-white/5">
                                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                                                        <CameraOff size={32} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-bold mb-1">Cámara Inactiva</h3>
                                                        <p className="text-[10px] text-zinc-500">Active para tomar una fotografía.</p>
                                                    </div>
                                                    <Button onClick={() => setIsCameraActive(true)} size="sm" className="rounded-xl bg-white text-black hover:bg-zinc-200">
                                                        <Camera className="mr-2" size={16} /> {window.isSecureContext ? "Activar Cámara" : "Cámara (Requiere HTTPS)"}
                                                    </Button>
                                                    {!window.isSecureContext && (
                                                        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl max-w-xs">
                                                            <p className="text-[9px] text-yellow-500 font-bold uppercase leading-tight">
                                                                Para usar la cámara en esta red:<br />
                                                                1. Entre a chrome://flags<br />
                                                                2. Busque "Insecure origins"<br />
                                                                3. Agregue http://{window.location.host}<br />
                                                                4. Reinicie Chrome
                                                                <br /><br />
                                                                O use HTTPS.
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* AUDIO ACTION EVEN IF CAMERA INACTIVE */}
                                                    <div className="absolute top-6 right-6">
                                                        <AudioRecordingButton
                                                            isRecording={isRecording}
                                                            audioUrl={audioUrl}
                                                            onStart={startRecording}
                                                            onStop={stopRecording}
                                                            onClear={() => { setAudioUrl(null); setAudioBlob(null); }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>                                    </div>
                                </div>
                            </motion.div>
                        )}
                        {activeTab === "devices" && (
                            <motion.div key="devices" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.2 }} className="h-full w-full overflow-y-auto px-8 pt-10 pb-40">
                                <div className="max-w-6xl mx-auto space-y-8">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
                                        <div className="lg:col-span-2 bg-[#121214] border border-white/10 rounded-2xl overflow-hidden relative flex flex-col group/map shadow-2xl">
                                            <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
                                                <div className="flex items-center gap-3 px-4 py-2 bg-black/80 backdrop-blur-xl rounded-full border border-white/5 shadow-2xl">
                                                    <div className="w-2 h-2 rounded-full bg-[#B20D30] animate-ping" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Rastreo de Flota en Tiempo Real</span>
                                                    <span className="bg-[#B20D30]/20 text-[#B20D30] px-1.5 py-0.5 rounded text-[8px] font-black ml-1">03 ACTIVO</span>
                                                </div>
                                            </div>

                                            <div className="absolute bottom-6 right-6 z-20 overflow-hidden rounded-xl border border-white/5 bg-black/60 backdrop-blur-md p-4 space-y-2 shadow-2xl">
                                                <DeviceEntry name="Entrada A (Main)" status="active" />
                                                <DeviceEntry name="Salida B (Rear)" status="active" />
                                                <DeviceEntry name="Mobile Patrol 1" status="moving" />
                                            </div>

                                            {location ? (
                                                <div className="h-full w-full grayscale contrast-125 opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                                                    <iframe
                                                        width="100%"
                                                        height="100%"
                                                        frameBorder="0"
                                                        src={`https://www.google.com/maps/embed/v1/search?key=YOUR_GOOGLE_MAPS_API_KEY&q=${location.lat},${location.lng}&zoom=16`}
                                                        allowFullScreen
                                                    />
                                                </div>
                                            ) : (
                                                <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-[#0a0a0b]">
                                                    <div className="relative">
                                                        <div className="w-16 h-16 rounded-full border border-white/5 flex items-center justify-center animate-pulse">
                                                            <MapPin size={24} className="text-zinc-700" />
                                                        </div>
                                                        <div className="absolute -top-10 -left-20 w-3 h-3 bg-[#B20D30] rounded-full blur-[2px] animate-pulse" />
                                                        <div className="absolute top-8 right-12 w-2 h-2 bg-white/20 rounded-full animate-bounce" />
                                                        <div className="absolute -bottom-12 left-10 w-2 h-2 bg-blue-500/50 rounded-full animate-pulse" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">Sincronizando con Satélites...</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-6">
                                            <div className="bg-[#121214] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
                                                <div className="flex items-center justify-between text-[11px] font-black uppercase text-zinc-500 tracking-widest">
                                                    <span>Estado de Red Sildan</span>
                                                    <Activity size={14} className="text-[#B20D30]" />
                                                </div>
                                                <div className="space-y-4 pt-2">
                                                    <SensorStatus label="Reconocimiento LPR AI" active={true} />
                                                    <SensorStatus label="Localización GPS" active={location !== null} />
                                                    <SensorStatus label="Sincronización Cloud" active={true} />
                                                    <SensorStatus label="Puerta Principal (Relay)" active={true} />
                                                </div>
                                            </div>

                                            <div className="bg-[#B20D30]/5 border border-[#B20D30]/20 rounded-2xl p-6 shadow-xl">
                                                <h4 className="text-[10px] font-black uppercase text-[#B20D30] tracking-widest mb-4">Métricas de Conectividad</h4>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-zinc-400">Latencia</span>
                                                    <span className="text-xs font-black text-emerald-500 uppercase">24ms - Excelente</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                        {activeTab === "alerts" && (
                            <motion.div key="alerts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full w-full flex flex-col items-center justify-center gap-6 pb-40">
                                <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-zinc-700 animate-pulse">
                                    <Bell size={40} />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-black uppercase tracking-tighter mb-2">Sin Notificaciones Críticas</h3>
                                    <p className="text-xs text-zinc-500 font-medium">El sistema está operando en condiciones normales.</p>
                                </div>
                            </motion.div>
                        )}
                        {activeTab === "history" && (
                            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full w-full overflow-y-auto px-8 pt-10 pb-40">
                                <div className="max-w-6xl mx-auto space-y-6">
                                    <div className="flex items-center justify-between sticky top-0 bg-[#0a0a0b]/95 backdrop-blur-md py-4 z-20">
                                        <h2 className="text-2xl font-black uppercase tracking-tight">Registro General</h2>
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                                                <Input placeholder="Buscar por matrícula..." className="pl-10 h-11 w-64 bg-[#1c2128] border-white/5 rounded-xl transition-all" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {entries.map((entry) => (
                                            <HistoryItem key={entry.id} entry={entry} onDelete={handleDelete} />
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* INTERACTIVE BOTTOM NAVIGATION - FIXED POSITION */}
                    <div className="fixed bottom-6 left-0 right-0 h-20 flex items-center justify-center pointer-events-none z-[80]">
                        <div className="bg-[#121214]/90 backdrop-blur-3xl border border-white/10 rounded-full h-16 w-auto min-w-[340px] px-2 flex items-center justify-around gap-2 pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                            <BottomTab icon={<FileText size={20} />} active={activeTab === "control"} onClick={() => handleTabChange("control")} label="Acceso" />
                            <BottomTab icon={<HistoryIcon size={20} />} active={activeTab === "history"} onClick={() => handleTabChange("history")} label="Historial" />
                            <BottomTab icon={<MapPin size={20} />} active={activeTab === "devices"} onClick={() => handleTabChange("devices")} label="Dispositivos" />
                            <BottomTab icon={<Bell size={20} />} active={activeTab === "alerts"} onClick={() => handleTabChange("alerts")} label="Alertas" />
                            <div className="w-px h-8 bg-white/10 mx-2" />
                            <div className="flex items-center gap-3 px-4">
                                <div className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-[#B20D30]/50 flex items-center justify-center">
                                    <span className="text-[10px] font-black">{guardName?.substring(0, 2) || "GA"}</span>
                                </div>
                                <div className="hidden lg:block">
                                    <p className="text-[9px] font-black text-white uppercase leading-none">{guardName || "SIN GUARDIA"}</p>
                                    <p className="text-[8px] font-bold text-zinc-600 uppercase">Activo</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            `}</style>
        </div>
    );
}

function BottomTab({ icon, active, onClick, label }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex-1 md:flex-none md:w-28 h-12 rounded-full flex items-center justify-center gap-2 transition-all duration-300 relative",
                active ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:bg-white/5"
            )}
        >
            {icon}
            <span className={cn("text-[10px] font-black uppercase tracking-tighter transition-all", active ? "opacity-100" : "opacity-0 invisible md:visible md:opacity-40")}>{label}</span>
            {active && (
                <motion.div layoutId="nav-pill" className="absolute inset-0 bg-white ring-4 ring-white/10 rounded-full -z-10" />
            )}
        </button>
    );
}

function OriginButton({ active, onClick, icon, label, activeClass }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all",
                active ? activeClass : "bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10"
            )}
        >
            {icon}
            <span className="font-bold text-[9px] uppercase tracking-tighter">{label}</span>
        </button>
    );
}

function AudioRecordingButton({ isRecording, audioUrl, onStart, onStop, onClear }: any) {
    return (
        <div className="flex flex-col items-center gap-2">
            {!audioUrl ? (
                <button
                    onClick={isRecording ? onStop : onStart}
                    className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-all relative shadow-2xl border",
                        isRecording ? "bg-red-500 border-red-400" : "bg-black/60 border-white/10 hover:bg-white/10"
                    )}
                >
                    {isRecording ? (
                        <>
                            <motion.div
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="absolute inset-0 bg-red-500 rounded-full"
                            />
                            <Square size={20} className="relative z-10 text-white fill-white" />
                        </>
                    ) : (
                        <Mic size={20} className="text-white" />
                    )}
                </button>
            ) : (
                <div className="flex flex-col gap-2">
                    <button className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-xl border border-emerald-400 active:scale-95 transition-all">
                        <Volume2 size={20} />
                    </button>
                    <button onClick={onClear} className="w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-zinc-500 hover:text-white border border-white/5 mx-auto">
                        <X size={14} />
                    </button>
                </div>
            )}
            {isRecording && (
                <div className="flex gap-0.5 items-center h-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <motion.div
                            key={i}
                            animate={{ height: [4, 12, 4] }}
                            transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                            className="w-1 bg-red-400 rounded-full"
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function AppField({ label, icon, value, onChange, placeholder }: any) {
    return (
        <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5 ml-1">
                {icon} {label}
            </Label>
            <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-14 bg-black/20 border-white/10 rounded-2xl text-white focus:border-[#B20D30] font-medium text-xs" />
        </div>
    );
}

function SensorStatus({ label, active }: { label: string, active: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-zinc-400">{label}</span>
            <div className={cn("w-2 h-2 rounded-full", active ? "bg-[#B20D30] shadow-[0_0_8px_rgba(178,13,48,0.5)]" : "bg-red-950")} />
        </div>
    );
}

function HistoryItem({ entry, onDelete }: any) {
    return (
        <motion.div whileHover={{ y: -4 }} className="bg-[#1c2128] border border-white/5 rounded-3xl overflow-hidden group">
            <div className="aspect-video relative overflow-hidden bg-zinc-900 border-b border-white/5">
                {entry.photoPath ? (
                    <Image src={entry.photoPath} alt="Log" fill className="object-cover opacity-80 group-hover:opacity-100 transition-all duration-500" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-zinc-700">
                        <ImageIcon size={32} />
                    </div>
                )}
                <div className={cn("absolute top-4 left-4 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest", entry.type === "ENTRY" ? "bg-[#B20D30] text-white" : "bg-orange-600 text-white")}>
                    {entry.type === "ENTRY" ? "Entrada" : "Salida"}
                </div>
            </div>
            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <h4 className="text-xl font-black text-white uppercase">{entry.plate || "S/ Placa"}</h4>
                    <div className="flex items-center gap-2">
                        {entry.audioPath && (
                            <button onClick={() => {
                                const audio = new Audio(entry.audioPath);
                                audio.play();
                            }} className="p-2 text-zinc-600 hover:text-white transition-colors">
                                <Volume2 size={16} />
                            </button>
                        )}
                        <button onClick={() => onDelete(entry.id)} className="p-2 text-zinc-600 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-y-3">
                    <div>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Visitante</p>
                        <p className="text-xs font-bold text-zinc-300 truncate">{entry.name || "N/A"}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Destino</p>
                        <p className="text-xs font-bold text-blue-400 truncate">{entry.destination || "N/A"}</p>
                    </div>
                    {entry.latitude && (
                        <div className="col-span-2 mt-2 pt-2 border-t border-white/5 flex items-center gap-1 text-[9px] text-zinc-500 font-bold uppercase">
                            <MapPin size={10} />
                            <span>GPS: {entry.latitude.toFixed(4)}, {entry.longitude.toFixed(4)}</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function TactilePlateInput({ value, onChange }: { value: string, onChange: (v: string) => void }) {
    const chars = value.padEnd(7, " ").substring(0, 7).split("");
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="w-full flex flex-col gap-2 items-center">
            {/* HIDDEN NATIVE INPUT TRIGGER */}
            <input
                ref={inputRef}
                type="text"
                value={value}
                onKeyDown={() => {
                    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.setValueAtTime(600, ctx.currentTime);
                    gain.gain.setValueAtTime(0.02, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.05);
                }}
                onChange={(e) => onChange(e.target.value.toUpperCase().substring(0, 7))}
                className="absolute opacity-0 pointer-events-none h-0 w-0"
                autoFocus
            />

            {/* PLATE DISPLAY SEGMENTS */}
            <div
                className="flex gap-2 h-28 items-center cursor-pointer active:scale-95 transition-transform"
                onClick={() => inputRef.current?.focus()}
            >
                {chars.map((char, i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-16 h-24 rounded-2xl flex items-center justify-center transition-all duration-200 border-2",
                            value.length === i || (value.length === 7 && i === 6)
                                ? "bg-black text-white border-black scale-105 shadow-2xl z-10"
                                : "bg-zinc-50 text-black border-black/5"
                        )}
                    >
                        <span className="text-6xl font-black">{char === " " ? "" : char}</span>
                    </div>
                ))}
            </div>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-2">Toque la matrícula para escribir</p>
        </div>
    );
}

function DeviceEntry({ name, status }: { name: string, status: string }) {
    return (
        <div className="flex items-center gap-3 px-2 py-1">
            <div className={cn("w-1.5 h-1.5 rounded-full", status === 'active' ? "bg-emerald-500" : "bg-blue-500")} />
            <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-wider">{name}</span>
        </div>
    );
}
