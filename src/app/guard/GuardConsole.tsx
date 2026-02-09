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
    Map as MapIcon,
    ShieldAlert,
    Navigation,
    UserCheck,
    UserX,
    CarFront,
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
    Maximize2,
    Calendar,
    Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createBitacoraEntry, deleteBitacoraEntry, getBitacoraPage } from "@/app/actions/bitacora";
import { getAccessEvents, getPlateAnalysis } from "@/app/actions/history";
import { getQuickCreateData } from "@/app/actions/users";
import { UserFormDialog } from "@/components/UserFormDialog";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import { useInView } from "react-intersection-observer";
import { saveGuardBranding, uploadBrandingFile } from "@/app/actions/settings";

import dynamic from 'next/dynamic';
const LiveGuardMap = dynamic(() => import('@/components/LiveGuardMap'), { ssr: false });

interface GuardConsoleProps {
    initialEntries: any[];
    logo: string;
    headerColor: string;
    initialIcons: Record<string, string>;
    units: any[];
}

type TabType = "control" | "history" | "alerts" | "lpr" | "map";


export default function GuardConsole({ initialEntries, logo, headerColor, initialIcons, units }: GuardConsoleProps) {
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
    const [monitoringMissions, setMonitoringMissions] = useState<any[]>([]); // For observing multiple ongoing alerts
    const [guardName, setGuardName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
    const [showAlarmSplash, setShowAlarmSplash] = useState(false);
    const isFirstAlertStatusReceived = useRef(false);
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isAlertMode, setIsAlertMode] = useState(false);
    const [alertStartTime, setAlertStartTime] = useState<Date | null>(null);
    const [historyPage, setHistoryPage] = useState(0);
    const [historySearch, setHistorySearch] = useState("");
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [notification, setNotification] = useState<{ type: "success" | "error" | "info" | "alert", title: string, message: string } | null>(null);

    // LPR History state
    const [lprEntries, setLprEntries] = useState<any[]>([]);
    const [isLprLoading, setIsLprLoading] = useState(false);
    const [lprSearch, setLprSearch] = useState("");
    const [lprDate, setLprDate] = useState(new Date().toISOString().split('T')[0]);

    // Alerts History state
    const [alertsSearch, setAlertsSearch] = useState("");
    const [alertsDate, setAlertsDate] = useState(new Date().toISOString().split('T')[0]);

    // Image Viewer state
    const [viewerData, setViewerData] = useState<{
        url: string,
        plate?: string,
        name?: string,
        unit?: string,
        direction?: string,
        confidence?: number,
        timestamp?: string,
        deviceName?: string
    } | null>(null);
    const viewerImage = viewerData?.url || null;
    const setViewerImage = (url: string | null) => setViewerData(url ? { url } : null);

    // Plate Analysis state
    const [plateAnalysis, setPlateAnalysis] = useState<any>(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);

    // Quick Create States
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [quickCreateContext, setQuickCreateContext] = useState<any>(null);
    const [quickCreateData, setQuickCreateData] = useState<any>(null);
    const [loadingQuickCreateData, setLoadingQuickCreateData] = useState(false);

    // Alert Normalization Modal
    const [showNormalizationModal, setShowNormalizationModal] = useState(false);
    const [normalizationText, setNormalizationText] = useState("");

    // Settings / Configuration
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [customLogo, setCustomLogo] = useState<string | null>(logo);
    const [customHeaderColor, setCustomHeaderColor] = useState<string>(headerColor);
    const [customIcons, setCustomIcons] = useState<Record<string, string>>(initialIcons);
    const [isSavingBranding, setIsSavingBranding] = useState(false);

    const [guardPhoto, setGuardPhoto] = useState<string | null>(null);

    useEffect(() => {
        // We still support local guard photo, but branding is now server-side
        const savedPhoto = localStorage.getItem("guard_photo");
        if (savedPhoto) setGuardPhoto(savedPhoto);
    }, []);

    // Refs for socket listeners to access current state
    const lprSearchRef = useRef(lprSearch);
    const lprDateRef = useRef(lprDate);
    const activeTabRef = useRef(activeTab);

    useEffect(() => { lprSearchRef.current = lprSearch; }, [lprSearch]);
    useEffect(() => { lprDateRef.current = lprDate; }, [lprDate]);
    useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

    // MAP & GPS STATES
    const [myLocation, setMyLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [otherGuards, setOtherGuards] = useState<any[]>([]);

    // UNIT VEHICLE PROMPT
    const [showVehiclePrompt, setShowVehiclePrompt] = useState(false);
    const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);

    // PROFILE MENU
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showCameraModal, setShowCameraModal] = useState(false);

    // BACKUP REQUEST STATES
    const [backupLocation, setBackupLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [incomingBackup, setIncomingBackup] = useState<any>(null);
    const [activeMission, setActiveMission] = useState<any>(null);
    const [showResolutionModal, setShowResolutionModal] = useState(false);
    const [backupDetail, setBackupDetail] = useState("");

    // Audio States
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Audio recording timer state
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Profile Camera Refs
    const profileVideoRef = useRef<HTMLVideoElement>(null);
    const profileCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (isRecording) {
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        }
        return () => { if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); };
    }, [isRecording]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Load plate analysis when viewer opens with a plate
    useEffect(() => {
        if (viewerData?.plate && viewerData.plate !== '--- ---') {
            setLoadingAnalysis(true);
            getPlateAnalysis(viewerData.plate).then(analysis => {
                setPlateAnalysis(analysis);
                setLoadingAnalysis(false);
            }).catch(() => {
                setLoadingAnalysis(false);
            });
        } else {
            setPlateAnalysis(null);
        }
    }, [viewerData?.plate]);

    const { ref: loadMoreRef, inView } = useInView({
        threshold: 0.5,
    });

    const alarmAudioRef = useRef<HTMLAudioElement | null>(null);

    // Show Notification Screen
    const showNotification = (title: string, message: string, type: "success" | "error" | "info" | "alert" = "success", duration: number = 2000) => {
        setNotification({ type, title, message });
        setTimeout(() => setNotification(null), duration);
    };

    // Profile Camera Logic
    useEffect(() => {
        let stream: MediaStream | null = null;
        if (showCameraModal) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
                .then(s => {
                    stream = s;
                    if (profileVideoRef.current) profileVideoRef.current.srcObject = s;
                })
                .catch(err => console.error("Profile camera error:", err));
        }
        return () => {
            if (stream) stream.getTracks().forEach(track => track.stop());
        };
    }, [showCameraModal]);

    const captureProfilePhoto = () => {
        if (profileVideoRef.current && profileCanvasRef.current) {
            const video = profileVideoRef.current;
            const canvas = profileCanvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                // Flip horizontally for mirror effect if needed
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0);
                const dataUrl = canvas.toDataURL("image/jpeg");
                setGuardPhoto(dataUrl);
                localStorage.setItem("guard_photo", dataUrl);
                setShowCameraModal(false);
                playTactileSound();
            }
        }
    };

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
            if (newSocket.connected) {
                newSocket.emit('guard_presence', {
                    guardName: guardName || 'Invitado',
                    status: 'online',
                    timestamp: new Date().toISOString(),
                    reportedIp: detectedLocalIp // Send the IP we found
                });
            }
        }, 4000);

        newSocket.on('alert_status', (data: any) => {
            const previousState = isAlertMode;
            setIsAlertMode(data.active);

            // Solo mostrar notificaciones si no es la primera vez (evita mensaje al recargar)
            if (!isFirstAlertStatusReceived.current) {
                isFirstAlertStatusReceived.current = true;
                return;
            }

            if (data.active) {
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("⚠️ ALERTA DE SEGURIDAD", {
                        body: `Modo de alerta activado por ${data.triggeredBy || "un compañero"}.`,
                        icon: "/icons/sildan-icon-dot.png",
                        tag: "security-alert"
                    });
                }
                if ('setAppBadge' in navigator) (navigator as any).setAppBadge(1).catch(() => { });
                setShowAlarmSplash(true);
                setTimeout(() => setShowAlarmSplash(false), 4000);
            } else if (previousState) {
                const message = data.explanation
                    ? `La alerta ha sido desactivada. Motivo: ${data.explanation}`
                    : "La alerta de seguridad ha sido desactivada correctamente.";
                showNotification("SISTEMA NORMALIZADO", message, "success", 50000);
                if ('clearAppBadge' in navigator) (navigator as any).clearAppBadge().catch(() => { });
            }
        });

        newSocket.on('new_bitacora', (entry: any) => {
            setEntries(prev => {
                if (prev.some(e => e.id === entry.id)) return prev;
                return [entry, ...prev];
            });
        });

        newSocket.on('NEW_ACCESS', (event: any) => {
            const isLpr = activeTabRef.current === "lpr";
            // Check if the event matches the current date filter
            const eventDate = new Date(event.timestamp).toISOString().split('T')[0];
            const isSameDate = lprDateRef.current === eventDate;

            // Check search filter
            const search = lprSearchRef.current.toUpperCase();
            const matchesSearch = !search ||
                (event.plateDetected || "").toUpperCase().includes(search) ||
                (event.user?.name || "").toUpperCase().includes(search) ||
                (event.user?.unit?.name || "").toUpperCase().includes(search);

            if (isLpr && isSameDate && matchesSearch && (event.accessType === "PLATE" || event.plateDetected)) {
                setLprEntries(prev => {
                    if (prev.find(e => e.id === event.id)) return prev;
                    return [event, ...prev];
                });
            }
        });

        // MISSION & BACKUP LISTENERS (CONSOLIDATED)
        newSocket.on('active_missions', (data: any[]) => {
            setMonitoringMissions(data);
        });

        newSocket.on('backup_requested', (data: any) => {
            setIncomingBackup(data);
            setMonitoringMissions(prev => {
                if (prev.find(m => m.id === data.id)) return prev;
                return [...prev, data];
            });
            if ('setAppBadge' in navigator) (navigator as any).setAppBadge(1).catch(() => { });
            if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 500]);
            playTactileSound();
        });

        newSocket.on('backup_status_update', (data: any) => {
            setActiveMission((prev: any) => {
                if (prev && (prev.id === data.requestId)) {
                    return { ...prev, status: data.accepted ? 'ACCEPTED' : 'REJECTED', responderId: data.responderId, responderName: data.responderName };
                }
                return prev;
            });
            setMonitoringMissions(prev => prev.map(m =>
                m.id === data.requestId
                    ? { ...m, status: data.accepted ? 'ACCEPTED' : 'REJECTED', responderId: data.responderId, responderName: data.responderName }
                    : m
            ));
            if (data.accepted) {
                showNotification("APOYO EN CAMINO", `${data.responderName} ha aceptado la solicitud.`, "success");
                setIncomingBackup(null);
            }
        });

        newSocket.on('backup_resolved', (data: any) => {
            setActiveMission((prev: any) => prev?.id === data.requestId ? null : prev);
            setMonitoringMissions(prev => prev.filter(m => m.id !== data.requestId));
            setIncomingBackup(null);
            showNotification("ALERTA FINALIZADA", `El incidente ha sido gestionado por ${data.resolverName}.`, "success", 5000);
            if ('clearAppBadge' in navigator) (navigator as any).clearAppBadge().catch(() => { });
        });

        newSocket.on('backup_cancelled', (data: any) => {
            setActiveMission((prev: any) => prev?.id === data.requestId ? null : prev);
            setMonitoringMissions(prev => prev.filter(m => m.id !== data.requestId));
            setIncomingBackup(null);
            showNotification("ALERTA CANCELADA", `La alerta fue cancelada por ${data.cancelledBy}.`, "info");
        });

        newSocket.on('guard_locations', (data: any) => {
            setOtherGuards(data);
        });

        // GPS WATCHER (CONTINUOUS IN BACKGROUND)
        let watchId: number | null = null;
        if ("geolocation" in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    setMyLocation({ lat: latitude, lng: longitude });
                    if (newSocket && newSocket.connected) {
                        try {
                            const storedName = localStorage.getItem("guardName");
                            newSocket.emit('guard_location_update', {
                                lat: latitude,
                                lng: longitude,
                                accuracy,
                                guardName: storedName || guardName || "Operario",
                                timestamp: Date.now()
                            });
                        } catch (e) {
                            console.error("Socket emit error", e);
                        }
                    }
                },
                (error) => console.error("GPS Error:", error),
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 10000
                }
            );
        }

        return () => {
            clearInterval(heartBeat);
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            newSocket.disconnect();
        };
    }, [guardName]);


    // Notification Permission Request
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    const handleQuickCreateClick = async (data: { plate?: string, cara?: string, name?: string }) => {
        setQuickCreateContext(data);
        if (quickCreateData) {
            setShowQuickCreate(true);
            return;
        }

        setLoadingQuickCreateData(true);
        try {
            const data = await getQuickCreateData();
            setQuickCreateData(data);
            setShowQuickCreate(true);
        } catch (error) {
            console.error("Error fetching quick create data:", error);
            toast.error("Error al cargar datos de creación rápida");
        } finally {
            setLoadingQuickCreateData(false);
        }
    };

    // Alarm Audio Control
    useEffect(() => {
        if (isAlertMode) {
            // Create audio object if not exists
            if (!alarmAudioRef.current) {
                alarmAudioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"); // Standard alert sound
                alarmAudioRef.current.loop = true;
            }
            alarmAudioRef.current.play().catch(e => console.log("Audio play blocked", e));
        } else {
            if (alarmAudioRef.current) {
                alarmAudioRef.current.pause();
                alarmAudioRef.current.currentTime = 0;
            }
        }
    }, [isAlertMode]);

    // Vibration Feedback for Alerts
    useEffect(() => {
        let interval: any;
        if (isAlertMode && "vibrate" in navigator) {
            // Periodic strong vibration while alert is active
            interval = setInterval(() => {
                navigator.vibrate([500, 200, 500]);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isAlertMode]);

    const toggleAlertMode = (forcedState?: boolean, explanation?: string) => {
        if (!socket) return;
        const newState = forcedState !== undefined ? forcedState : !isAlertMode;
        socket.emit("alert_toggle", {
            active: newState,
            triggeredBy: guardName || "Invitado",
            explanation: explanation || ""
        });
    };

    // Panic Button Hold Logic
    const [panicHoldProgress, setPanicHoldProgress] = useState(0);
    const [deactivateHoldProgress, setDeactivateHoldProgress] = useState(0);
    const panicHoldRef = useRef<any>(null);
    const deactivateHoldRef = useRef<any>(null);

    const startPanicHold = () => {
        if (isAlertMode) return;
        playTactileSound();
        let start = Date.now();
        panicHoldRef.current = setInterval(() => {
            let elapsed = Date.now() - start;
            let progress = Math.min((elapsed / 1500) * 100, 100); // 1.5 seconds hold
            setPanicHoldProgress(progress);
            if (progress >= 100) {
                clearInterval(panicHoldRef.current);
                toggleAlertMode(true);
                setPanicHoldProgress(0);
                if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 400]);
            }
        }, 50);
    };

    const cancelPanicHold = () => {
        clearInterval(panicHoldRef.current);
        setPanicHoldProgress(0);
    };

    const startDeactivateHold = () => {
        if (!isAlertMode) return;
        playTactileSound();
        let start = Date.now();
        deactivateHoldRef.current = setInterval(() => {
            let elapsed = Date.now() - start;
            let progress = Math.min((elapsed / 2000) * 100, 100); // 2 seconds hold for deactivation
            setDeactivateHoldProgress(progress);
            if (progress >= 100) {
                clearInterval(deactivateHoldRef.current);
                setDeactivateHoldProgress(0);
                if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
                // Abrir modal para pedir explicación
                setShowNormalizationModal(true);
            }
        }, 50);
    };

    const cancelDeactivateHold = () => {
        clearInterval(deactivateHoldRef.current);
        setDeactivateHoldProgress(0);
    };

    const [showUnitPicker, setShowUnitPicker] = useState(false);
    const [showOriginPicker, setShowOriginPicker] = useState(false);
    const [unitSearch, setUnitSearch] = useState("");
    const [showUnitResults, setShowUnitResults] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState<any>(null);

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
            setShowProfileMenu(false); // Ensure menu is closed
            showNotification("BIENVENIDO", `Sesión iniciada como ${tempGuardName}. GuardConsole v2.1 activo.`, "success");
        }
    };

    const handleLogout = () => {
        setGuardName("");
        localStorage.removeItem("bitacora_guard_name");
        setShowIdentityOverlay(true);
        showNotification("SESIÓN CERRADA", "Se ha finalizado la sesión del guardia exitosamente.", "info");
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

    // INFINITE SCROLL EFFECT
    useEffect(() => {
        if (inView && hasMoreHistory && !isHistoryLoading && activeTab === "history") {
            loadMoreHistory();
        }
    }, [inView, hasMoreHistory, isHistoryLoading, activeTab]);

    const loadMoreHistory = async () => {
        setIsHistoryLoading(true);
        try {
            const nextPage = historyPage + 1;
            const newEntries = await getBitacoraPage(nextPage, 20, historySearch);
            if (newEntries.length < 20) setHasMoreHistory(false);
            setEntries(prev => [...prev, ...newEntries]);
            setHistoryPage(nextPage);
        } catch (error) {
            console.error("Error loading more history:", error);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    // SEARCH HISTORY EFFECT
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (activeTab === "history") {
                setIsHistoryLoading(true);
                try {
                    const firstPage = await getBitacoraPage(0, 20, historySearch);
                    setEntries(firstPage);
                    setHistoryPage(0);
                    setHasMoreHistory(firstPage.length === 20);
                } catch (error) {
                    console.error("Search error:", error);
                } finally {
                    setIsHistoryLoading(false);
                }
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [historySearch, activeTab]);

    // FETCH LPR HISTORY EFFECT
    useEffect(() => {
        const fetchLPR = async () => {
            if (activeTab === "lpr") {
                setIsLprLoading(true);
                try {
                    const from = new Date(lprDate);
                    from.setHours(0, 0, 0, 0);
                    const to = new Date(lprDate);
                    to.setHours(23, 59, 59, 999);

                    const { events } = await getAccessEvents({
                        type: 'PLATE',
                        take: 50,
                        search: lprSearch,
                        from,
                        to
                    });
                    setLprEntries(events);
                } catch (error) {
                    console.error("LPR fetch error:", error);
                } finally {
                    setIsLprLoading(false);
                }
            }
        };
        const timer = setTimeout(fetchLPR, 500);
        return () => clearTimeout(timer);
    }, [activeTab, lprSearch, lprDate]);

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
        const cleanPlate = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (cleanPlate.length >= 4) {
            const match = entries.find(e => {
                const cleanEntryPlate = (e.plate || "").replace(/[^A-Z0-9]/gi, '').toUpperCase();
                return cleanEntryPlate === cleanPlate;
            });

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
            showNotification("DATOS VINCULADOS", `Se ha cargado la identidad de ${matchingEntry.name} automáticamente.`, "info", 2500);
            playTactileSound();
        }
    };

    // Camera Lifecycle
    useEffect(() => {
        async function startCamera() {
            if (!isCameraActive) return;

            // CHECK SECURE CONTEXT
            if (!window.isSecureContext) {
                const msg = "⚠️ NAVEGADOR BLOQUEA CÁMARA: El acceso debe ser por HTTPS para activar la visión artificial.";
                showNotification("ERROR DE SEGURIDAD", msg, "error", 5000);
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
                showNotification("ERROR DE CÁMARA", msg, "error");
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
            const msg = "⚠️ MICRÓFONO BLOQUEADO: Se requiere conexión segura HTTPS para capturar audio de seguridad.";
            showNotification("ERROR DE AUDIO", msg, "error", 5000);
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
            showNotification("ERROR DE MICRÓFONO", msg, "error");
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
            showNotification("MATRÍCULA REQUERIDA", "Debe ingresar una matrícula para continuar con el registro.", "error", 2500);
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

            const finalLocation = myLocation || location;
            if (finalLocation) {
                formData.append("latitude", finalLocation.lat.toString());
                formData.append("longitude", finalLocation.lng.toString());
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
                setPlate(""); setNotes(""); setName(""); setDni(""); setCompany("");
                setSelectedUnit(null); setUnitSearch("");
                setCapturedPhoto(null);
                setAudioBlob(null);
                setAudioUrl(null);
                setShowSuccessOverlay(false);
            }, 1500);
        } catch (err) {
            console.error("Submit error:", err);
            showNotification("ERROR DE REGISTRO", "No se pudo guardar la información. Intente nuevamente.", "error", 3000);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Está seguro de eliminar este registro?")) {
            try {
                await deleteBitacoraEntry(id);
                setEntries(prev => prev.filter((e: any) => e.id !== id));
                showNotification("REGISTRO ELIMINADO", "La entrada ha sido removida del historial.", "info");
            } catch (error) {
                showNotification("ERROR AL ELIMINAR", "Hubo un problema al procesar la solicitud.", "error");
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
                                    scale: [0.98, 1.02, 0.98],
                                    opacity: [0.8, 1, 0.8]
                                }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                                className="w-64 h-64 relative mb-12 p-4 flex items-center justify-center bg-white rounded-full shadow-inner"
                            >
                                <Image
                                    src={customLogo || logo || "/logo-transparent.png"}
                                    alt="Logo"
                                    width={200}
                                    height={200}
                                    className="object-contain drop-shadow-xl"
                                    priority
                                />
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 border-t-2 border-r-2 border-[#B20D30]/20 rounded-full"
                                />
                            </motion.div>

                            <div className="bg-white border-2 border-slate-100 transition-all duration-300 p-10 rounded-[4rem] shadow-2xl w-full flex flex-col items-center gap-10">
                                <div className="text-center">
                                    <div className="flex items-center justify-center gap-3 mb-4">
                                        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center">
                                            <Shield className="text-white" size={24} />
                                        </div>
                                        <h1 className="text-4xl font-black text-black uppercase tracking-tighter">SecureAccess</h1>
                                    </div>
                                    <p className="text-[12px] text-black/40 font-black uppercase tracking-[0.4em]">Consola de Seguridad</p>
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
                            <Image src={customLogo || logo || "/logo-transparent.png"} alt="Loading" width={160} height={160} className="object-contain" />
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

            {/* ALARM ACTIVATION SPLASH - PREMIUM OVERLAY */}
            <AnimatePresence>
                {showAlarmSplash && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[500] bg-[#B20D30] flex flex-col items-center justify-center text-white overflow-hidden"
                    >
                        {/* Dramatic pulsating rings behind the icon */}
                        <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute w-[600px] h-[600px] rounded-full border-[1px] border-white/20"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                            className="absolute w-[400px] h-[400px] rounded-full border-[2px] border-white/30"
                        />

                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", damping: 12 }}
                            className="w-48 h-48 rounded-[3rem] bg-white flex items-center justify-center text-[#B20D30] mb-10 shadow-[0_0_100px_rgba(255,255,255,0.4)] relative z-10"
                        >
                            <Siren size={100} strokeWidth={2.5} className="animate-bounce" />
                        </motion.div>

                        <div className="text-center relative z-10 space-y-4 px-10">
                            <motion.h2
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="text-6xl font-black uppercase tracking-tighter"
                            >
                                Emergencia Activada
                            </motion.h2>
                            <motion.p
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-xl font-black uppercase tracking-[0.4em] text-white/60"
                            >
                                Centro de Monitoreo Notificado
                            </motion.p>
                        </div>

                        {/* Animated Bottom Bar */}
                        <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 4, ease: "linear" }}
                            className="absolute bottom-0 left-0 right-0 h-4 bg-white/40 origin-left"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PANIC / ALERT CRITICAL OVERLAY (Persistent during alert) */}
            <AnimatePresence>
                {isAlertMode && !showAlarmSplash && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] bg-red-600/20 backdrop-blur-[2px] flex flex-col items-center justify-center"
                    >
                        <div className="absolute inset-0 border-[20px] border-red-600 animate-pulse pointer-events-none" />
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-red-600 to-transparent flex items-center justify-center px-10">
                            <div className="flex items-center gap-6 text-white">
                                <Siren size={48} className="animate-bounce" />
                                <div className="text-center">
                                    <h2 className="text-4xl font-black uppercase tracking-tighter">MODO ALERTA ACTIVO</h2>
                                    <p className="text-sm font-black text-white/80 uppercase tracking-widest mt-1">El centro de monitoreo ha sido notificado</p>
                                </div>
                                <Siren size={48} className="animate-bounce" />
                            </div>
                        </div>

                        {/* CENTRAL DEACTIVATE BUTTON */}
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative flex flex-col items-center gap-8"
                        >
                            <button
                                onMouseDown={startDeactivateHold}
                                onMouseUp={cancelDeactivateHold}
                                onMouseLeave={cancelDeactivateHold}
                                onTouchStart={startDeactivateHold}
                                onTouchEnd={cancelDeactivateHold}
                                className="w-56 h-56 rounded-full bg-white border-8 border-red-600 shadow-2xl flex flex-col items-center justify-center gap-4 relative overflow-hidden group active:scale-95 transition-transform"
                            >
                                <motion.div
                                    className="absolute bottom-0 left-0 right-0 bg-red-600/10 pointer-events-none"
                                    animate={{ height: `${deactivateHoldProgress}%` }}
                                    transition={{ duration: 0.1 }}
                                />

                                <Shield size={64} className={cn("text-red-600 transition-all duration-300", deactivateHoldProgress > 0 ? "scale-110" : "group-hover:scale-105")} />
                                <div className="text-center px-4 relative z-10">
                                    <p className="text-red-600 font-black text-xs uppercase tracking-widest">Normalizar</p>
                                    <p className="text-red-600 font-black text-[10px] uppercase opacity-40 mt-1">Mantener pulsado</p>
                                </div>

                                {/* Circular progress border */}
                                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="46"
                                        fill="none"
                                        stroke="#dc2626"
                                        strokeWidth="4"
                                        strokeDasharray="289"
                                        strokeDashoffset={289 - (289 * deactivateHoldProgress) / 100}
                                        className="transition-all duration-100"
                                    />
                                </svg>
                            </button>

                            <motion.div
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="px-6 py-2 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em]"
                            >
                                Protocolo de Seguridad Activo
                            </motion.div>
                        </motion.div>
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
                        {activeTab === "map" && (
                            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full w-full relative z-0">
                                <LiveGuardMap
                                    myLocation={myLocation}
                                    guards={otherGuards}
                                    socketId={socket?.id}
                                    onLongPress={(latlng) => {
                                        setBackupLocation(latlng);
                                        setShowBackupModal(true);
                                        playTactileSound();
                                    }}
                                    backupMissions={monitoringMissions.map(m => ({
                                        ...m,
                                        responderLocation: m.responderId === socket?.id
                                            ? myLocation
                                            : (otherGuards.find(g => g.socketId === m.responderId) || null)
                                    }))}
                                    onAlertClick={(mission) => {
                                        // Any guard can manage if it's PENDING or if they are involved
                                        setActiveMission(mission);
                                        setShowResolutionModal(true);
                                        setBackupDetail(mission.details || "");
                                    }}
                                />
                            </motion.div>
                        )}
                        {activeTab === "control" && (
                            <motion.div key="control" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.2 }} className="h-full w-full overflow-y-auto p-4 md:p-8 pb-64 custom-scrollbar">

                                <div className="max-w-7xl mx-auto flex flex-col gap-10">
                                    {/* TOP TOGGLE (ENTRY/EXIT) */}
                                    {/* TOP TOGGLE (ENTRY/EXIT) */}
                                    <div className="flex items-center gap-6">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => { playTactileSound(); setType("ENTRY"); }}
                                            className={cn(
                                                "flex-1 h-28 rounded-[2rem] border-2 flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden group",
                                                type === "ENTRY"
                                                    ? "bg-gradient-to-br from-[#B20D30] to-[#E53935] border-[#B20D30] text-white shadow-xl shadow-[#B20D30]/20"
                                                    : "bg-white border-black transition-all duration-300 text-black/40 hover:bg-slate-50"
                                            )}
                                        >
                                            <LogIn size={28} className={type === "ENTRY" ? "text-white" : "text-black/20"} />
                                            <span className="font-black text-[10px] uppercase tracking-[0.3em]">Registro de Ingreso</span>
                                            {type === "ENTRY" && <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full -mr-6 -mt-6" />}
                                        </motion.button>

                                        {/* CENTER LOGO */}
                                        <div className="w-24 h-24 flex items-center justify-center shrink-0">
                                            <Image src={customLogo || logo || "/logo-transparent.png"} alt="Logo" width={100} height={100} className="object-contain drop-shadow-md" />
                                        </div>

                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => { playTactileSound(); setType("EXIT"); }}
                                            className={cn(
                                                "flex-1 h-28 rounded-[2rem] border-2 flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden group",
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
                                            <div className="bg-transparent space-y-10 group transition-all">
                                                <div className="flex flex-col gap-10">
                                                    <div className="flex-1 w-full space-y-6">
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

                                                                // AUTO-FILL LOGIC
                                                                const vehicles: any[] = [];
                                                                if (u.users) {
                                                                    u.users.forEach((user: any) => {
                                                                        if (user.vehicles) {
                                                                            user.vehicles.forEach((v: any) => vehicles.push({ ...v, ownerName: user.name }));
                                                                        }
                                                                    });
                                                                }

                                                                if (vehicles.length > 0) {
                                                                    setAvailableVehicles(vehicles);
                                                                    setShowVehiclePrompt(true);
                                                                }
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
                                    <div className={cn(
                                        "flex flex-col gap-3 p-3 rounded-[3rem] border shadow-[0_10px_60px_-10px_rgba(0,0,0,0.15)] ring-1 ring-black/5 transition-all duration-500",
                                        isAlertMode
                                            ? "bg-red-600 border-red-400 animate-pulse shadow-[0_0_50px_rgba(220,38,38,0.5)]"
                                            : "bg-white/40 backdrop-blur-2xl border-white/40"
                                    )}>
                                        {/* Panic / Alert Button - Hold to Activate */}
                                        <div className="relative">
                                            <motion.button
                                                style={{ touchAction: "none" }}
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={(e) => {
                                                    if (isAlertMode) {
                                                        toggleAlertMode();
                                                        playTactileSound();
                                                    }
                                                }}
                                                onMouseDown={(e) => {
                                                    if (!isAlertMode) startPanicHold();
                                                }}
                                                onMouseUp={(e) => {
                                                    if (!isAlertMode) cancelPanicHold();
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isAlertMode) cancelPanicHold();
                                                }}
                                                onTouchStart={(e) => {
                                                    // Prevent default to avoid scrolling while holding
                                                    // e.preventDefault(); // CAUTION: e.preventDefault() on touchstart might block click depending on browser
                                                    // but we do want to block scroll.
                                                    if (!isAlertMode) {
                                                        startPanicHold();
                                                    }
                                                }}
                                                onTouchEnd={(e) => {
                                                    if (!isAlertMode) cancelPanicHold();
                                                }}
                                                className={cn(
                                                    "w-16 h-16 rounded-[1.8rem] flex items-center justify-center transition-all shadow-lg relative z-10 select-none",
                                                    isAlertMode ? "bg-white text-red-600 animate-bounce" : "bg-red-500 text-white"
                                                )}
                                            >
                                                <Siren size={28} className={isAlertMode ? "animate-pulse" : ""} />
                                            </motion.button>

                                            {/* Progress Ring for Hold */}
                                            {panicHoldProgress > 0 && !isAlertMode && (
                                                <svg className="absolute inset-[-4px] w-[72px] h-[72px] rotate-[-90deg] pointer-events-none">
                                                    <circle
                                                        cx="36"
                                                        cy="36"
                                                        r="34"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                        fill="transparent"
                                                        className="text-red-600"
                                                        strokeDasharray={213.6}
                                                        strokeDashoffset={213.6 - (213.6 * panicHoldProgress) / 100}
                                                    />
                                                </svg>
                                            )}
                                        </div>

                                        <div className={cn("h-px mx-2", isAlertMode ? "bg-white/20" : "bg-black/10")} />


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
                            <motion.div key="alerts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="h-full w-full overflow-y-auto px-8 pt-6 pb-40 custom-scrollbar">
                                <div className="max-w-7xl mx-auto space-y-8">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 bg-slate-50/95 backdrop-blur-md py-6 z-30 gap-6">
                                        <div>
                                            <h2 className="text-3xl font-black uppercase tracking-tighter text-black leading-none">Eventos Críticos</h2>
                                            <p className="text-[10px] text-[#B20D30] font-black uppercase tracking-[0.3em] mt-2">Registro de activación de botón de pánico</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="relative group">
                                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20 group-focus-within:text-[#B20D30] transition-colors" size={18} />
                                                <Input
                                                    type="date"
                                                    value={alertsDate}
                                                    onChange={(e) => setAlertsDate(e.target.value)}
                                                    className="pl-12 h-14 w-48 bg-white/40 backdrop-blur-md border border-black rounded-2xl font-black text-xs uppercase tracking-widest transition-all focus:border-[#B20D30]/50 shadow-sm"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20 group-focus-within:text-[#B20D30] transition-colors" size={18} />
                                                <Input
                                                    placeholder="BUSCAR OPERARIO..."
                                                    value={alertsSearch}
                                                    onChange={(e) => setAlertsSearch(e.target.value)}
                                                    className="pl-12 h-14 w-80 bg-white/40 backdrop-blur-md border border-black rounded-2xl font-black text-xs uppercase tracking-widest transition-all focus:border-[#B20D30]/50 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="shadow-lg" style={{ backgroundColor: customHeaderColor }}>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Activó</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Normalizó</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Duración</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white text-right">Fecha/Hora</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {(() => {
                                                    const alertArr = entries.filter(e => {
                                                        const isAlertType = e.type.includes("ALERTA");
                                                        const matchesSearch = !alertsSearch || (e.guardName || "").toLowerCase().includes(alertsSearch.toLowerCase());
                                                        const alertDate = new Date(e.timestamp || e.createdAt).toISOString().split('T')[0];
                                                        const matchesDate = !alertsDate || alertDate === alertsDate;

                                                        return isAlertType && matchesSearch && matchesDate;
                                                    });

                                                    if (alertArr.length === 0) return (
                                                        <tr>
                                                            <td colSpan={4} className="py-40 text-center">
                                                                <div className="flex flex-col items-center gap-6 opacity-20 text-black">
                                                                    <Shield size={80} />
                                                                    <p className="text-xl font-black uppercase tracking-[0.5em]">Historial de Alertas Limpio</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );

                                                    return alertArr.map((alert, idx) => {
                                                        // Solo mostrar eventos de ACTIVACIÓN
                                                        if (alert.type !== "ALERTA_ACTIVADA") return null;

                                                        const deactivationEvent = entries.find(e =>
                                                            e.type === "ALERTA_DESACTIVADA" &&
                                                            new Date(e.timestamp || e.createdAt).getTime() > new Date(alert.timestamp || alert.createdAt).getTime()
                                                        );

                                                        let duration = "---";
                                                        let isStillActive = false;
                                                        if (deactivationEvent) {
                                                            const diff = new Date(deactivationEvent.timestamp || deactivationEvent.createdAt).getTime() - new Date(alert.timestamp || alert.createdAt).getTime();
                                                            const mins = Math.floor(diff / 60000);
                                                            const secs = Math.floor((diff % 60000) / 1000);
                                                            duration = `${mins}m ${secs}s`;
                                                        } else {
                                                            duration = "ACTIVA";
                                                            isStillActive = true;
                                                        }

                                                        return (
                                                            <tr key={alert.id} className="hover:bg-slate-50/50 transition-colors group">
                                                                <td className="px-8 py-6">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">
                                                                            {(alert.guardName || "SI").substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-xs font-bold text-black uppercase">{alert.guardName || "Sistema"}</div>
                                                                            <div className="text-[9px] font-black text-red-600 uppercase tracking-wider">Activó Alerta</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-6">
                                                                    {deactivationEvent ? (
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black">
                                                                                {(deactivationEvent.guardName || "SI").substring(0, 2).toUpperCase()}
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-xs font-bold text-black uppercase">{deactivationEvent.guardName || "Sistema"}</div>
                                                                                <div className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Normalizó</div>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
                                                                            <span className="text-xs font-black text-red-600 uppercase">Pendiente</span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-8 py-6">
                                                                    <div className={cn(
                                                                        "px-4 py-2 rounded-xl text-sm font-black inline-flex items-center gap-2 border-2",
                                                                        isStillActive
                                                                            ? "bg-red-600 border-red-600 text-white animate-pulse shadow-lg shadow-red-600/30"
                                                                            : "bg-white border-emerald-500 text-emerald-600"
                                                                    )}>
                                                                        <Clock size={16} />
                                                                        {duration}
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-6 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-sm font-bold text-black tabular-nums">
                                                                            {new Date(alert.timestamp || alert.createdAt).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                        </span>
                                                                        <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">
                                                                            {new Date(alert.timestamp || alert.createdAt).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }).filter(Boolean);
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                        {activeTab === "lpr" && (
                            <motion.div key="lpr" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full w-full overflow-y-auto px-8 pt-6 pb-40 custom-scrollbar">
                                <div className="max-w-7xl mx-auto space-y-8">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between sticky top-0 bg-slate-50/95 backdrop-blur-md py-6 z-30 gap-6">
                                        <div>
                                            <h2 className="text-3xl font-black uppercase tracking-tighter text-black leading-none">Historial LPR</h2>
                                            <p className="text-[10px] text-[#B20D30] font-black uppercase tracking-[0.3em] mt-2">Reconocimiento automático de matrículas</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="relative group">
                                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20 group-focus-within:text-[#B20D30] transition-colors" size={18} />
                                                <Input
                                                    type="date"
                                                    value={lprDate}
                                                    onChange={(e) => setLprDate(e.target.value)}
                                                    className="pl-12 h-14 w-48 bg-white/40 backdrop-blur-md border border-black rounded-2xl font-black text-xs uppercase tracking-widest transition-all focus:border-[#B20D30]/50 shadow-sm"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20 group-focus-within:text-[#B20D30] transition-colors" size={18} />
                                                <Input
                                                    placeholder="BUSCAR MATRÍCULA..."
                                                    value={lprSearch}
                                                    onChange={(e) => setLprSearch(e.target.value)}
                                                    className="pl-12 h-14 w-80 bg-white/40 backdrop-blur-md border border-black rounded-2xl font-black text-xs uppercase tracking-widest transition-all focus:border-[#B20D30]/50 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="shadow-lg" style={{ backgroundColor: customHeaderColor }}>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Foto</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Matrícula</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Vehículo</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Propietario</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Unidad</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Sentido</th>
                                                    <th className="px-8 py-6 text-xs font-black uppercase tracking-widest text-white">Fecha/Hora</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {isLprLoading ? (
                                                    <tr>
                                                        <td colSpan={7} className="py-40">
                                                            <div className="flex flex-col items-center gap-6 opacity-20">
                                                                <Loader2 className="animate-spin" size={60} />
                                                                <p className="text-xl font-black uppercase tracking-[0.5em]">Cargando Eventos LPR...</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : lprEntries.length > 0 ? (
                                                    lprEntries.map((event) => (
                                                        <tr key={event.id} className="hover:bg-slate-50/50 transition-colors group">
                                                            <td className="px-6 py-4">
                                                                <div
                                                                    onClick={() => event.snapshotPath && setViewerData({
                                                                        url: event.snapshotPath,
                                                                        plate: event.plateDetected,
                                                                        name: (event as any).user?.name,
                                                                        unit: (event as any).user?.unit?.name,
                                                                        direction: event.direction,
                                                                        confidence: event.confidence,
                                                                        timestamp: event.timestamp,
                                                                        deviceName: event.deviceName
                                                                    })}
                                                                    className="w-16 h-12 rounded-lg bg-slate-100 overflow-hidden relative border border-black transition-all duration-300 cursor-zoom-in active:scale-95"
                                                                >
                                                                    {event.snapshotPath ? (
                                                                        <Image src={event.snapshotPath} alt="LPR" fill className="object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                                            <ImageIcon size={16} />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="px-3 py-1 bg-slate-100 border-2 border-slate-200 rounded-lg inline-block">
                                                                    <span className="text-sm font-black text-black uppercase tracking-tighter">{event.plateDetected || "--- ---"}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {(() => {
                                                                    const vehicle = event.user?.vehicles?.find((v: any) =>
                                                                        v.plate.replace(/[^A-Z0-9]/gi, '') === (event.plateDetected || "").replace(/[^A-Z0-9]/gi, '')
                                                                    );
                                                                    return (
                                                                        <span className="text-xs font-bold text-black/60 uppercase">
                                                                            {vehicle ? `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() || "---" : "---"}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-xs font-bold text-black uppercase">{event.user?.name || "No Identificado"}</span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-xs font-black text-[#B20D30] uppercase">{event.user?.unit?.name || "---"}</span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className={cn(
                                                                    "inline-flex px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter",
                                                                    event.direction === "ENTRY" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                                                                )}>
                                                                    {event.direction === "ENTRY" ? "Ingreso" : "Egreso"}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-black whitespace-nowrap">
                                                                        {new Date(event.timestamp).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' })}
                                                                    </span>
                                                                    <span className="text-[10px] font-black text-black/40">
                                                                        {new Date(event.timestamp).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={7} className="py-40">
                                                            <div className="flex flex-col items-center gap-6 opacity-20">
                                                                <Search size={80} />
                                                                <p className="text-xl font-black uppercase tracking-[0.5em]">No se encontraron registros</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
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
                                                <Input
                                                    placeholder="FILTRAR POR MATRÍCULA..."
                                                    className="pl-12 h-14 w-80 bg-white/40 backdrop-blur-md border border-black transition-all duration-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all focus:border-[#B20D30]/50 shadow-sm"
                                                    value={historySearch}
                                                    onChange={(e) => {
                                                        setHistorySearch(e.target.value);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="shadow-lg" style={{ backgroundColor: customHeaderColor }}>
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
                                                            <div
                                                                onClick={() => entry.photoPath && setViewerData({
                                                                    url: entry.photoPath,
                                                                    plate: entry.plate,
                                                                    name: entry.name
                                                                })}
                                                                className="w-16 h-12 rounded-lg bg-slate-100 overflow-hidden relative border border-black transition-all duration-300 cursor-zoom-in active:scale-95"
                                                            >
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
                                                                entry.type === "ALERTA" ? "bg-red-600 text-white animate-pulse" :
                                                                    entry.type === "ENTRY" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                                                            )}>
                                                                {entry.type === "ALERTA" ? "Alerta" :
                                                                    entry.type === "ENTRY" ? "Ingreso" : "Egreso"}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-black whitespace-nowrap">
                                                                    {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit' }) : "---"}
                                                                </span>
                                                                <span className="text-[10px] font-black text-black/40">
                                                                    {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }) : "---"}
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

                                        {/* Infinite Scroll Load More Trigger */}
                                        <div ref={loadMoreRef} className="py-20 flex justify-center w-full">
                                            {isHistoryLoading && <Loader2 className="animate-spin text-[#B20D30]" size={32} />}
                                            {!hasMoreHistory && !isHistoryLoading && (
                                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-black/20">Fin de la bitácora</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>

                <footer className={cn(
                    "fixed bottom-0 left-0 right-0 h-24 border-t-2 transition-all duration-500 flex items-center justify-between px-6 z-[100] shadow-[0_-20px_60px_rgba(0,0,0,0.08)]",
                    isAlertMode ? "bg-red-600 border-white" : "bg-white/95 backdrop-blur-3xl border-white/50"
                )}>
                    {/* AVATAR + MENU */}
                    <div className="relative">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => { setShowProfileMenu(!showProfileMenu); playTactileSound(); }}
                            className="w-14 h-14 rounded-full bg-slate-100 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden relative z-20"
                        >
                            {guardPhoto ? (
                                <Image src={guardPhoto} alt="User" fill className="object-cover" />
                            ) : (
                                <UserIcon className="text-slate-400" size={24} />
                            )}
                        </motion.button>

                        <AnimatePresence>
                            {showProfileMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowProfileMenu(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                        animate={{ opacity: 1, y: -20, scale: 1 }}
                                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                                        className="absolute bottom-full left-0 mb-4 w-64 bg-white rounded-3xl shadow-2xl border-2 border-slate-100 overflow-hidden p-3 flex flex-col gap-2 z-30"
                                    >
                                        <div className="p-3 bg-slate-50 rounded-2xl mb-2">
                                            <p className="text-xs font-bold uppercase text-slate-400">Sesión iniciada como</p>
                                            <p className="text-sm font-black uppercase text-black truncate">{guardName || "Guardia"}</p>
                                        </div>
                                        <button className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-black"
                                            onClick={() => { setShowCameraModal(true); setShowProfileMenu(false); }}>
                                            <Camera size={20} /> <span className="text-xs font-black uppercase tracking-wider">Mi Foto</span>
                                        </button>
                                        <button className="flex items-center gap-3 p-4 hover:bg-slate-50 rounded-2xl transition-colors text-black"
                                            onClick={() => { setShowSettingsModal(true); setShowProfileMenu(false); }}>
                                            <Settings size={20} /> <span className="text-xs font-black uppercase tracking-wider">Configuración</span>
                                        </button>
                                        <div className="h-px bg-slate-100 mx-2" />
                                        <button className="flex items-center gap-3 p-4 hover:bg-red-50 text-[#B20D30] rounded-2xl transition-colors"
                                            onClick={handleLogout}>
                                            <LogOut size={20} /> <span className="text-xs font-black uppercase tracking-wider">Cerrar Sesión</span>
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    <nav className={cn(
                        "transition-all duration-300 p-2 flex items-center gap-2 md:gap-4",
                    )}>
                        <BottomTab icon={customIcons.control ? <Image src={customIcons.control} width={24} height={24} className="object-contain" alt="Icon" /> : <FileText size={24} />} active={activeTab === "control"} onClick={() => handleTabChange("control")} label="Acceso" alertActive={isAlertMode} />
                        <BottomTab icon={customIcons.history ? <Image src={customIcons.history} width={24} height={24} className="object-contain" alt="Icon" /> : <HistoryIcon size={24} />} active={activeTab === "history"} onClick={() => handleTabChange("history")} label="Historial" alertActive={isAlertMode} />
                        <BottomTab icon={customIcons.lpr ? <Image src={customIcons.lpr} width={24} height={24} className="object-contain" alt="Icon" /> : <Car size={24} />} active={activeTab === "lpr"} onClick={() => handleTabChange("lpr")} label="LPR" alertActive={isAlertMode} />
                        <BottomTab icon={customIcons.alerts ? <Image src={customIcons.alerts} width={24} height={24} className="object-contain" alt="Icon" /> : <Bell size={24} />} active={activeTab === "alerts"} onClick={() => handleTabChange("alerts")} label="Alertas" alertActive={isAlertMode} />
                        <div className="w-px h-8 bg-black/5 mx-2" />
                        <BottomTab icon={customIcons.map ? <Image src={customIcons.map} width={24} height={24} className="object-contain" alt="Icon" /> : <MapIcon size={24} />} active={activeTab === "map"} onClick={() => handleTabChange("map")} label="Mapa" alertActive={isAlertMode} />
                    </nav>

                    <div className="hidden lg:flex flex-col items-end">
                        <p className={cn("text-xl font-black tabular-nums tracking-tighter leading-none mb-1", isAlertMode ? "text-white" : "text-[#B20D30]")}>{currentTime.toLocaleTimeString('es-UY', { hour12: false, hour: '2-digit', minute: '2-digit' })}</p>
                        <p className={cn("text-[8px] font-black uppercase tracking-widest leading-none", isAlertMode ? "text-white/60" : "text-black/40")}>{currentTime.toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    </div>
                </footer>

                {/* NOTIFICATION OVERLAY SCREEN */}
                <AnimatePresence>
                    {notification && (
                        <NotificationOverlay
                            {...notification}
                            onClose={() => setNotification(null)}
                        />
                    )}
                </AnimatePresence>

                {/* RESOLUTION / CANCEL MODAL */}
                <AnimatePresence>
                    {showResolutionModal && activeMission && (
                        <div className="fixed inset-0 z-[500] bg-black/80 flex items-center justify-center p-6">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl text-center space-y-4"
                            >
                                <h2 className="text-2xl font-black uppercase text-black">Gestionar Incidente</h2>
                                <p className="text-sm text-gray-500 uppercase font-bold">Seleccione una acción para finalizar</p>

                                <div className="space-y-2 text-left">
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Notas / Observaciones</label>
                                    <textarea
                                        value={backupDetail}
                                        onChange={(e) => setBackupDetail(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-black focus:outline-none focus:border-black transition-all text-sm resize-none h-24 uppercase"
                                        placeholder="Detalles del resultado..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-3 mt-4">
                                    <button onClick={() => {
                                        socket?.emit('resolve_backup', {
                                            requestId: activeMission.id,
                                            bitacoraId: activeMission.bitacoraId,
                                            outcome: 'SOLUCIONADO',
                                            guardName: guardName,
                                            notes: backupDetail || 'Intervención completada correctamente.'
                                        });
                                        setShowResolutionModal(false);
                                        setBackupDetail("");
                                    }} className="bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-black uppercase flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
                                        <CheckCircle2 size={24} /> Solucionado (Todo OK)
                                    </button>

                                    <button onClick={() => {
                                        socket?.emit('resolve_backup', {
                                            requestId: activeMission.id,
                                            bitacoraId: activeMission.bitacoraId,
                                            outcome: 'FALSA ALARMA',
                                            guardName: guardName,
                                            notes: backupDetail || 'No se detectó amenaza.'
                                        });
                                        setShowResolutionModal(false);
                                        setBackupDetail("");
                                    }} className="bg-amber-500 hover:bg-amber-600 text-white py-5 rounded-2xl font-black uppercase flex items-center justify-center gap-3 transition-all shadow-xl shadow-amber-500/20 active:scale-95">
                                        <ShieldAlert size={24} /> Falsa Alarma
                                    </button>

                                    <div className="h-px bg-gray-100 my-4" />

                                    <button onClick={() => {
                                        if (activeMission.responderId === socket?.id) {
                                            socket?.emit('cancel_backup', {
                                                requestId: activeMission.id,
                                                guardName: guardName,
                                                reason: 'Apoyo retirado'
                                            });
                                        } else {
                                            socket?.emit('cancel_backup', {
                                                requestId: activeMission.id,
                                                guardName: guardName,
                                                reason: 'Cancelado por usuario'
                                            });
                                        }
                                        setShowResolutionModal(false);
                                        setBackupDetail("");
                                    }} className="bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 p-4 rounded-xl font-black uppercase flex items-center justify-center gap-2 transition-colors">
                                        <X size={20} /> {activeMission.responderId === socket?.id ? "Cancelar Apoyo" : "Cancelar Solicitud"}
                                    </button>

                                    <button onClick={() => setShowResolutionModal(false)} className="text-gray-400 font-bold uppercase text-xs py-2">Volver</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* PROFILE CAMERA MODAL */}
                <AnimatePresence>
                    {showCameraModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black z-[2000] flex flex-col items-center justify-center"
                        >
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
                                <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-8 py-4 rounded-3xl flex items-center gap-4">
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-white font-black text-xl uppercase tracking-widest">Mi Foto de Perfil</span>
                                </div>
                            </div>

                            <video ref={profileVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <canvas ref={profileCanvasRef} className="hidden" />

                            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-6 z-10">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={captureProfilePhoto}
                                    className="w-24 h-24 rounded-full bg-white border-8 border-white/30 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform"
                                >
                                    <Camera size={32} className="text-black" />
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowCameraModal(false)}
                                    className="w-20 h-20 rounded-full bg-red-600 border-4 border-white/30 shadow-2xl flex items-center justify-center hover:bg-red-700 transition-colors"
                                >
                                    <X size={28} className="text-white" />
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* BACKUP REQUEST MODAL (SENDER) */}
                <AnimatePresence>
                    {showBackupModal && (
                        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl relative overflow-hidden"
                            >
                                <div className="text-center mb-6 relative z-10">
                                    <h2 className="text-3xl font-black uppercase text-[#B20D30] tracking-tighter">Solicitar Apoyo</h2>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Seleccione el tipo de amenaza</p>
                                </div>

                                <div className="mb-6 relative z-10">
                                    <label className="text-[10px] uppercase font-black text-gray-400 mb-2 block tracking-widest">Detalles Adicionales (Opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Hombre chaqueta roja, Toyota gris..."
                                        value={backupDetail}
                                        onChange={(e) => setBackupDetail(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-black focus:outline-none focus:border-[#B20D30] transition-colors uppercase text-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4 relative z-10">
                                    <button onClick={() => {
                                        if (socket && backupLocation) {
                                            const missionByMe = {
                                                id: 'req-' + Date.now(),
                                                type: 'INDIVIDUO SOSPECHOSO',
                                                lat: backupLocation.lat, lng: backupLocation.lng,
                                                requesterName: guardName || "Yo",
                                                requesterId: socket.id,
                                                status: 'PENDING',
                                                details: backupDetail
                                            };
                                            socket.emit('request_backup', missionByMe);
                                            setActiveMission(missionByMe);
                                            setShowBackupModal(false);
                                            setBackupDetail(""); // Reset
                                            showNotification("SOLICITUD ENVIADA", "Alerta enviada a todas las unidades.", "info");
                                        }
                                    }} className="bg-red-50 hover:bg-red-100 border-2 border-transparent hover:border-[#B20D30]/20 py-6 rounded-2xl flex flex-col items-center gap-3 transition-all group active:scale-95">
                                        <div className="w-16 h-16 bg-white shadow-lg rounded-full flex items-center justify-center text-[#B20D30] group-hover:scale-110 transition-transform">
                                            <UserX size={32} />
                                        </div>
                                        <span className="text-sm font-black uppercase text-[#B20D30] leading-tight">Individuo<br />Sospechoso</span>
                                    </button>

                                    <button onClick={() => {
                                        if (socket && backupLocation) {
                                            const missionByMe = {
                                                id: 'req-' + Date.now(),
                                                type: 'VEHICULO SOSPECHOSO',
                                                lat: backupLocation.lat, lng: backupLocation.lng,
                                                requesterName: guardName || "Yo",
                                                requesterId: socket.id,
                                                status: 'PENDING',
                                                details: backupDetail
                                            };
                                            socket.emit('request_backup', missionByMe);
                                            setActiveMission(missionByMe);
                                            setShowBackupModal(false);
                                            setBackupDetail(""); // Reset
                                            showNotification("SOLICITUD ENVIADA", "Alerta enviada a todas las unidades.", "info");
                                        }
                                    }} className="bg-slate-50 hover:bg-slate-100 border-2 border-transparent hover:border-slate-300 py-6 rounded-2xl flex flex-col items-center gap-3 transition-all group active:scale-95">
                                        <div className="w-16 h-16 bg-white shadow-lg rounded-full flex items-center justify-center text-slate-700 group-hover:scale-110 transition-transform">
                                            <CarFront size={32} />
                                        </div>
                                        <span className="text-sm font-black uppercase text-slate-700 leading-tight">Vehículo<br />Sospechoso</span>
                                    </button>
                                </div>

                                <button onClick={() => setShowBackupModal(false)} className="mt-6 w-full py-3 text-xs font-bold uppercase text-gray-400 hover:text-black transition-colors">
                                    Cancelar Operación
                                </button>
                            </motion.div>

                        </div>
                    )}
                </AnimatePresence >

                {/* INCOMING BACKUP ALERT (RECEIVER) */}
                <AnimatePresence>
                    {
                        incomingBackup && (
                            <div className="fixed inset-0 z-[400] bg-red-600/90 flex flex-col items-center justify-center p-8">
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl text-center space-y-6 border-4 border-red-500"
                                >
                                    <div className="animate-pulse w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ShieldAlert size={64} className="text-red-600" />
                                    </div>

                                    <div>
                                        <h1 className="text-3xl font-black uppercase text-red-600 leading-none mb-2">SOLICITUD DE APOYO</h1>
                                        <p className="text-xl font-bold text-black uppercase">{incomingBackup.type}</p>
                                        <p className="text-sm font-bold text-gray-500 mt-2 uppercase">Solicitado por: <span className="text-black">{incomingBackup.requesterName}</span></p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-8">
                                        <button
                                            onClick={() => setIncomingBackup(null)}
                                            className="py-4 rounded-2xl border-2 border-gray-200 text-gray-500 font-black uppercase tracking-widest hover:bg-gray-50"
                                        >
                                            Ignorar
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (socket) {
                                                    socket.emit('respond_backup', {
                                                        requestId: incomingBackup.id,
                                                        accepted: true,
                                                        responderName: guardName || "Guardia"
                                                    });
                                                    setActiveMission({
                                                        ...incomingBackup,
                                                        status: 'ACCEPTED',
                                                        responderId: socket.id
                                                    });
                                                    setIncomingBackup(null);
                                                    handleTabChange('map'); // Switch to map immediately
                                                }
                                            }}
                                            className="py-4 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-500/30"
                                        >
                                            RESPONDER
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )
                    }
                </AnimatePresence >

                {/* AUDIO RECORDING HUB - NEW APPROACH */}
                <AnimatePresence>
                    {
                        isRecording && (
                            <motion.div
                                initial={{ opacity: 0, scale: 1.1 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="fixed inset-0 z-[1000] flex flex-col items-center justify-center p-8 backdrop-blur-3xl bg-black/80"
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 40 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex flex-col items-center gap-12 max-w-2xl w-full"
                                >
                                    {/* REC Status Indicator */}
                                    <div className="flex items-center gap-4 bg-red-600/20 px-8 py-3 rounded-2xl border border-red-500/30">
                                        <motion.div
                                            animate={{ opacity: [1, 0.4, 1] }}
                                            transition={{ repeat: Infinity, duration: 1 }}
                                            className="w-4 h-4 rounded-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)]"
                                        />
                                        <span className="text-white font-black text-xs uppercase tracking-[0.4em]">REC ON AIR</span>
                                        <div className="h-4 w-px bg-white/10 mx-2" />
                                        <span className="text-white font-black text-xl tabular-nums">{formatDuration(recordingDuration)}</span>
                                    </div>

                                    {/* Dynamic Visualizer */}
                                    <div className="flex gap-2 items-center h-48">
                                        {[...Array(32)].map((_, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{
                                                    height: [10, 40 + Math.random() * 100, 10],
                                                }}
                                                transition={{
                                                    repeat: Infinity,
                                                    duration: 0.4 + Math.random() * 0.4,
                                                    delay: i * 0.02
                                                }}
                                                className="w-1.5 min-h-[10px] bg-gradient-to-t from-red-600 to-white rounded-full opacity-80"
                                            />
                                        ))}
                                    </div>

                                    <div className="text-center">
                                        <h3 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">Capturando Nota de Audio</h3>
                                        <p className="text-white/40 font-black text-[10px] uppercase tracking-[0.5em]">La grabación se adjuntará automáticamente al reporte</p>
                                    </div>

                                    {/* Main Controls */}
                                    <div className="flex items-center gap-10 mt-6">
                                        {/* Stop and Save */}
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={stopRecording}
                                            className="w-28 h-28 rounded-[3rem] bg-white text-red-600 flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.4)] group"
                                        >
                                            <div className="w-10 h-10 bg-red-600 rounded-xl transition-transform group-hover:scale-90" />
                                        </motion.button>

                                        {/* Cancel */}
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => { stopRecording(); setAudioUrl(null); setAudioBlob(null); }}
                                            className="w-20 h-20 rounded-[2.5rem] bg-white/10 text-white border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
                                        >
                                            <X size={32} />
                                        </motion.button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )
                    }
                </AnimatePresence >

                {/* IMAGE VIEWER OVERLAY */}
                <AnimatePresence>
                    {
                        viewerImage && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-xl flex items-center justify-center"
                                onClick={() => setViewerImage(null)}
                            >
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="absolute top-8 right-8 w-14 h-14 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all z-50"
                                    onClick={() => setViewerImage(null)}
                                >
                                    <X size={32} />
                                </motion.button>

                                <motion.div
                                    initial={{ opacity: 0, scale: 1 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="relative w-full h-full"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Image
                                        src={viewerImage}
                                        alt="Full view"
                                        fill
                                        className="object-contain"
                                        priority
                                    />

                                    {/* LPR Data Overlay - Only show if we have LPR data */}
                                    {viewerData && (viewerData.plate || viewerData.name || viewerData.unit) && (
                                        <>
                                            {/* Top Left - Plate and Basic Info */}
                                            <motion.div
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.2 }}
                                                className="absolute top-8 left-8 space-y-3"
                                            >
                                                {/* Plate Number - Large and Prominent */}
                                                {viewerData.plate && (
                                                    <div className="bg-gradient-to-br from-white via-slate-100 to-slate-200 px-8 py-4 rounded-2xl border-4 border-black shadow-2xl">
                                                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-1">Matrícula Detectada</div>
                                                        <div className="text-4xl font-black text-black uppercase tracking-[0.2em]">{viewerData.plate}</div>
                                                    </div>
                                                )}

                                                {/* Direction Badge */}
                                                {viewerData.direction && (
                                                    <div className={cn(
                                                        "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg",
                                                        viewerData.direction === "ENTRY"
                                                            ? "bg-emerald-500 text-white"
                                                            : "bg-orange-500 text-white"
                                                    )}>
                                                        {viewerData.direction === "ENTRY" ? <LogIn size={18} /> : <LogOut size={18} />}
                                                        {viewerData.direction === "ENTRY" ? "Entrada" : "Salida"}
                                                    </div>
                                                )}

                                                {/* Confidence Score */}
                                                {viewerData.confidence !== undefined && (
                                                    <div className="bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                                                        <div className="text-[9px] font-black text-white/60 uppercase tracking-wider mb-1">Confianza</div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                                                                <div
                                                                    className={cn(
                                                                        "h-full rounded-full transition-all",
                                                                        viewerData.confidence >= 90 ? "bg-emerald-500" :
                                                                            viewerData.confidence >= 70 ? "bg-yellow-500" : "bg-red-500"
                                                                    )}
                                                                    style={{ width: `${viewerData.confidence}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-sm font-black text-white">{viewerData.confidence}%</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>

                                            {/* Top Right - Owner Info */}
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.3 }}
                                                className="absolute top-8 right-8 space-y-3 max-w-sm"
                                            >
                                                {/* Owner Card */}
                                                {viewerData.name && (
                                                    <div className="bg-black/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 shadow-2xl">
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="w-10 h-10 rounded-full bg-blue-500/20 border-2 border-blue-500/50 flex items-center justify-center">
                                                                <UserIcon size={20} className="text-blue-400" />
                                                            </div>
                                                            <div className="text-[10px] font-black text-white/60 uppercase tracking-wider">Propietario</div>
                                                        </div>
                                                        <div className="text-xl font-black text-white uppercase tracking-wide">{viewerData.name}</div>
                                                    </div>
                                                )}

                                                {/* Unit/Lot Info */}
                                                {viewerData.unit && (
                                                    <div className="bg-black/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 shadow-2xl">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <Home size={18} className="text-emerald-400" />
                                                            <div className="text-[10px] font-black text-white/60 uppercase tracking-wider">Lote / Unidad</div>
                                                        </div>
                                                        <div className="text-lg font-black text-white uppercase">{viewerData.unit}</div>
                                                    </div>
                                                )}

                                                {/* Device Info */}
                                                {viewerData.deviceName && (
                                                    <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                                                        <div className="flex items-center gap-2">
                                                            <Camera size={14} className="text-white/40" />
                                                            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{viewerData.deviceName}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>

                                            {/* Bottom - Analysis Summary */}
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.4 }}
                                                className="absolute bottom-8 left-8 right-8"
                                            >
                                                <div className="bg-gradient-to-r from-black/90 via-black/80 to-black/90 backdrop-blur-xl px-8 py-5 rounded-2xl border border-white/20 shadow-2xl">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-6">
                                                            <div>
                                                                <div className="text-[9px] font-black text-white/50 uppercase tracking-wider mb-1">Análisis Rápido</div>
                                                                <div className="text-sm font-bold text-white">
                                                                    {viewerData.name && viewerData.unit
                                                                        ? "✓ Residente Identificado - Acceso Autorizado"
                                                                        : viewerData.name
                                                                            ? "✓ Usuario Registrado"
                                                                            : "⚠ Matrícula No Registrada"}
                                                                </div>
                                                            </div>
                                                            {viewerData.timestamp && (
                                                                <div className="border-l border-white/20 pl-6">
                                                                    <div className="text-[9px] font-black text-white/50 uppercase tracking-wider mb-1">Timestamp</div>
                                                                    <div className="text-sm font-mono font-bold text-white">
                                                                        {new Date(viewerData.timestamp).toLocaleString('es-AR', {
                                                                            day: '2-digit',
                                                                            month: '2-digit',
                                                                            year: 'numeric',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                            second: '2-digit'
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                                                            Toca para cerrar
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </>
                                    )}
                                </motion.div>

                                {/* Actions overlay for Viewer - Only in Control (Home) tab */}
                                {activeTab === 'control' && viewerData && (viewerData.plate || viewerData.name === "Desconocido" || !viewerData.name) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="absolute left-1/2 -translate-x-1/2 bottom-28 flex gap-4"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={() => handleQuickCreateClick({
                                                plate: viewerData.plate !== '--- ---' ? viewerData.plate : undefined,
                                                cara: viewerData.url.startsWith('/api/files/') ? viewerData.url.replace('/api/files/', '') : viewerData.url
                                            })}
                                            disabled={loadingQuickCreateData}
                                            className="h-20 px-12 rounded-[2rem] bg-emerald-500/40 backdrop-blur-3xl border-2 border-emerald-500/30 text-white font-black text-lg uppercase tracking-widest shadow-2xl flex items-center gap-4 transition-all hover:bg-emerald-500/60 active:scale-95 disabled:opacity-50"
                                        >
                                            {loadingQuickCreateData ? <Loader2 size={32} className="animate-spin" /> : <Plus size={32} />}
                                            Registrar Nuevo Usuario
                                        </button>
                                    </motion.div>
                                )}
                            </motion.div>
                        )
                    }
                </AnimatePresence >

                {/* Normalization Modal */}
                <AnimatePresence>
                    {
                        showNormalizationModal && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
                                onClick={() => {
                                    setShowNormalizationModal(false);
                                    setNormalizationText("");
                                }}
                            >
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
                                            <CheckCircle2 size={32} className="text-emerald-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black uppercase tracking-tight text-black">Normalizar Alerta</h2>
                                            <p className="text-sm text-black/60 font-bold">Describe brevemente la situación</p>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-xs font-black uppercase tracking-wider text-black/60 mb-2">
                                            Explicación de la Alerta
                                        </label>
                                        <textarea
                                            value={normalizationText}
                                            onChange={(e) => setNormalizationText(e.target.value)}
                                            placeholder="Ej: Falsa alarma, botón presionado accidentalmente..."
                                            className="w-full h-32 px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-medium text-black placeholder:text-black/30 focus:border-emerald-500 focus:outline-none resize-none"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setShowNormalizationModal(false);
                                                setNormalizationText("");
                                            }}
                                            className="flex-1 h-14 bg-slate-100 hover:bg-slate-200 rounded-xl font-black uppercase tracking-wider text-sm text-black transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => {
                                                toggleAlertMode(false, normalizationText);
                                                setShowNormalizationModal(false);
                                                setNormalizationText("");
                                            }}
                                            disabled={!normalizationText.trim()}
                                            className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl font-black uppercase tracking-wider text-sm text-white transition-all shadow-lg shadow-emerald-600/20"
                                        >
                                            Confirmar Normalización
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )
                    }
                </AnimatePresence >

                {/* Settings Modal */}
                <AnimatePresence>
                    {showSettingsModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
                            onClick={() => setShowSettingsModal(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 overflow-y-auto max-h-[90vh]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center">
                                        <Settings size={32} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black uppercase tracking-tight text-black">Configuración</h2>
                                        <p className="text-sm text-black/60 font-bold">Personalización de la interfaz</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <Label className="text-xs font-black uppercase tracking-wider text-black/60">Logo Central (Sin bordes)</Label>
                                        <div className="flex gap-6 items-center bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100">
                                            <div className="w-24 h-24 relative shrink-0">
                                                <Image src={customLogo || "/logo-transparent.png"} alt="Preview" fill className="object-contain" />
                                            </div>
                                            <div className="flex-1 space-y-3">
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const formData = new FormData();
                                                            formData.append("file", file);
                                                            const res = await uploadBrandingFile(formData);
                                                            if (res.success) setCustomLogo(res.url!);
                                                        }
                                                    }}
                                                    className="h-12 border-2 border-slate-200 rounded-xl bg-white"
                                                />
                                                <p className="text-[10px] text-black/40 font-bold uppercase tracking-widest">Sube tu logo en formato PNG transparente</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-xs font-black uppercase tracking-wider text-black/60">Color de Títulos de Tablas</Label>
                                        <div className="flex gap-4 flex-wrap">
                                            {[
                                                { color: "#000000", name: "Negro (Default)" },
                                                { color: "#B20D30", name: "Rojo Seguridad" },
                                                { color: "#1e293b", name: "Slate 800" },
                                                { color: "#166534", name: "Verde Bosque" },
                                                { color: "#1e40af", name: "Azul Cobalto" },
                                            ].map((c) => (
                                                <button
                                                    key={c.color}
                                                    onClick={() => setCustomHeaderColor(c.color)}
                                                    className={cn(
                                                        "w-12 h-12 rounded-full border-4 shadow-sm transition-all flex items-center justify-center",
                                                        customHeaderColor === c.color ? "border-black scale-110" : "border-white"
                                                    )}
                                                    style={{ backgroundColor: c.color }}
                                                    title={c.name}
                                                >
                                                    {customHeaderColor === c.color && <CheckCircle2 className="text-white" size={20} />}
                                                </button>
                                            ))}
                                            <div className="flex items-center gap-2 ml-4">
                                                <input
                                                    type="color"
                                                    value={customHeaderColor}
                                                    onChange={(e) => setCustomHeaderColor(e.target.value)}
                                                    className="w-12 h-12 rounded-full cursor-pointer border-4 border-white shadow-sm"
                                                />
                                                <span className="text-[10px] font-black uppercase text-black/40">Personalizado</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <Label className="text-xs font-black uppercase tracking-wider text-black">Iconos de la Aplicación</Label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {[
                                                { key: "control", label: "Control de Acceso (Home)" },
                                                { key: "history", label: "Bitácora (Historial)" },
                                                { key: "lpr", label: "LPR (Cámaras)" },
                                                { key: "alerts", label: "Alertas y Pánico" },
                                                { key: "map", label: "Mapa de Seguridad" },
                                            ].map((tab) => (
                                                <div key={tab.key} className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Label className="text-[10px] font-black uppercase tracking-wider text-black/60">{tab.label}</Label>
                                                        {customIcons[tab.key] && (
                                                            <div className="w-6 h-6 relative">
                                                                <Image src={customIcons[tab.key]} alt="Icon" fill className="object-contain" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                const formData = new FormData();
                                                                formData.append("file", file);
                                                                const res = await uploadBrandingFile(formData);
                                                                if (res.success) setCustomIcons({ ...customIcons, [tab.key]: res.url! });
                                                            }
                                                        }}
                                                        className="h-10 text-[10px] rounded-lg border-2 border-slate-200 bg-white"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-10">
                                    <button
                                        disabled={isSavingBranding}
                                        onClick={() => {
                                            setCustomLogo(logo);
                                            setCustomHeaderColor(headerColor);
                                            setCustomIcons(initialIcons);
                                            setShowSettingsModal(false);
                                        }}
                                        className="flex-1 h-16 bg-slate-100 hover:bg-slate-200 rounded-2xl font-black uppercase tracking-widest text-xs text-black transition-all disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        disabled={isSavingBranding}
                                        onClick={async () => {
                                            setIsSavingBranding(true);
                                            try {
                                                const res = await saveGuardBranding({
                                                    "GUARD_MAIN_LOGO": customLogo || "",
                                                    "GUARD_TABLE_HEADER_COLOR": customHeaderColor,
                                                    "GUARD_APP_ICONS": JSON.stringify(customIcons)
                                                });
                                                if (res.success) {
                                                    toast.success("Configuración de marca actualizada con éxito");
                                                    setShowSettingsModal(false);
                                                    window.location.reload();
                                                } else {
                                                    toast.error("Error al guardar: " + res.message);
                                                }
                                            } catch (e) {
                                                toast.error("Error de red al guardar");
                                            } finally {
                                                setIsSavingBranding(false);
                                            }
                                        }}
                                        className="flex-1 h-16 bg-black hover:bg-neutral-800 rounded-2xl font-black uppercase tracking-widest text-xs text-white transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
                                    >
                                        {isSavingBranding ? <Loader2 className="animate-spin" size={18} /> : null}
                                        {isSavingBranding ? "Guardando..." : "Guardar Cambios"}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {
                    quickCreateData && (
                        <UserFormDialog
                            open={showQuickCreate}
                            onOpenChange={setShowQuickCreate}
                            units={quickCreateData.units}
                            groups={quickCreateData.groups}
                            devices={quickCreateData.devices}
                            parkingSlots={quickCreateData.parkingSlots}
                            onSuccess={() => {
                                setShowQuickCreate(false);
                                toast.success("Usuario creado con éxito");
                            }}
                            initialData={quickCreateContext}
                        />
                    )
                }
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

function BottomTab({ icon, active, onClick, label, small, alertActive }: any) {
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
                active
                    ? (alertActive ? "text-red-700 bg-white" : "text-[#B20D30]")
                    : (alertActive ? "text-red-300" : "text-black/40 hover:text-black hover:bg-white/60")
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
                className="px-8 py-3 rounded-2xl"
            >
                <p className="text-[10px] font-black text-[#B20D30] uppercase tracking-[0.4em] animate-pulse">Escribe la matricula en cada casillero</p>
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

function NotificationOverlay({ type, title, message, onClose }: { type: string, title: string, message: string, onClose: () => void }) {
    const isAlert = type === "alert" || type === "error";

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={cn(
                "fixed inset-0 z-[1000] flex flex-col items-center justify-center p-8 backdrop-blur-md transition-colors duration-500",
                type === "success" ? "bg-emerald-600/95" : "bg-[#B20D30]/95"
            )}
        >
            <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 20 }}
                className="flex flex-col items-center text-center max-w-2xl"
            >
                <div className="w-32 h-32 rounded-[3rem] flex items-center justify-center mb-10 shadow-2xl relative bg-white text-[#B20D30]">
                    {type === "success" && <CheckCircle2 size={64} strokeWidth={2.5} />}
                    {type === "error" && <X size={64} strokeWidth={2.5} />}
                    {type === "info" && <UserCheck size={64} strokeWidth={2.5} />}
                    {type === "alert" && <Siren size={64} strokeWidth={2.5} className="animate-bounce" />}

                    {/* Pulsating Ring */}
                    <motion.div
                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 rounded-[3rem] border-4 border-white"
                    />
                </div>

                <h2 className="text-6xl font-black text-white uppercase tracking-tighter mb-4">
                    {title}
                </h2>
                <p className="text-xl font-black text-white/60 uppercase tracking-widest leading-relaxed">
                    {message}
                </p>

                <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 2, ease: "linear" }}
                    className="h-2 bg-white/20 w-80 mt-12 rounded-full origin-left"
                />
            </motion.div>
        </motion.div>
    );
}
