"use client";

import { useState } from "react";
import {
    Settings,
    Users,
    Bell,
    Database,
    Camera,
    ShieldCheck,
    Save,
    Cpu,
    Cloud,
    ChevronRight,
    Activity,
    Info,
    RefreshCcw,
    ShieldAlert,
    FileText,
    HardDrive,
    Download,
    Upload,
    Table as TableIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DriverDetailsDialog } from "@/components/DriverDetailsDialog";
import { DRIVER_MODELS, type DeviceBrand } from "@/lib/driver-models";
import { updateSetting, getSetting, testS3Connection, getBucketLifecycle, updateBucketLifecycle, testDbConnection, getBucketStats, getDbStats, downloadBackup } from "@/app/actions/settings";
import { useEffect } from "react";
import { toast } from "sonner";

const SETTINGS_SECTIONS = [
    {
        id: "drivers",
        icon: Camera,
        label: "Drivers & Protocolos",
        description: "Gestiona los controladores de dispositivos",
        color: "blue"
    },
    {
        id: "users",
        icon: Users,
        label: "Administradores",
        description: "Control de acceso al sistema",
        color: "purple"
    },
    {
        id: "notifications",
        icon: Bell,
        label: "Notificaciones",
        description: "Alertas y eventos del sistema",
        color: "amber"
    },
    {
        id: "database",
        icon: Database,
        label: "Database",
        description: "Postgres & Gestión de Datos",
        color: "emerald"
    },
    {
        id: "storage",
        icon: Cloud,
        label: "Almacenamiento",
        description: "Configuración MinIO / S3",
        color: "blue"
    },
];

const DRIVERS = [
    { brand: "Hikvision", tech: "ISAPI/Event", active: true, color: "red" },
    { brand: "Akuvox", tech: "HTTP/Webhook", active: true, color: "blue" },
    { brand: "Dahua", tech: "CGI/HTTP", active: false, color: "red" },
    { brand: "ZKTeco", tech: "Push HTTP", active: false, color: "blue" },
    { brand: "Axis", tech: "Vapix API", active: false, color: "orange" },
    { brand: "Uniview", tech: "SDK Proxy", active: false, color: "blue" },
    { brand: "Intelbras", tech: "CGI/Event", active: false, color: "green" },
    { brand: "UniFi", tech: "Protect API", active: false, color: "blue" },
];

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState("drivers");
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [modelSearch, setModelSearch] = useState("");

    return (
        <div className="h-full overflow-y-auto p-6 space-y-8 animate-in fade-in duration-700 custom-scrollbar">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Settings className="text-blue-400" size={28} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight">Configuración</h1>
                        <p className="text-sm text-neutral-500 font-medium">Panel de control del sistema</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Sidebar Navigation */}
                <div className="col-span-12 lg:col-span-3">
                    <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-2 sticky top-8">
                        <nav className="space-y-1">
                            {SETTINGS_SECTIONS.map((section) => {
                                const Icon = section.icon;
                                const isActive = activeSection === section.id;

                                return (
                                    <button
                                        key={section.id}
                                        onClick={() => setActiveSection(section.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                                            isActive
                                                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                                                : "text-neutral-400 hover:bg-white/5 hover:text-white"
                                        )}
                                    >
                                        <Icon size={20} className={cn(
                                            "transition-transform",
                                            isActive && "scale-110"
                                        )} />
                                        <div className="flex-1 text-left">
                                            <div className="text-sm font-bold">{section.label}</div>
                                            <div className="text-[10px] opacity-70">{section.description}</div>
                                        </div>
                                        {isActive && (
                                            <ChevronRight size={16} className="animate-pulse" />
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                {/* Main Content */}
                <div className="col-span-12 lg:col-span-9">
                    {/* Drivers Section */}
                    {activeSection === "drivers" && (
                        <div className="space-y-6">
                            <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-2xl font-black text-white">Drivers & Protocolos</h2>
                                        <p className="text-sm text-neutral-500 mt-1">Gestiona los controladores de dispositivos compatibles</p>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs font-bold text-emerald-400">SISTEMA ACTIVO</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {DRIVERS.map((driver, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => driver.active && setSelectedBrand(driver.brand)}
                                            disabled={!driver.active}
                                            className={cn(
                                                "relative p-6 rounded-xl border transition-all group",
                                                driver.active
                                                    ? "bg-neutral-950/50 border-white/10 hover:border-blue-500/50 hover:bg-neutral-950 cursor-pointer hover:scale-105"
                                                    : "bg-neutral-950/20 border-white/5 opacity-40 cursor-not-allowed"
                                            )}
                                        >
                                            {driver.active && (
                                                <div className="absolute top-3 right-3">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                                                </div>
                                            )}

                                            <div className="flex flex-col items-center gap-3">
                                                <div className={cn(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center",
                                                    driver.active ? "bg-blue-500/10" : "bg-neutral-800/50"
                                                )}>
                                                    <Camera size={24} className={driver.active ? "text-blue-400" : "text-neutral-600"} />
                                                </div>

                                                <div className="text-center">
                                                    <p className="font-black text-sm text-white mb-1">{driver.brand}</p>
                                                    <div className="px-2 py-1 bg-neutral-900/80 rounded-md">
                                                        <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{driver.tech}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {!driver.active && (
                                                <div className="absolute inset-x-0 bottom-3 text-center">
                                                    <span className="text-[8px] font-bold text-amber-500/70 bg-amber-500/10 px-2 py-1 rounded-full uppercase">
                                                        En desarrollo
                                                    </span>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Users Section */}
                    {activeSection === "users" && (
                        <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-8">
                            <h2 className="text-2xl font-black text-white mb-4">Administradores del Sistema</h2>
                            <p className="text-neutral-500">Gestión de usuarios administradores próximamente...</p>
                        </div>
                    )}

                    {/* Notifications Section */}
                    {activeSection === "notifications" && (
                        <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-8">
                            <h2 className="text-2xl font-black text-white mb-4">Notificaciones & Alertas</h2>
                            <p className="text-neutral-500">Configuración de notificaciones próximamente...</p>
                        </div>
                    )}
                    {activeSection === "database" && (
                        /* ... existing database code ... */
                        <DatabaseSection />
                    )}

                    {activeSection === "storage" && (
                        <StorageSection />
                    )}
                </div>
            </div>

            {/* Driver Details Dialog */}
            <DriverDetailsDialog
                brand={selectedBrand}
                isOpen={selectedBrand !== null}
                onClose={() => setSelectedBrand(null)}
            />
        </div>
    );
}

function DatabaseSection() {
    const [testing, setTesting] = useState(false);
    const [stats, setStats] = useState<{ totalSize: string, tables: any[] } | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [backingUp, setBackingUp] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoadingStats(true);
        try {
            const res = await getDbStats();
            if (res.success) {
                setStats({ totalSize: res.totalSize, tables: res.tables });
            }
        } catch (err) {
            console.error("Error loading DB stats:", err);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleTestDb = async () => {
        setTesting(true);
        try {
            const res = await testDbConnection();
            if (res.success) {
                toast.success("¡Conexión Exitosa con PostgreSQL!");
                loadStats();
            } else {
                toast.error(`Error de conexión: ${res.message}`);
            }
        } catch (err) {
            toast.error("Error crítico al intentar conectar con la base de datos");
        } finally {
            setTesting(false);
        }
    };

    const handleBackup = async () => {
        setBackingUp(true);
        try {
            const res = await downloadBackup();
            if (res.success) {
                const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `omniaccess-backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success("Respaldo generado y descargado con éxito");
            } else {
                toast.error("Error al generar el respaldo: " + res.message);
            }
        } catch (err) {
            toast.error("Error durante el proceso de respaldo");
        } finally {
            setBackingUp(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">PostgreSQL Database</h2>
                        <p className="text-sm text-neutral-500 mt-1">Gestión avanzada y salud del motor de datos</p>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-1">
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Peso Total DB</span>
                        </div>
                        <span className="text-xl font-mono font-black text-white">
                            {loadingStats ? "..." : stats?.totalSize || "N/A"}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Connection Health */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-neutral-950/50 border border-white/5 rounded-xl p-6 h-full flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Activity className="text-blue-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white text-sm uppercase tracking-tight">Estado de Red</h3>
                                </div>
                                <p className="text-xs text-neutral-500 leading-relaxed mb-6">
                                    Asegura que el microservicio Prisma pueda comunicarse con la instancia local de Postgres.
                                </p>
                            </div>
                            <Button
                                onClick={handleTestDb}
                                disabled={testing}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black h-11 text-[10px] uppercase tracking-widest transition-all"
                            >
                                {testing ? <RefreshCcw className="animate-spin mr-2" size={14} /> : <Activity className="mr-2" size={14} />}
                                TESTEAR CONEXIÓN
                            </Button>
                        </div>
                    </div>

                    {/* Tables Stats */}
                    <div className="lg:col-span-2">
                        <div className="bg-neutral-950/50 border border-white/5 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-500/10 rounded-lg">
                                        <TableIcon className="text-purple-400" size={20} />
                                    </div>
                                    <h3 className="font-bold text-white text-sm uppercase tracking-tight">Esquema & Tablas</h3>
                                </div>
                                <button onClick={loadStats} className="text-neutral-500 hover:text-white transition-colors">
                                    <RefreshCcw size={14} className={loadingStats ? "animate-spin" : ""} />
                                </button>
                            </div>

                            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                {loadingStats ? (
                                    <p className="text-[10px] text-neutral-600 animate-pulse font-black uppercase">Obteniendo esquema...</p>
                                ) : stats?.tables.map((table, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-lg hover:bg-white/5 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 group-hover:bg-purple-500 transition-colors" />
                                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-tight">{table.table_name}</span>
                                        </div>
                                        <div className="flex items-center gap-4 font-mono text-[10px]">
                                            <span className="text-neutral-600">{table.row_count} rows</span>
                                            <span className="text-neutral-400 font-bold">{table.total_size}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Backup & Import Section */}
                <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-neutral-900 border border-white/5 p-6 rounded-xl flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                <Download size={24} />
                            </div>
                            <div>
                                <p className="text-white font-black uppercase tracking-tight text-xs">Respaldo Integral</p>
                                <p className="text-[10px] text-neutral-500 font-medium">Exportar toda la configuración y registros a JSON</p>
                            </div>
                        </div>
                        <Button
                            onClick={handleBackup}
                            disabled={backingUp}
                            className="bg-neutral-800 hover:bg-amber-600 text-neutral-300 hover:text-white font-black text-[9px] uppercase tracking-widest px-4 h-9 transition-all"
                        >
                            {backingUp ? <RefreshCcw className="animate-spin mr-2" size={12} /> : <Download size={12} className="mr-2" />}
                            EXPORTAR
                        </Button>
                    </div>

                    <div className="bg-neutral-900 border border-white/5 p-6 rounded-xl flex items-center justify-between group opacity-50 cursor-not-allowed">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                <Upload size={24} />
                            </div>
                            <div>
                                <p className="text-white font-black uppercase tracking-tight text-xs">Importar Datos</p>
                                <p className="text-[10px] text-neutral-500 font-medium">Restaurar sistema desde un archivo de respaldo</p>
                            </div>
                        </div>
                        <Button
                            disabled
                            className="bg-neutral-800 text-neutral-500 font-black text-[9px] uppercase tracking-widest px-4 h-9"
                        >
                            <Upload size={12} className="mr-2" />
                            IMPORTAR
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StorageSection() {
    const [config, setConfig] = useState({
        endpoint: "",
        accessKey: "",
        secretKey: "",
        bucketLpr: "lpr",
        bucketFace: "face"
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [lifecycles, setLifecycles] = useState({
        lpr: 0,
        face: 0
    });
    const [savingLifecycle, setSavingLifecycle] = useState(false);
    const [stats, setStats] = useState({
        lpr: { size: 0, count: 0, loading: true },
        face: { size: 0, count: 0, loading: true }
    });

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [e, ak, sk, bl, bf] = await Promise.all([
                    getSetting("S3_ENDPOINT"),
                    getSetting("S3_ACCESS_KEY"),
                    getSetting("S3_SECRET_KEY"),
                    getSetting("S3_BUCKET_LPR"),
                    getSetting("S3_BUCKET_FACE")
                ]);
                setConfig({
                    endpoint: e?.value || "",
                    accessKey: ak?.value || "",
                    secretKey: sk?.value || "",
                    bucketLpr: bl?.value || "lpr",
                    bucketFace: bf?.value || "face"
                });
                // Load lifecycles
                const [lcLpr, lcFace] = await Promise.all([
                    getBucketLifecycle(bl?.value || "lpr"),
                    getBucketLifecycle(bf?.value || "face")
                ]);

                setLifecycles({
                    lpr: lcLpr.success ? lcLpr.days || 0 : 0,
                    face: lcFace.success ? lcFace.days || 0 : 0
                });

                // Load stats
                const [statsLpr, statsFace] = await Promise.all([
                    getBucketStats(bl?.value || "lpr"),
                    getBucketStats(bf?.value || "face")
                ]);

                setStats({
                    lpr: {
                        size: statsLpr.success ? statsLpr.size : 0,
                        count: statsLpr.success ? statsLpr.count : 0,
                        loading: false
                    },
                    face: {
                        size: statsFace.success ? statsFace.size : 0,
                        count: statsFace.success ? statsFace.count : 0,
                        loading: false
                    }
                });
            } catch (err) {
                console.error("Error loading S3 settings:", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                updateSetting("S3_ENDPOINT", config.endpoint),
                updateSetting("S3_ACCESS_KEY", config.accessKey),
                updateSetting("S3_SECRET_KEY", config.secretKey),
                updateSetting("S3_BUCKET_LPR", config.bucketLpr),
                updateSetting("S3_BUCKET_FACE", config.bucketFace)
            ]);
            toast.success("Configuración de almacenamiento guardada");
        } catch (err) {
            toast.error("Error al guardar la configuración");
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            const resLpr = await testS3Connection("lpr");
            const resFace = await testS3Connection("face");

            if (resLpr.success && resFace.success) {
                toast.success("¡Prueba exitosa! Ambos buckets son accesibles.");
            } else {
                if (!resLpr.success) toast.error(`LPR: ${resLpr.message}`);
                if (!resFace.success) toast.error(`FACE: ${resFace.message}`);
            }
        } catch (err) {
            toast.error("Error crítico al intentar conectar con el servidor S3");
        } finally {
            setTesting(false);
        }
    };

    const handleSaveLifecycle = async () => {
        setSavingLifecycle(true);
        try {
            const resLpr = await updateBucketLifecycle(config.bucketLpr, lifecycles.lpr);
            const resFace = await updateBucketLifecycle(config.bucketFace, lifecycles.face);

            if (resLpr.success && resFace.success) {
                toast.success("Políticas de retención actualizadas correctamente");
            } else {
                toast.error("Error al actualizar algunas políticas");
            }
        } catch (err) {
            toast.error("Error de comunicación S3");
        } finally {
            setSavingLifecycle(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 bg-neutral-900/50 rounded-2xl border border-white/5">
                <RefreshCcw className="animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Configuración S3 / MinIO</h2>
                        <p className="text-sm text-neutral-500 mt-1">Define dónde se guardarán físicamente todas las evidencias capturadas</p>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Cloud className="text-blue-400" size={24} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Info size={14} className="text-blue-400" />
                            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Servidor & Credenciales</h3>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-neutral-500 ml-1">Endpoint (API)</Label>
                            <Input
                                placeholder="http://192.168.99.108:9000"
                                value={config.endpoint}
                                onChange={e => setConfig({ ...config, endpoint: e.target.value })}
                                className="bg-black/40 border-white/5 h-11 text-sm font-mono"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-500 ml-1">Access Key</Label>
                                <Input
                                    placeholder="root"
                                    value={config.accessKey}
                                    onChange={e => setConfig({ ...config, accessKey: e.target.value })}
                                    className="bg-black/40 border-white/5 h-11 text-sm font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-500 ml-1">Secret Key</Label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={config.secretKey}
                                    onChange={e => setConfig({ ...config, secretKey: e.target.value })}
                                    className="bg-black/40 border-white/5 h-11 text-sm font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Database size={14} className="text-purple-400" />
                            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Estructura de Buckets</h3>
                        </div>

                        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3 mb-4">
                            <ShieldAlert className="text-amber-500 shrink-0" size={18} />
                            <p className="text-[10px] text-amber-200/60 leading-relaxed font-medium">
                                Asegúrate de que los buckets existan en tu servidor MinIO antes de guardar.
                                La aplicación NO los creará automáticamente.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-neutral-500 ml-1">Bucket LPR</Label>
                            <Input
                                placeholder="lpr"
                                value={config.bucketLpr}
                                onChange={e => setConfig({ ...config, bucketLpr: e.target.value })}
                                className="bg-black/40 border-white/5 h-11 text-sm font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-neutral-500 ml-1">Bucket Face</Label>
                            <Input
                                placeholder="face"
                                value={config.bucketFace}
                                onChange={e => setConfig({ ...config, bucketFace: e.target.value })}
                                className="bg-black/40 border-white/5 h-11 text-sm font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* Lifecycle Management Section */}
                <div className="mt-12 pt-8 border-t border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                        <Activity size={20} className="text-amber-400" />
                        <div>
                            <h3 className="text-lg font-bold text-white">Políticas de Retención (Lifecycle)</h3>
                            <p className="text-xs text-neutral-500 font-medium">Configura el ciclo de vida de los datos para limpieza automática en MinIO</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* LPR Retention */}
                        <div className="bg-neutral-950/40 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Activity size={80} />
                            </div>
                            <div className="flex items-center justify-between mb-4">
                                <Label className="text-sm font-black text-white uppercase tracking-tight">Vencimiento Bucket LPR</Label>
                                <div className="px-2 py-1 bg-blue-500/10 rounded text-[10px] font-bold text-blue-400">
                                    {lifecycles.lpr === 0 ? "SIN LIMpieza" : `${lifecycles.lpr} DÍAS`}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <p className="text-[10px] text-neutral-500 leading-relaxed">
                                    Las imágenes de las capturas se eliminarán permanentemente de MinIO después de transcurrido este tiempo. Use <span className="text-white">0</span> para desactivar.
                                </p>
                                <div className="flex items-center gap-4">
                                    <Input
                                        type="number"
                                        value={lifecycles.lpr}
                                        onChange={e => setLifecycles({ ...lifecycles, lpr: parseInt(e.target.value) || 0 })}
                                        className="bg-black/60 border-white/10 h-10 w-24 text-center font-bold text-blue-400"
                                    />
                                    <span className="text-xs text-neutral-400 font-medium">Días de retención</span>
                                </div>

                                {/* Stats LPR */}
                                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">Archivos</p>
                                        <div className="flex items-center gap-2">
                                            <FileText size={12} className="text-blue-500/50" />
                                            <span className="text-xs font-mono font-bold text-neutral-300">
                                                {stats.lpr.loading ? "..." : stats.lpr.count.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">Peso Total</p>
                                        <div className="flex items-center gap-2">
                                            <HardDrive size={12} className="text-blue-500/50" />
                                            <span className="text-xs font-mono font-bold text-neutral-300">
                                                {stats.lpr.loading ? "..." : formatSize(stats.lpr.size)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Face Retention */}
                        <div className="bg-neutral-950/40 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Activity size={80} />
                            </div>
                            <div className="flex items-center justify-between mb-4">
                                <Label className="text-sm font-black text-white uppercase tracking-tight">Vencimiento Bucket FACE</Label>
                                <div className="px-2 py-1 bg-purple-500/10 rounded text-[10px] font-bold text-purple-400">
                                    {lifecycles.face === 0 ? "SIN LIMpieza" : `${lifecycles.face} DÍAS`}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <p className="text-[10px] text-neutral-500 leading-relaxed">
                                    Las fotos de perfil y rostros detectados se eliminarán después de este periodo. Se recomienda un tiempo mayor que LPR.
                                </p>
                                <div className="flex items-center gap-4">
                                    <Input
                                        type="number"
                                        value={lifecycles.face}
                                        onChange={e => setLifecycles({ ...lifecycles, face: parseInt(e.target.value) || 0 })}
                                        className="bg-black/60 border-white/10 h-10 w-24 text-center font-bold text-purple-400"
                                    />
                                    <span className="text-xs text-neutral-400 font-medium">Días de retención</span>
                                </div>

                                {/* Stats FACE */}
                                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">Archivos</p>
                                        <div className="flex items-center gap-2">
                                            <FileText size={12} className="text-purple-500/50" />
                                            <span className="text-xs font-mono font-bold text-neutral-300">
                                                {stats.face.loading ? "..." : stats.face.count.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">Peso Total</p>
                                        <div className="flex items-center gap-2">
                                            <HardDrive size={12} className="text-purple-500/50" />
                                            <span className="text-xs font-mono font-bold text-neutral-300">
                                                {stats.face.loading ? "..." : formatSize(stats.face.size)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button
                            variant="outline"
                            onClick={handleSaveLifecycle}
                            disabled={savingLifecycle || loading}
                            className="bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white font-black px-6 h-10 rounded-xl transition-all"
                        >
                            {savingLifecycle ? <RefreshCcw className="animate-spin mr-2" size={14} /> : <Activity className="mr-2" size={14} />}
                            APLICAR POLÍTICAS DE RETENCIÓN
                        </Button>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={handleTest}
                        disabled={testing || saving}
                        className="text-neutral-400 hover:text-white hover:bg-white/5 font-bold px-6 h-12 rounded-xl border border-white/5"
                    >
                        {testing ? <RefreshCcw className="animate-spin mr-2" size={16} /> : <Activity className="mr-2" size={16} />}
                        PROBAR CONEXIÓN
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || testing}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-black px-8 h-12 rounded-xl shadow-xl shadow-blue-600/20"
                    >
                        {saving ? <RefreshCcw className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                        GUARDAR CONFIGURACIÓN
                    </Button>
                </div>
            </div>
        </div>
    );
}
