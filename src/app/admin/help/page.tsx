"use client";

import { useState } from "react";
import {
    HelpCircle,
    LayoutDashboard,
    Calendar,
    History,
    Home,
    Users,
    Car,
    Cpu,
    Key,
    ShieldCheck,
    CreditCard,
    LayoutGrid,
    Settings,
    Activity,
    ChevronRight,
    Search,
    Info,
    ArrowRight,
    Layers,
    ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const DOCS = [
    {
        id: "dashboard",
        title: "Panel de Control",
        icon: LayoutDashboard,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        description: "Vista centralizada en tiempo real de todos los eventos perimetrales.",
        details: "El Dashboard es el corazón de la plataforma. Aquí puedes ver el flujo en vivo de vehículos y peatones. Incluye estadísticas de ocupación de estacionamiento, alertas de seguridad de último minuto y un panel de 'Acciones Rápidas' para abrir barreras o puertas manualmente desde cualquier lugar.",
        features: ["Streaming de eventos", "Estadísticas de ocupación", "Alertas en tiempo real", "Acciones de relé"],
        image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "calendar",
        title: "Calendario",
        icon: Calendar,
        color: "text-indigo-400",
        bg: "bg-indigo-500/10",
        description: "Gestión de reservaciones y eventos programados.",
        details: "El módulo de calendario permite programar visitas, reservar espacios de estacionamiento y visualizar eventos de mantenimiento. Puedes sincronizar horarios con los grupos de acceso para que los permisos se activen o desactiven automáticamente según fechas específicas.",
        features: ["Reservas de parking", "Visitas programadas", "Mantenimiento preventivo"],
        image: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "history",
        title: "Historial de Accesos",
        icon: History,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        description: "Auditoría forense de entradas y salidas.",
        details: "El historial almacena cada evento capturado por las cámaras LPR y terminales faciales. Incluye fotos de las matrículas, rostros, marca del vehículo y decisión de acceso (Permitido/Denegado). Puedes exportar informes resumidos para auditorías de seguridad.",
        features: ["Filtros por fecha/matrícula", "Fotos de evidencia", "Exportación CSV/PDF"],
        image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "units",
        title: "Unidades Operativas",
        icon: Home,
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        description: "Organización física del complejo (Edificios, Casas).",
        details: "Define la jerarquía de tu complejo. Puedes registrar edificios, departamentos, lotes o casas. Cada unidad es el nexo para vincular a los residentes y sus respectivos vehículos y dispositivos asociados.",
        features: ["Gestión catastral", "Vínculo residente-unidad", "Mapa de niveles"],
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "users",
        title: "Gestión de Usuarios",
        icon: Users,
        color: "text-violet-400",
        bg: "bg-violet-500/10",
        description: "Administración de identidades y roles.",
        details: "Registra residentes, visitas permanentes, empleados o proveedores. Aquí se gestionan los datos biométricos y se asignan los roles que determinarán qué puertas o barreras pueden abrir y en qué horarios.",
        features: ["Perfiles biométricos", "Roles de seguridad", "Gestión de visitas"],
        image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "vehicles",
        title: "Vehículos & Patentes",
        icon: Car,
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        description: "Control maestro de flotas y patentes.",
        details: "Vincula matrículas a usuarios específicos. El sistema reconoce automáticamente estos vehículos cuando se acercan a una cámara LPR, permitiendo o denegando el paso basándose en las reglas del grupo de acceso del propietario.",
        features: ["Reconocimiento de marca/modelo", "Historial por vehículo", "Listas blancas/negras"],
        image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "devices",
        title: "Infraestructura Hardware",
        icon: Cpu,
        color: "text-cyan-400",
        bg: "bg-cyan-500/10",
        description: "Configuración de terminales y sensores.",
        details: "Configuración técnica de cámaras LPR, lectores faciales Akuvox, y controladores de relé. Aquí gestionas las IPs, protocolos de autenticación y el monitoreo de estado 'Online' de cada dispositivo físico del perímetro.",
        features: ["Gestión IP ISAPI/SIP", "Estado de conexión", "Configuración de dirección (E/S)"],
        image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "credentials",
        title: "Credenciales",
        icon: Key,
        color: "text-orange-400",
        bg: "bg-orange-500/10",
        description: "Llaves digitales, biometría y TAGs.",
        details: "Gestión centralizada de todos los métodos de apertura. Desde pins numéricos y tarjetas RFID hasta plantillas faciales y huellas dactilares cargadas remotamente en los dispositivos.",
        features: ["Carga remota de rostros", "Control de TAGs RFID", "Pins temporales"],
        image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "groups",
        title: "Grupos de Acceso",
        icon: ShieldCheck,
        color: "text-sky-400",
        bg: "bg-sky-500/10",
        description: "Motor de reglas por zonas y jerarquías.",
        details: "Define quién puede entrar a qué lugar. Crea grupos como 'Residentes Zona Norte' o 'Personal de Limpieza', vincula los dispositivos correspondientes y asigna los horarios permitidos para automatizar la seguridad.",
        features: ["Políticas de horario", "Accesos por zonas", "Reglas dinámicas"],
        image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "plazas",
        title: "Estacionamiento",
        icon: LayoutGrid,
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        description: "Mapa de ocupación y control de espacios.",
        details: "Visualiza el estado de cada plaza de estacionamiento. Vincula plazas a unidades o usuarios específicos y monitorea infracciones de parqueo mediante la correlación de eventos LPR.",
        features: ["Mapa interactivo 2D", "Control de rotación", "Indicadores de disponibilidad"],
        image: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "settings",
        title: "Configuración",
        icon: Settings,
        color: "text-slate-400",
        bg: "bg-slate-500/10",
        description: "Ajustes globales y auditoría de sistema.",
        details: "Parámetros críticos: tiempos de apertura de relé, configuración del servidor de webhooks, backups de base de datos y personalización visual de la plataforma.",
        features: ["Configuración API", "Variables de servidor", "Personalización UI"],
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800"
    },
    {
        id: "debug",
        title: "Consola de Diagnóstico",
        icon: Activity,
        color: "text-red-400",
        bg: "bg-red-500/10",
        description: "Monitor de bajo nivel y depuración de red.",
        details: "Herramienta exclusiva para administradores técnicos. Muestra los payloads crudos de los webhooks entrantes, logs de conexión a base de datos y latencia de los dispositivos en red.",
        features: ["Raw JSON logs", "Test de conectividad", "Consola de eventos ISAPI"],
        image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=800"
    }
];

export default function HelpPage() {
    const [selectedDocs, setSelectedDocs] = useState(DOCS[0]);

    return (
        <div className="p-6 flex flex-col gap-8 pb-20 max-w-[1400px] mx-auto animate-in fade-in duration-700">
            {/* Header Hero */}
            <section className="relative overflow-hidden bg-neutral-900 border border-white/5 p-12 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center gap-10">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <HelpCircle size={300} />
                </div>
                <div className="relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/20 shrink-0">
                    <Info size={48} className="text-white" />
                </div>
                <div className="relative z-10 flex-1 text-center md:text-left">
                    <h1 className="text-5xl font-black text-white uppercase tracking-tighter leading-none mb-4">
                        Centro de <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Documentación</span>
                    </h1>
                    <p className="text-neutral-500 text-lg font-medium max-w-2xl leading-relaxed">
                        Explora los módulos de la plataforma LPR-NODE. Haz clic en una sección para ver la guía detallada de funcionamiento.
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-8">
                        <button className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2">
                            Guía Rápida <ArrowRight size={16} />
                        </button>
                        <a href="/admin/help/structure" className="h-12 px-6 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2">
                            Mapa de Estructura <Layers size={16} />
                        </a>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Navigation Menu */}
                <aside className="lg:col-span-3 space-y-2 lg:sticky lg:top-8">
                    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] px-4 mb-4">Secciones del Sistema</p>
                    {DOCS.map((doc) => (
                        <button
                            key={doc.id}
                            onClick={() => setSelectedDocs(doc)}
                            className={cn(
                                "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left border",
                                selectedDocs.id === doc.id
                                    ? "bg-neutral-800/50 border-white/10 shadow-xl"
                                    : "bg-transparent border-transparent text-neutral-500 hover:bg-white/5"
                            )}
                        >
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                                selectedDocs.id === doc.id ? doc.bg + " " + doc.color + " border-white/10" : "bg-neutral-900 border-neutral-800"
                            )}>
                                <doc.icon size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={cn(
                                    "text-sm font-black uppercase tracking-tight truncate",
                                    selectedDocs.id === doc.id ? "text-white" : "text-neutral-500"
                                )}>
                                    {doc.title}
                                </p>
                            </div>
                            {selectedDocs.id === doc.id && (
                                <ChevronRight size={16} className="text-white/20" />
                            )}
                        </button>
                    ))}
                </aside>

                {/* Main Content Viewer */}
                <main className="lg:col-span-9 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="bg-neutral-900 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row">
                        {/* Image Placeholder */}
                        <div className="md:w-[45%] h-64 md:h-auto relative bg-neutral-800 overflow-hidden">
                            <Image
                                src={selectedDocs.image}
                                alt={selectedDocs.title}
                                fill
                                className="object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent" />
                            <div className="absolute top-6 left-6 p-3 bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl">
                                <selectedDocs.icon size={32} className={selectedDocs.color} />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-10 flex-1 space-y-6">
                            <div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">{selectedDocs.title}</h2>
                                <p className="text-lg text-neutral-400 font-medium leading-relaxed">{selectedDocs.description}</p>
                            </div>

                            <div className="h-px bg-white/5 w-full" />

                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Funcionamiento Técnico</p>
                                <p className="text-neutral-500 leading-relaxed font-medium">
                                    {selectedDocs.details}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                                {selectedDocs.features.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        <span className="text-xs font-black text-neutral-400 uppercase tracking-tight">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-8">
                                <button className="inline-flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] group">
                                    Ver documentación técnica completa <ExternalLink size={14} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Info Card */}
                    <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 rounded-3xl p-8 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                <Activity size={32} />
                            </div>
                            <div>
                                <p className="text-white font-black uppercase tracking-tight">Consola de Desarrollo</p>
                                <p className="text-sm text-neutral-400 font-medium">Puedes habilitar el modo depuración para ver eventos ISAPI en vivo.</p>
                            </div>
                        </div>
                        <button className="h-12 px-6 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all">
                            Ir a Debug
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
}
