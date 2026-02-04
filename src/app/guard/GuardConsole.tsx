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
    Delete,
    Car,
    Bike,
    Zap,
    Monitor,
    Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createBitacoraEntry, deleteBitacoraEntry } from "@/app/actions/bitacora";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";

interface GuardConsoleProps {
    initialEntries: any[];
    logo: string;
    units: any[];
}

type TabType = "control" | "history" | "alerts";

export default function GuardConsole({ initialEntries, logo, units }: GuardConsoleProps) {
    const [activeTab, setActiveTab] = useState<TabType>("control");
    const [entries, setEntries] = useState(initialEntries);
    const [type, setType] = useState<"ENTRY" | "EXIT">("ENTRY");
    const [plate, setPlate] = useState("");
    const [vehicleType, setVehicleType] = useState<"AUTO" | "MOTO">("AUTO");
    const [notes, setNotes] = useState("");
    const [name, setName] = useState("");
    const [dni, setDni] = useState("");
    const [matchingEntry, setMatchingEntry] = useState<any>(null);
    const [showMatchPrompt, setShowMatchPrompt] = useState(false);
    const [originType, setOriginType] = useState<"PARTICULAR" | "EMPRESA" | "IMM" | "POLICIA" | "BOMBEROS" | "AMBULANCIA">("PARTICULAR");
    const [company, setCompany] = useState("");
    const [socket, setSocket] = useState<any>(null);
    const [guardName, setGuardName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        // Use the same protocol as the page (http or https)
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';

        // Auto-detect if we need port 10000 or if we're behind a proxy
        // If accessing via standard ports (80/443), assume proxy is handling routing
        // Otherwise, use port 10000 directly
        const isStandardPort = window.location.port === '' || window.location.port === '80' || window.location.port === '443';
        const socketUrl = isStandardPort
            ? `${protocol}://${window.location.hostname}`  // Behind proxy
            : `${protocol}://${window.location.hostname}:10000`;  // Direct access

        console.log('🔌 Connecting to socket:', socketUrl, '(Standard port:', isStandardPort, ')');
        const newSocket = io(socketUrl);
        setSocket(newSocket);

        // Attempt to get Local IP via WebRTC
        let detectedLocalIp = '';
        try {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel("");
            pc.createOffer().then(offer => pc.setLocalDescription(offer));
            pc.onicecandidate = (ice) => {
                if (ice && ice.candidate && ice.candidate.candidate) {
                    const myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(ice.candidate.candidate)?.[1];
                    if (myIP && !myIP.startsWith('127.')) {
                        detectedLocalIp = myIP;
                    }
                }
            };
            setTimeout(() => pc.close(), 5000);
        } catch (e) {
            console.error("Local IP detection error", e);
        }

        // Emit presence every 4 seconds for a tighter keepalive
        const heartBeat = setInterval(() => {
            newSocket.emit('guard_presence', {
                guardName: guardName || 'Invitado',
                status: 'online',
                timestamp: new Date().toISOString(),
                reportedIp: detectedLocalIp // Send the IP we found
            });
        }, 4000);

        return () => {
            clearInterval(heartBeat);
            newSocket.close();
        };
    }, [guardName]);

    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [showOriginPicker, setShowOriginPicker] = useState(false);
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

    // Identity Management
    const [showIdentityOverlay, setShowIdentityOverlay] = useState(true);
    const [tempGuardName, setTempGuardName] = useState("");

    const handleConfirmIdentity = () => {
        if (tempGuardName.trim()) {
            saveGuardName(tempGuardName);
            setShowIdentityOverlay(false);
            toast.success(`Bienvenido, ${tempGuardName}`);
        }
    };

    const handleLogout = () => {
        setGuardName("");
        localStorage.removeItem("bitacora_guard_name");
        setShowIdentityOverlay(true);
        toast.info("Sesión cerrada");
    };

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
        if (savedGuard) {
            setGuardName(savedGuard);
            setShowIdentityOverlay(false);
        }
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
        // Solo validar que haya matrícula
        if (!plate.trim()) {
            toast.error("Debe ingresar una matrícula");
            return;
        }

        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("type", type);
            formData.append("plate", plate.trim());
            formData.append("notes", notes.trim());
            formData.append("name", name.trim());
            formData.append("dni", dni.trim());
            formData.append("company", originType === "EMPRESA" ? company.trim() : originType);
            formData.append("destination", selectedUnit ? selectedUnit.name + (selectedUnit.number ? ` (${selectedUnit.number})` : "") : "");
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
        <div className="h-screen w-screen bg-white text-black flex overflow-hidden font-sans select-none">

            {/* IDENTITY / LOGIN OVERLAY */}
            <AnimatePresence>
                {showIdentityOverlay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-8"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-lg flex flex-col items-center"
                        >
                            {/* Animated Logo Branding */}
                            <motion.div
                                animate={{
                                    opacity: [0.7, 1, 0.7],
                                    scale: [0.98, 1.02, 0.98],
                                }}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="w-48 h-48 flex items-center justify-center p-4 mb-12"
                            >
                                <Image src="/logo-transparent.png" alt="Logo" width={200} height={200} className="object-contain" />
                            </motion.div>

                            <div className="bg-slate-50 border-2 border-black transition-all duration-300 p-10 rounded-[3.5rem] shadow-2xl w-full flex flex-col items-center gap-8">
                                <div className="text-center">
                                    <h1 className="text-4xl font-black text-black uppercase tracking-tighter mb-2">OmniAccess</h1>
                                    <p className="text-[12px] text-black font-black uppercase font-bold uppercase tracking-widest">Identificación de Operario</p>
                                </div>

                                <div className="w-full space-y-3">
                                    <Label className="text-[11px] font-black uppercase text-black ml-4 tracking-widest">Operario de Turno</Label>
                                    <Input
                                        placeholder="Ingrese su nombre..."
                                        value={tempGuardName}
                                        onChange={(e) => setTempGuardName(e.target.value)}
                                        className="h-20 rounded-[1.75rem] border-2 border-black transition-all duration-300 bg-white text-2xl font-black text-black text-center focus:border-black transition-all shadow-sm"
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmIdentity()}
                                    />
                                </div>

                                <Button
                                    onClick={handleConfirmIdentity}
                                    disabled={!tempGuardName.trim()}
                                    className="w-full h-20 rounded-[1.75rem] bg-black text-white text-sm font-black uppercase tracking-[0.2em] hover:bg-neutral-900 transition-all shadow-xl shadow-black/10 active:scale-95"
                                >
                                    Iniciar Sistema <ChevronRight className="ml-2" size={20} />
                                </Button>
                            </div>

                            <p className="mt-12 text-[10px] font-black text-black/20 uppercase tracking-[0.5em]">Security Systems Architecture</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* LOGO TRANSITION LOADER */}
            <AnimatePresence>
                {isTransitioning && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] bg-slate-50 flex flex-col items-center justify-center"
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
                            <Image src="/logo-transparent.png" alt="Loading" width={160} height={160} className="object-contain" />
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
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
                            onClick={() => setShowMatchPrompt(false)}
                        />

                        <div className="bg-white border-2 border-[#B20D30] rounded-[2rem] p-10 shadow-[0_40px_120px_rgba(0,0,0,0.15)] max-w-sm w-full relative z-10 pointer-events-auto overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#B20D30]/5 rounded-full blur-3xl -mr-16 -mt-16" />

                            <div className="w-16 h-16 bg-[#B20D30]/10 rounded-2xl flex items-center justify-center text-[#B20D30] mb-6 mx-auto relative z-10">
                                <UserCheck size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-center uppercase tracking-tighter mb-4 relative z-10 text-black">¿Autocompletar?</h3>
                            <p className="text-black font-black uppercase text-center text-[11px] font-bold uppercase tracking-widest leading-relaxed mb-10 relative z-10 px-4">
                                Se ha encontrado un registro previo para la matrícula <span className="text-[#B20D30] font-black">{plate}</span>.
                            </p>

                            <div className="space-y-4 relative z-10">
                                <Button onClick={handleAutocomplete} className="w-full h-16 rounded-2xl bg-[#B20D30] hover:bg-[#910a28] text-white font-black uppercase text-[12px] tracking-widest shadow-xl shadow-[#B20D30]/20">
                                    Sí, Cargar Datos
                                </Button>
                                <Button onClick={() => setShowMatchPrompt(false)} variant="ghost" className="w-full h-14 rounded-2xl text-black/40 hover:text-black font-bold uppercase text-[10px] tracking-widest transition-colors">
                                    No, Ingresar Manual
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MAIN WINDOW */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative pb-24">
                <div className="flex-1 overflow-hidden relative">
                    <AnimatePresence mode="wait">
                        {activeTab === "control" && (
                            <motion.div key="control" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.2 }} className="h-full w-full overflow-y-auto p-4 md:p-8 pb-64 custom-scrollbar">

                                <div className="max-w-7xl mx-auto flex flex-col gap-10">
                                    {/* TOP TOGGLE (ENTRY/EXIT) */}
                                    <div className="grid grid-cols-2 gap-8">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => { playTactileSound(); setType("ENTRY"); }}
                                            className={cn(
                                                "h-28 rounded-[2rem] border-2 flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden group",
                                                type === "ENTRY"
                                                    ? "bg-gradient-to-br from-[#B20D30] to-[#E53935] border-[#B20D30] text-white shadow-xl shadow-[#B20D30]/20"
                                                    : "bg-white border-black transition-all duration-300 text-black/40 hover:bg-slate-50"
                                            )}
                                        >
                                            <LogIn size={28} className={type === "ENTRY" ? "text-white" : "text-black/20"} />
                                            <span className="font-black text-[10px] uppercase tracking-[0.3em]">Registro de Ingreso</span>
                                            {type === "ENTRY" && <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full -mr-6 -mt-6" />}
                                        </motion.button>

                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => { playTactileSound(); setType("EXIT"); }}
                                            className={cn(
                                                "h-28 rounded-[2rem] border-2 flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden group",
                                                type === "EXIT"
                                                    ? "bg-gradient-to-br from-orange-600 to-amber-500 border-orange-600 text-white shadow-xl shadow-orange-600/20"
                                                    : "bg-white border-black transition-all duration-300 text-black/40 hover:bg-slate-50"
                                            )}
                                        >
                                            <LogOut size={28} className={type === "EXIT" ? "text-white" : "text-black/20"} />
                                            <span className="font-black text-[10px] uppercase tracking-[0.3em]">Registro de Salida</span>
                                            {type === "EXIT" && <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full -mr-6 -mt-6" />}
                                        </motion.button>
                                    </div>

                                    {/* CAMERA & CONTROLS */}
                                    <div className="flex flex-col xl:flex-row gap-8">
                                        {/* FORM SECTION (Expanded) */}
                                        <div className="flex-1 space-y-8">
                                            <div className="bg-white/80 backdrop-blur-xl border border-black/20 rounded-[3rem] p-10 shadow-sm space-y-10 group transition-all hover:shadow-2xl">
                                                <div className="flex flex-col gap-10">
                                                    <div className="flex-1 w-full space-y-6">
                                                        <div className="flex items-center gap-4 ml-4">
                                                            <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center text-white shadow-lg">
                                                                <Monitor size={20} />
                                                            </div>
                                                            <Label className="text-sm font-black uppercase text-black tracking-[0.3em]">Identificación de Matrícula</Label>
                                                        </div>
                                                        <div className="flex justify-center overflow-hidden py-4">
                                                            <TactilePlateInput value={plate} onChange={setPlate} />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-slate-100" />

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <AppField label="Nombre del Visitante" icon={<UserIcon size={14} />} value={name} onChange={setName} placeholder="Visitante..." />
                                                    <AppField label="Cédula / Pasaporte" icon={<FileText size={14} />} value={dni} onChange={setDni} placeholder="Documento..." />

                                                    {originType === "EMPRESA" && (
                                                        <div className="col-span-1 md:col-span-2">
                                                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                                                                <AppField label="Empresa / Institución" icon={<Briefcase size={14} />} value={company} onChange={setCompany} placeholder="Nombre de la empresa..." />
                                                            </motion.div>
                                                        </div>
                                                    )}

                                                    <div className="col-span-1 md:col-span-2 space-y-3 pt-2 relative">
                                                        <Label className="text-[10px] font-black uppercase text-black font-black uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                                            <Building2 size={14} /> Unidad de Destino
                                                        </Label>

                                                        <motion.button
                                                            whileHover={{ scale: 1.01 }}
                                                            whileTap={{ scale: 0.99 }}
                                                            onClick={() => setShowUnitPicker(true)}
                                                            className={cn(
                                                                "w-full h-24 rounded-[2rem] border border-black/20 flex items-center justify-between px-8 transition-all relative overflow-hidden group",
                                                                selectedUnit
                                                                    ? "bg-[#B20D30]/5 border-[#B20D30] shadow-lg shadow-[#B20D30]/5"
                                                                    : "bg-white border-black transition-all duration-300"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-6">
                                                                <div className={cn(
                                                                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                                                                    selectedUnit ? "bg-[#B20D30] text-white" : "bg-slate-100 text-black/20"
                                                                )}>
                                                                    <Home size={24} />
                                                                </div>
                                                                <div className="text-left">
                                                                    {selectedUnit ? (
                                                                        <>
                                                                            <p className="text-xl font-black text-black uppercase tracking-tight">{selectedUnit.name}</p>
                                                                            <p className="text-[10px] font-black text-[#B20D30] uppercase tracking-widest">{selectedUnit.number || "LT"}</p>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <p className="text-lg font-black text-black/30 uppercase tracking-tighter">Pendiente Seleccionar</p>
                                                                            <p className="text-[9px] font-black text-black/20 uppercase tracking-widest">Toca para abrir el panel de unidades</p>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className={cn(
                                                                "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                                                selectedUnit ? "bg-[#B20D30]/10 text-[#B20D30]" : "bg-slate-50 text-black/10"
                                                            )}>
                                                                <ChevronRight size={20} />
                                                            </div>
                                                        </motion.button>
                                                    </div>

                                                    <div className="col-span-1 md:col-span-2 space-y-4">
                                                        <Label className="text-[11px] font-black uppercase text-black font-black uppercase tracking-[0.2em] ml-2">Observaciones</Label>
                                                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motivo de visita..." className="w-full h-28 bg-white border border-black/20 transition-all duration-300 rounded-2xl p-6 text-sm text-black font-bold placeholder:text-black/30 focus:border-[#B20D30]/50 resize-none transition-all shadow-sm" />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4">
                                                    {/* MEDIA PREVIEWS */}
                                                    <div className="flex items-center gap-4">
                                                        {capturedPhoto && (
                                                            <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#B20D30] shadow-lg group">
                                                                <Image src={capturedPhoto} alt="Preview" fill className="object-cover" />
                                                                <button onClick={() => setCapturedPhoto(null)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                        {audioUrl && (
                                                            <div className="flex items-center gap-3 bg-emerald-50 border-2 border-emerald-500/20 px-4 py-3 rounded-2xl shadow-sm">
                                                                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                                                                    <Volume2 size={16} />
                                                                </div>
                                                                <div className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Audio Grabado</div>
                                                                <button onClick={() => { setAudioUrl(null); setAudioBlob(null); }} className="text-emerald-500/40 hover:text-red-500 transition-colors">
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                        {!capturedPhoto && !audioUrl && (
                                                            <div className="flex items-center gap-3 bg-slate-50 border border-dashed border-black/20 transition-all duration-300 px-6 py-4 rounded-2xl">
                                                                <CameraOff size={16} className="text-black/10" />
                                                                <span className="text-[9px] font-black text-black/20 uppercase tracking-[0.2em]">Sin Adjuntos Multimedia</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* CAMERA OVERLAY - FULLSCREEN */}
                                <AnimatePresence>
                                    {isCameraActive && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center"
                                        >
                                            {/* Header */}
                                            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
                                                <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-8 py-4 rounded-3xl flex items-center gap-4">
                                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                                    <span className="text-white font-black text-xl uppercase tracking-widest">Capturando Fotografía</span>
                                                </div>
                                            </div>

                                            {/* Video Feed - Fullscreen */}
                                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />

                                            {/* Hidden canvas for photo capture */}
                                            <canvas ref={canvasRef} className="hidden" />

                                            {/* Controls */}
                                            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-6 z-10">
                                                {/* Capture Button */}
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={takePhoto}
                                                    className="w-24 h-24 rounded-full bg-white border-8 border-white/30 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"
                                                >
                                                    <Camera size={32} className="text-black" />
                                                </motion.button>

                                                {/* Cancel Button */}
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setIsCameraActive(false)}
                                                    className="w-20 h-20 rounded-full bg-red-600 border-4 border-white/30 shadow-2xl flex items-center justify-center hover:bg-red-700 transition-colors"
                                                >
                                                    <X size={28} className="text-white" />
                                                </motion.button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* UNIT PICKER OVERLAY */}
                                <AnimatePresence>
                                    {showUnitPicker && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[250] flex items-center justify-center p-6 md:p-12 lg:p-20"
                                        >
                                            <div className="w-full max-w-7xl h-full flex flex-col gap-10">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-8">
                                                        <div className="w-20 h-20 rounded-[2.5rem] bg-[#B20D30] flex items-center justify-center text-white shadow-[0_20px_60px_rgba(178,13,48,0.4)]">
                                                            <Home size={40} />
                                                        </div>
                                                        <div>
                                                            <h2 className="text-5xl font-black text-white uppercase tracking-tighter">Unidades y Lotes</h2>
                                                            <p className="text-sm font-black text-white/50 uppercase tracking-[0.4em] mt-3">Seleccione el punto de destino final</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowUnitPicker(false)}
                                                        className="w-20 h-20 bg-white hover:bg-[#B20D30] rounded-[2.5rem] flex items-center justify-center text-black hover:text-white transition-all duration-500 border-2 border-white group"
                                                    >
                                                        <X size={40} className="group-hover:rotate-90 transition-transform duration-500" />
                                                    </button>
                                                </div>

                                                <div className="flex items-center gap-10">
                                                    <Search className="text-white/30" size={32} />
                                                    <Input
                                                        value={unitSearch}
                                                        onChange={(e) => setUnitSearch(e.target.value)}
                                                        placeholder="ESCRIBE PARA BUSCAR LOTE O CASA..."
                                                        className="flex-1 h-20 bg-white/5 border-2 border-white/10 rounded-[2rem] text-3xl font-black text-white placeholder:text-white/20 px-10 focus:border-[#B20D30] transition-all"
                                                    />
                                                </div>

                                                <div className="flex-1 overflow-y-auto pr-6 custom-scrollbar grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8 pb-10">
                                                    {units.filter(u => u.name.toLowerCase().includes(unitSearch.toLowerCase()) || (u.number && u.number.toLowerCase().includes(unitSearch.toLowerCase()))).map((u) => (
                                                        <motion.button
                                                            key={u.id}
                                                            whileHover={{ scale: 1.05, y: -10 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => {
                                                                setSelectedUnit(u);
                                                                setShowUnitPicker(false);
                                                                playTactileSound();
                                                            }}
                                                            className={cn(
                                                                "min-h-[220px] rounded-[3rem] border-2 flex flex-col items-center justify-center gap-6 transition-all relative overflow-hidden group",
                                                                selectedUnit?.id === u.id
                                                                    ? "bg-white border-white text-black shadow-[0_30px_90px_rgba(255,255,255,0.2)]"
                                                                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/30"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500",
                                                                selectedUnit?.id === u.id ? "bg-[#B20D30] text-white" : "bg-white/5 group-hover:bg-white/10"
                                                            )}>
                                                                <Home size={32} />
                                                            </div>
                                                            <div className="text-center px-6">
                                                                <p className={cn(
                                                                    "text-2xl font-black uppercase tracking-tighter leading-none break-words line-clamp-2 transition-colors",
                                                                    selectedUnit?.id === u.id ? "text-black" : "text-white"
                                                                )}>{u.name}</p>
                                                                <p className={cn(
                                                                    "text-xs font-black uppercase tracking-widest mt-4 transition-colors",
                                                                    selectedUnit?.id === u.id ? "text-[#B20D30]" : "text-white/30"
                                                                )}>{u.number || "RESIDENCIA"}</p>
                                                            </div>
                                                            {selectedUnit?.id === u.id && (
                                                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-6 right-6 text-[#B20D30]">
                                                                    <CheckCircle2 size={24} fill="currentColor" stroke="white" strokeWidth={3} />
                                                                </motion.div>
                                                            )}
                                                        </motion.button>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* ORIGIN PICKER OVERLAY */}
                                <AnimatePresence>
                                    {showOriginPicker && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[250] flex items-center justify-center p-6 md:p-12 lg:p-20"
                                        >
                                            <div className="w-full max-w-5xl flex flex-col gap-10">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-8">
                                                        <div className="w-20 h-20 rounded-[2.5rem] bg-[#B20D30] flex items-center justify-center text-white shadow-[0_20px_60px_rgba(178,13,48,0.4)]">
                                                            <Activity size={40} />
                                                        </div>
                                                        <div>
                                                            <h2 className="text-5xl font-black text-white uppercase tracking-tighter">Clasificación de Origen</h2>
                                                            <p className="text-sm font-black text-white/50 uppercase tracking-[0.4em] mt-3">Indique el tipo de visitante o entidad</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowOriginPicker(false)}
                                                        className="w-20 h-20 bg-white hover:bg-[#B20D30] rounded-[2.5rem] flex items-center justify-center text-black hover:text-white transition-all duration-500 border-2 border-white"
                                                    >
                                                        <X size={40} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                                                    <OriginPickerButton active={originType === "PARTICULAR"} onClick={() => { setOriginType("PARTICULAR"); setShowOriginPicker(false); playTactileSound(); }} icon={<UserCheck size={32} />} label="Particular" sub="Visita Residencial" />
                                                    <OriginPickerButton active={originType === "EMPRESA"} onClick={() => { setOriginType("EMPRESA"); setShowOriginPicker(false); playTactileSound(); }} icon={<Briefcase size={32} />} label="Empresa" sub="Servicios / Delivery" />
                                                    <OriginPickerButton active={originType === "IMM"} onClick={() => { setOriginType("IMM"); setShowOriginPicker(false); playTactileSound(); }} icon={<Landmark size={32} />} label="IMM" sub="Gobierno / Intendencia" />
                                                    <OriginPickerButton active={originType === "POLICIA"} onClick={() => { setOriginType("POLICIA"); setShowOriginPicker(false); playTactileSound(); }} icon={<Shield size={32} />} label="Policía" sub="Seguridad / Oficial" />
                                                    <OriginPickerButton active={originType === "BOMBEROS"} onClick={() => { setOriginType("BOMBEROS"); setShowOriginPicker(false); playTactileSound(); }} icon={<Flame size={32} />} label="Bomberos" sub="Emergencia Fuego" />
                                                    <OriginPickerButton active={originType === "AMBULANCIA"} onClick={() => { setOriginType("AMBULANCIA"); setShowOriginPicker(false); playTactileSound(); }} icon={<Plus size={32} />} label="Ambulancia" sub="Emergencia Médica" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* CONTROL BAR (Classification, Unit, Vehicle, Media, Finish) */}
                                <div className="fixed top-1/2 -translate-y-1/2 right-6 z-[90]">
                                    <div className="flex flex-col gap-3 bg-white/95 backdrop-blur-3xl p-3 rounded-[3rem] border border-black/20 shadow-2xl">
                                        {/* Classification Button - Dynamic Icon */}
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setShowOriginPicker(true)}
                                            className="w-16 h-16 rounded-[1.8rem] flex items-center justify-center transition-all text-black/60 hover:text-black"
                                        >
                                            {originType === "PARTICULAR" && <UserCheck size={22} />}
                                            {originType === "EMPRESA" && <Briefcase size={22} />}
                                            {originType === "IMM" && <Landmark size={22} />}
                                            {originType === "POLICIA" && <Shield size={22} />}
                                            {originType === "BOMBEROS" && <Flame size={22} />}
                                            {originType === "AMBULANCIA" && <Plus size={22} />}
                                        </motion.button>

                                        {/* Unit Picker Button - Dynamic Icon/Number */}
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setShowUnitPicker(true)}
                                            className="w-16 h-16 rounded-[1.8rem] flex items-center justify-center transition-all text-black/60 hover:text-black relative"
                                        >
                                            {selectedUnit ? (
                                                <span className="text-lg font-black">{selectedUnit.number || selectedUnit.name.substring(0, 2)}</span>
                                            ) : (
                                                <Building2 size={22} />
                                            )}
                                        </motion.button>

                                        <div className="h-px bg-black/10 mx-2" />

                                        {/* Auto Button */}
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => { playTactileSound(); setVehicleType("AUTO"); }}
                                            className={cn(
                                                "w-16 h-16 rounded-[1.8rem] flex flex-col items-center justify-center gap-1 transition-all",
                                                vehicleType === "AUTO"
                                                    ? "text-[#B20D30]"
                                                    : "text-black/20 hover:text-black"
                                            )}
                                        >
                                            <Car size={20} />
                                            <span className="text-[7px] font-black uppercase tracking-tighter">Auto</span>
                                        </motion.button>

                                        {/* Moto Button */}
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => { playTactileSound(); setVehicleType("MOTO"); }}
                                            className={cn(
                                                "w-16 h-16 rounded-[1.8rem] flex flex-col items-center justify-center gap-1 transition-all",
                                                vehicleType === "MOTO"
                                                    ? "text-[#B20D30]"
                                                    : "text-black/20 hover:text-black"
                                            )}
                                        >
                                            <Bike size={20} />
                                            <span className="text-[7px] font-black uppercase tracking-tighter">Moto</span>
                                        </motion.button>

                                        <div className="h-px bg-black/10 mx-2" />

                                        {/* Camera Button - Fixed Dark Background */}
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setIsCameraActive(true)}
                                            className="w-16 h-16 rounded-[1.8rem] flex items-center justify-center transition-all bg-slate-800 text-white hover:bg-slate-700"
                                        >
                                            <Camera size={22} />
                                        </motion.button>

                                        {/* Audio Recording Button - Fixed Dark Background */}
                                        <AudioRecordingFloatingButton
                                            isRecording={isRecording}
                                            audioUrl={audioUrl}
                                            onStart={startRecording}
                                            onStop={stopRecording}
                                            onClear={() => { setAudioUrl(null); setAudioBlob(null); }}
                                        />

                                        <div className="h-px bg-black/10 mx-2" />

                                        {/* Finish Button - Highlighted */}
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            disabled={isSubmitting || !plate.trim()}
                                            onClick={() => { playTactileSound(); handleSubmit(); }}
                                            className={cn(
                                                "w-16 h-16 rounded-[1.8rem] flex items-center justify-center transition-all shadow-lg",
                                                type === "ENTRY" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-orange-600 hover:bg-orange-700 text-white",
                                                "disabled:opacity-30 disabled:cursor-not-allowed"
                                            )}
                                        >
                                            {isSubmitting ? <Loader2 className="animate-spin" size={22} /> : <CheckCircle2 size={24} />}
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === "alerts" && (
                            <motion.div key="alerts" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="h-full w-full flex flex-col items-center justify-center gap-6 pb-40">
                                <div className="w-24 h-24 rounded-[2.5rem] bg-white border border-black transition-all duration-300 flex items-center justify-center text-black/20 shadow-sm">
                                    <Bell size={44} />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-black uppercase tracking-tighter mb-2 text-black">Sin Notificaciones Críticas</h3>
                                    <p className="text-[10px] text-black/40 font-black uppercase tracking-widest leading-relaxed">El sistema de seguridad operativa <br /> está funcionando en condiciones normales.</p>
                                </div>
                            </motion.div>
                        )}
                        {activeTab === "history" && (
                            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full w-full overflow-y-auto px-8 pt-6 pb-40 custom-scrollbar">
                                <div className="max-w-7xl mx-auto space-y-8">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 bg-slate-50/95 backdrop-blur-md py-6 z-30 gap-6">
                                        <div>
                                            <h2 className="text-3xl font-black uppercase tracking-tighter text-black leading-none">Bitácora Digital</h2>
                                            <p className="text-[10px] text-black/40 font-black uppercase tracking-[0.3em] mt-2">Registros de ingreso y salida en tiempo real</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/30" size={20} />
                                                <Input placeholder="FILTRAR POR MATRÍCULA..." className="pl-12 h-14 w-80 bg-white border border-black transition-all duration-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all focus:border-[#B20D30]/50 shadow-sm" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white border-2 border-black rounded-[3rem] overflow-hidden shadow-2xl">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-black border-b-4 border-black shadow-lg">
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Foto</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Matrícula</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Sujeto</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Destino</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Tipo</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Fecha/Hora</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {entries.map((entry) => (
                                                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="w-16 h-12 rounded-lg bg-slate-100 overflow-hidden relative border border-black transition-all duration-300">
                                                                {entry.photoPath ? (
                                                                    <Image src={entry.photoPath} alt="Log" fill className="object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                                        <ImageIcon size={16} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-sm font-black text-black uppercase">{entry.plate || "--- ---"}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-black uppercase">{entry.name || "Identidad Reservada"}</span>
                                                                <span className="text-[9px] text-black/40 font-bold">{entry.dni || "Sin ID"}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs font-black text-[#B20D30] uppercase">{entry.destination || "---"}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className={cn(
                                                                "inline-flex px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter",
                                                                entry.type === "ENTRY" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                                                            )}>
                                                                {entry.type === "ENTRY" ? "Ingreso" : "Egreso"}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-black whitespace-nowrap">
                                                                    {new Date(entry.createdAt).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })}
                                                                </span>
                                                                <span className="text-[10px] font-black text-black/40">
                                                                    {new Date(entry.createdAt).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {entry.audioPath && (
                                                                    <button onClick={() => new Audio(entry.audioPath).play()} className="p-2 rounded-lg hover:bg-blue-50 text-black/20 hover:text-blue-500 transition-all">
                                                                        <Volume2 size={16} />
                                                                    </button>
                                                                )}
                                                                <button onClick={() => handleDelete(entry.id)} className="p-2 rounded-lg hover:bg-red-50 text-black/20 hover:text-[#B20D30] transition-all">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>

                {/* FIXED FOOTER NAVIGATION - IMPROVED DESIGN */}
                <footer className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white to-white/95 backdrop-blur-2xl border-t-2 border-black transition-all duration-300/80 flex items-center justify-between px-8 z-[100] shadow-[0_-20px_60px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 flex items-center justify-center shrink-0 bg-gradient-to-br from-slate-50 to-white rounded-2xl border-2 border-black transition-all duration-300 shadow-sm">
                            <Image src="/logo-transparent.png" alt="Logo" width={100} height={100} className="object-contain" />
                        </div>
                        <div className="hidden xl:block">
                            <h1 className="text-base font-black tracking-tight uppercase text-black leading-none">OmniAccess</h1>
                            <p className="text-[8px] font-black text-[#B20D30] uppercase tracking-widest mt-1">Console v2.1</p>
                        </div>
                    </div>

                    <nav className="bg-gradient-to-br from-slate-100 to-slate-50 border-2 border-black transition-all duration-300/80 rounded-[1.5rem] p-2 flex items-center gap-2 shadow-lg">
                        <BottomTab icon={<FileText size={20} />} active={activeTab === "control"} onClick={() => handleTabChange("control")} label="Acceso" small />
                        <BottomTab icon={<HistoryIcon size={20} />} active={activeTab === "history"} onClick={() => handleTabChange("history")} label="Historial" small />
                        <BottomTab icon={<Bell size={20} />} active={activeTab === "alerts"} onClick={() => handleTabChange("alerts")} label="Alertas" small />
                    </nav>

                    <div className="flex items-center gap-6">
                        <div className="hidden lg:flex flex-col items-end mr-3">
                            <p className="text-2xl font-black tabular-nums tracking-tighter text-[#B20D30] leading-none mb-1">{currentTime.toLocaleTimeString('es-UY', { hour12: false, hour: '2-digit', minute: '2-digit' })}</p>
                            <p className="text-[9px] text-black/40 font-black uppercase tracking-widest leading-none">{currentTime.toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { playTactileSound(); }}
                                className="flex items-center gap-3 pl-2 pr-5 h-14 rounded-[1.25rem] bg-gradient-to-br from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 transition-all border-2 border-black transition-all duration-300 group active:scale-95 shadow-md"
                            >
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B20D30] to-[#E53935] flex items-center justify-center shadow-lg">
                                    <span className="text-[10px] font-black text-white">{guardName?.substring(0, 2) || "GA"}</span>
                                </div>
                                <div className="text-left hidden sm:block">
                                    <p className="text-[10px] font-black text-black uppercase leading-none tracking-tight">{guardName || "GUARDIA"}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
                                        <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Online</p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={handleLogout}
                                className="w-14 h-14 rounded-[1.25rem] bg-white border-2 border-black transition-all duration-300 text-black/40 hover:text-[#B20D30] hover:border-[#B20D30]/20 flex items-center justify-center transition-all active:scale-95"
                                title="Cerrar Sesión"
                            >
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>
                </footer>
            </main >

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.1); }
            `}</style>
        </div >
    );
}
function BottomTab({ icon, active, onClick, label, small }: any) {
    return (
        <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
                const audio = new AudioContext();
                const osc = audio.createOscillator();
                const gain = audio.createGain();
                osc.frequency.value = 400;
                gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.1);
                osc.connect(gain);
                gain.connect(audio.destination);
                osc.start();
                osc.stop(audio.currentTime + 0.1);
                onClick();
            }}
            className={cn(
                small ? "w-24 h-16" : "w-20 md:w-28 h-18",
                "rounded-[1.25rem] flex flex-col items-center justify-center gap-1.5 transition-all relative overflow-hidden",
                active ? "text-[#B20D30]" : "text-black/40 hover:text-black hover:bg-white/60"
            )}
        >
            <div className={cn("relative z-10 transition-all duration-300", active && "scale-110")}>
                {icon}
            </div>
            <span className={cn(
                small ? "text-[8px]" : "text-[9px]",
                "font-black uppercase tracking-widest relative z-10 transition-all duration-300",
                active ? "opacity-100 translate-y-0" : "opacity-60 translate-y-1"
            )}>
                {label}
            </span>

            {active && (
                <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-gradient-to-br from-[#B20D30]/10 to-[#B20D30]/5 rounded-[1.25rem] border-2 border-[#B20D30]/20 shadow-lg"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
                />
            )}
        </motion.button>
    );
}

function OriginButton({ active, onClick, icon, label, activeClass }: any) {
    return (
        <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
                const audio = new AudioContext();
                const osc = audio.createOscillator();
                const gain = audio.createGain();
                osc.frequency.value = 500;
                gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.1);
                osc.connect(gain);
                gain.connect(audio.destination);
                osc.start();
                osc.stop(audio.currentTime + 0.1);
                onClick();
            }}
            className={cn(
                "h-20 rounded-[1.25rem] border-2 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative overflow-hidden shadow-sm",
                active ? activeClass : "bg-white border-black transition-all duration-300 text-black/40 hover:bg-slate-50 hover:border-slate-300"
            )}
        >
            <div className={cn("transition-transform duration-300", active && "scale-110")}>
                {icon}
            </div>
            <span className="font-black text-[10px] uppercase tracking-widest">{label}</span>
            {active && (
                <div className="absolute top-0 right-0 w-8 h-8 bg-white/10 rounded-full -mr-4 -mt-4 transition-all" />
            )}
        </motion.button>
    );
}

function AudioRecordingButton({ isRecording, audioUrl, onStart, onStop, onClear }: any) {
    return (
        <div className="flex flex-col items-center gap-2">
            {!audioUrl ? (
                <button
                    onClick={isRecording ? onStop : onStart}
                    className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative shadow-lg border-2",
                        isRecording ? "bg-[#B20D30] border-[#B20D30]" : "bg-white border-black transition-all duration-300 text-black/40 hover:bg-slate-50"
                    )}
                >
                    {isRecording ? (
                        <>
                            <motion.div
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="absolute inset-0 bg-white/40 rounded-2xl"
                            />
                            <Square size={20} className="relative z-10 text-white fill-white" />
                        </>
                    ) : (
                        <Mic size={20} />
                    )}
                </button>
            ) : (
                <div className="flex flex-col gap-3">
                    <button className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg border-2 border-emerald-400 active:scale-95 transition-all">
                        <Volume2 size={20} />
                    </button>
                    <button onClick={onClear} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-black/40 hover:text-[#B20D30] hover:bg-red-50 transition-colors mx-auto">
                        <X size={16} />
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
        <div className="space-y-4">
            <Label className="text-xs font-black uppercase text-black tracking-[0.3em] flex items-center gap-3 ml-2">
                <div className="p-2.5 rounded-xl bg-black text-white shadow-md">{icon}</div> {label}
            </Label>
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-20 bg-white border border-black/20 focus:ring-4 focus:ring-[#B20D30]/20 rounded-2xl text-black font-black text-lg tracking-wide px-10 placeholder:text-black/20 transition-all shadow-sm"
            />
        </div>
    );
}

function SensorStatus({ label, active }: { label: string, active: boolean }) {
    return (
        <div className="flex items-center justify-between group cursor-help">
            <span className="text-[11px] font-black uppercase tracking-tight text-black/40 group-hover:text-black transition-colors">{label}</span>
            <div className={cn("w-2.5 h-2.5 rounded-full border-2 border-white ring-2 transition-all duration-500", active ? "bg-[#B20D30] ring-[#B20D30]/20" : "bg-slate-200 ring-transparent")} />
        </div>
    );
}

function HistoryItem({ entry, onDelete }: any) {
    return (
        <motion.div whileHover={{ y: -8 }} className="bg-white border-2 border-slate-100 rounded-[2.5rem] overflow-hidden group shadow-sm hover:shadow-xl hover:border-[#B20D30]/20 transition-all duration-500">
            <div className="aspect-[4/3] relative overflow-hidden bg-slate-50 border-b-2 border-slate-100">
                {entry.photoPath ? (
                    <Image src={entry.photoPath} alt="Log" fill className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-black/20">
                        <ImageIcon size={48} strokeWidth={1} />
                    </div>
                )}
                <div className={cn("absolute top-6 left-6 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg backdrop-blur-md", entry.type === "ENTRY" ? "bg-[#B20D30] text-white" : "bg-orange-500 text-white")}>
                    {entry.type === "ENTRY" ? "Ingreso" : "Egreso"}
                </div>
            </div>
            <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-2xl font-black text-black tracking-tighter uppercase">{entry.plate || "S/ Placa"}</h4>
                    <div className="flex items-center gap-2">
                        {entry.audioPath && (
                            <button onClick={() => {
                                const audio = new Audio(entry.audioPath);
                                audio.play();
                            }} className="w-10 h-10 rounded-xl bg-slate-50 text-black/40 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center">
                                <Volume2 size={18} />
                            </button>
                        )}
                        <button onClick={() => onDelete(entry.id)} className="w-10 h-10 rounded-xl bg-slate-50 text-black/40 hover:text-[#B20D30] hover:bg-red-50 transition-all flex items-center justify-center">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                    <div>
                        <p className="text-[10px] font-black text-black/40 uppercase tracking-widest leading-none mb-2">Sujeto</p>
                        <p className="text-xs font-black text-black uppercase truncate">{entry.name || "Identidad Reservada"}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-black/40 uppercase tracking-widest leading-none mb-2">Destino</p>
                        <p className="text-xs font-black text-[#B20D30] uppercase truncate">{entry.destination || "Sin Destino"}</p>
                    </div>
                    {entry.latitude && (
                        <div className="col-span-2 mt-2 pt-4 border-t-2 border-slate-50 flex items-center gap-2 text-[9px] text-black/30 font-black uppercase tracking-widest">
                            <MapPin size={12} className="text-[#B20D30]" />
                            <span>Geo-Data: {entry.latitude.toFixed(4)}, {entry.longitude.toFixed(4)}</span>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function AudioRecordingFloatingButton({ isRecording, audioUrl, onStart, onStop, onClear }: any) {
    return (
        <>
            {!audioUrl ? (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={isRecording ? onStop : onStart}
                    className={cn(
                        "w-16 h-16 rounded-[1.8rem] flex items-center justify-center transition-all",
                        isRecording ? "bg-red-600 text-white hover:bg-red-700" : "bg-slate-800 text-white hover:bg-slate-700"
                    )}
                >
                    {isRecording ? (
                        <>
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                                transition={{ repeat: Infinity, duration: 1 }}
                                className="absolute inset-0 bg-white rounded-[1.8rem]"
                            />
                            <Square size={22} className="relative z-10 fill-white" />
                        </>
                    ) : (
                        <Mic size={22} />
                    )}
                </motion.button>
            ) : (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClear}
                    className="w-16 h-16 rounded-[1.8rem] flex items-center justify-center transition-all bg-emerald-600 text-white hover:bg-emerald-700"
                >
                    <Volume2 size={22} />
                </motion.button>
            )}
            {/* AUDIO RECORDING OVERLAY - FULLSCREEN */}
            {isRecording && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-gradient-to-br from-red-900 via-red-800 to-black z-[200] flex flex-col items-center justify-center"
                >
                    {/* Header */}
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
                        <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-8 py-4 rounded-3xl flex items-center gap-4">
                            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                            <span className="text-white font-black text-xl uppercase tracking-widest">Grabando Audio</span>
                        </div>
                    </div>

                    {/* Animated Waveform */}
                    <div className="flex gap-3 items-center h-64">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                            <motion.div
                                key={i}
                                animate={{ height: [40, 200, 40] }}
                                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                                className="w-4 bg-white rounded-full shadow-2xl"
                            />
                        ))}
                    </div>

                    {/* Microphone Icon */}
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="mt-12"
                    >
                        <Mic size={80} className="text-white drop-shadow-2xl" />
                    </motion.div>

                    {/* Controls */}
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-6 z-10">
                        {/* Stop Recording Button */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onStop}
                            className="w-24 h-24 rounded-full bg-white border-8 border-white/30 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"
                        >
                            <Square size={32} className="text-red-600" fill="currentColor" />
                        </motion.button>

                        {/* Cancel Button */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                onStop(); // Stop recording
                                onClear(); // Clear the audio
                            }}
                            className="w-20 h-20 rounded-full bg-black/50 border-4 border-white/30 shadow-2xl flex items-center justify-center hover:bg-black/70 transition-colors"
                        >
                            <X size={28} className="text-white" />
                        </motion.button>
                    </div>
                </motion.div>
            )}
        </>
    );
}

function RollingCharacter({ char, isFocused }: { char: string, isFocused: boolean }) {
    return (
        <div className={cn(
            "w-10 h-16 sm:w-12 sm:h-20 md:w-20 md:h-28 bg-white rounded-2xl flex items-center justify-center border-4 transition-all duration-300",
            isFocused ? "border-[#B20D30] bg-[#B20D30]/5 shadow-[0_10px_30px_rgba(178,13,48,0.15)] scale-110 z-10" : "border-black text-black"
        )}>
            <span className={cn(
                "text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter",
                isFocused ? "text-[#B20D30]" : "text-black",
                char === " " && "opacity-10"
            )}>
                {char === " " ? "•" : char}
            </span>
        </div>
    );
}

function TactilePlateInput({ value, onChange }: { value: string, onChange: (v: string) => void }) {
    const chars = value.padEnd(7, " ").substring(0, 7).split("");
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="w-full flex flex-col gap-4 items-center">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onKeyDown={() => {
                    try {
                        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.frequency.setValueAtTime(600, ctx.currentTime);
                        gain.gain.setValueAtTime(0.02, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.05);
                    } catch (e) { }
                }}
                onChange={(e) => onChange(e.target.value.toUpperCase().substring(0, 7))}
                className="absolute opacity-0 pointer-events-none h-0 w-0"
                autoFocus
            />

            <div
                className="flex gap-1 sm:gap-2 items-center cursor-pointer perspective-[1000px]"
                onClick={() => inputRef.current?.focus()}
            >
                {chars.map((char, i) => (
                    <RollingCharacter
                        key={i}
                        char={char}
                        isFocused={value.length === i && value.length < 7}
                    />
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white border-2 border-slate-200 px-8 py-3 rounded-2xl shadow-sm"
            >
                <p className="text-[10px] font-black text-[#B20D30] uppercase tracking-[0.4em]">Toque para Editar Matrícula</p>
            </motion.div>
        </div>
    );
}

function DeviceEntry({ name, status }: { name: string, status: string }) {
    return (
        <div className="flex items-center gap-4 px-2 py-1 group cursor-default">
            <div className={cn("w-2 h-2 rounded-full border-2 border-white ring-2 ring-transparent transition-all", status === 'active' ? "bg-emerald-500 ring-emerald-500/20" : "bg-blue-500 ring-blue-500/20")} />
            <span className="text-[10px] font-black text-black font-black uppercase tracking-widest group-hover:text-black transition-colors">{name}</span>
        </div>
    );
}

function OriginPickerButton({ active, onClick, icon, label, sub }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, sub: string }) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={cn(
                "h-56 rounded-[2.5rem] border-2 flex flex-col items-center justify-center gap-4 transition-all relative overflow-hidden group shadow-xl",
                active
                    ? "bg-black border-white text-white"
                    : "bg-white border-black text-black hover:bg-slate-50"
            )}
        >
            <div className={cn(
                "w-20 h-20 rounded-3xl flex items-center justify-center transition-all",
                active ? "bg-white text-black" : "bg-black text-white group-hover:scale-110"
            )}>
                {icon}
            </div>
            <div className="text-center">
                <p className="text-2xl font-black uppercase tracking-tighter">{label}</p>
                <p className={cn("text-[9px] font-black uppercase tracking-widest mt-1", active ? "text-white/40" : "text-black/30")}>{sub}</p>
            </div>
            {active && (
                <div className="absolute top-4 right-4">
                    <CheckCircle2 size={24} className="text-white" />
                </div>
            )}
        </motion.button>
    );
}
