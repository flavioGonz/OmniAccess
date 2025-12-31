"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Car,
    Settings,
    ShieldCheck,
    History,
    DoorOpen,
    HelpCircle,
    LayoutGrid,
    Map,
    Video,
    ScanFace,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Menu,
    Activity,
    CreditCard
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HelpMenu } from "@/components/HelpMenu";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    href: string;
    active: boolean;
    collapsed: boolean;
}

function SidebarItem({ icon, label, href, active, collapsed }: SidebarItemProps) {
    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all group relative",
                active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:bg-neutral-800 hover:text-white",
                collapsed && "justify-center px-2"
            )}
        >
            <div className={cn("shrink-0", active ? "text-blue-500" : "group-hover:text-blue-400")}>
                {icon}
            </div>
            {!collapsed && (
                <span className="whitespace-nowrap transition-opacity duration-300">{label}</span>
            )}
            {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-neutral-900 border border-neutral-800 text-white text-[10px] uppercase font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                    {label}
                </div>
            )}
        </Link>
    );
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100 font-sans">
            {/* Sidebar */}
            <aside
                className={cn(
                    "border-r border-neutral-800/50 flex flex-col fixed h-full bg-neutral-900/80 backdrop-blur-xl z-20 transition-all duration-300 ease-in-out",
                    collapsed ? "w-[70px]" : "w-64"
                )}
            >
                <div className="p-4 border-b border-neutral-800/50 bg-black/20 flex items-center justify-between h-[60px]">
                    <div className={cn("flex items-center gap-2 overflow-hidden transition-all", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center shrink-0">
                            <ShieldCheck size={14} className="text-white" />
                        </div>
                        <div className="whitespace-nowrap">
                            <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                                OmniAccess
                            </h2>
                            <p className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest">Control y acceso</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={cn(
                            "p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 transition-colors",
                            collapsed && "mx-auto"
                        )}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
                    <SidebarItem icon={<LayoutDashboard size={18} />} label="Monitor en Vivo" href="/admin/dashboard" active={pathname === "/admin/dashboard"} collapsed={collapsed} />
                    <SidebarItem icon={<History size={18} />} label="Historial de Acceso" href="/admin/history" active={pathname === "/admin/history"} collapsed={collapsed} />

                    {!collapsed && <div className="pt-3 pb-1 px-3 text-[9px] font-semibold text-neutral-600 uppercase tracking-wider transition-opacity">Gestión</div>}
                    {collapsed && <div className="my-2 border-t border-neutral-800" />}

                    <SidebarItem icon={<Users size={18} />} label="Usuarios & Residentes" href="/admin/users" active={pathname === "/admin/users"} collapsed={collapsed} />
                    <SidebarItem icon={<DoorOpen size={18} />} label="Unidades / Lotes" href="/admin/units" active={pathname === "/admin/units"} collapsed={collapsed} />
                    <SidebarItem icon={<Car size={18} />} label="Vehículos / Matrículas" href="/admin/vehicles" active={pathname === "/admin/vehicles" || pathname === "/admin/credentials"} collapsed={collapsed} />
                    <SidebarItem icon={<CreditCard size={18} />} label="Tags RFID" href="/admin/rfid" active={pathname === "/admin/rfid"} collapsed={collapsed} />
                    <SidebarItem icon={<LayoutGrid size={18} />} label="Plazas de Parking" href="/admin/plazas" active={pathname === "/admin/plazas"} collapsed={collapsed} />
                    <SidebarItem icon={<Video size={18} />} label="Dispositivos LPR" href="/admin/devices?type=LPR_CAMERA" active={pathname?.includes("devices") && pathname.includes("type=LPR")} collapsed={collapsed} />
                    <SidebarItem icon={<ScanFace size={18} />} label="Dispositivos Faciales" href="/admin/devices?type=FACE_TERMINAL" active={pathname?.includes("devices") && pathname.includes("type=FACE")} collapsed={collapsed} />
                    <SidebarItem icon={<Users size={18} />} label="Grupos de Acceso" href="/admin/groups" active={pathname === "/admin/groups"} collapsed={collapsed} />

                    {!collapsed && <div className="pt-3 pb-1 px-3 text-[9px] font-semibold text-neutral-600 uppercase tracking-wider transition-opacity">Reportes</div>}
                    {collapsed && <div className="my-2 border-t border-neutral-800" />}

                    <SidebarItem icon={<Calendar size={18} />} label="Calendario" href="/admin/calendar" active={pathname === "/admin/calendar"} collapsed={collapsed} />
                    <SidebarItem icon={<Settings size={18} />} label="Configuración" href="/admin/settings" active={pathname === "/admin/settings"} collapsed={collapsed} />
                    <SidebarItem icon={<Activity size={18} />} label="Debug Webhooks" href="/admin/debug" active={pathname === "/admin/debug"} collapsed={collapsed} />
                </nav>

                {/* MinIO Retention Badge */}
                {!collapsed && (
                    <div className="px-4 pb-2 mt-auto">
                        <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-2.5 flex flex-col items-center gap-0.5">
                            <p className="text-[8px] text-orange-400 font-bold uppercase tracking-widest text-center leading-tight opacity-80">
                                Retención MinIO
                            </p>
                            <p className="text-xs text-orange-300 font-black">
                                30 Días
                            </p>
                        </div>
                    </div>
                )}

                <div className="p-3 border-t border-neutral-800 space-y-2">
                    {!collapsed && <HelpMenu />}
                    {collapsed && (
                        <div className="flex justify-center">
                            <div className="p-2 rounded-lg bg-neutral-800 text-neutral-400">
                                <HelpCircle size={18} />
                            </div>
                        </div>
                    )}

                    <div className={cn("flex items-center gap-3 group cursor-pointer p-2 rounded-2xl hover:bg-neutral-800/50 transition-colors", collapsed && "justify-center p-0 hover:bg-transparent")}>
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-blue-500/20 shrink-0">
                            A
                        </div>
                        {!collapsed && (
                            <div className="overflow-hidden">
                                <p className="text-sm font-black text-white leading-tight truncate">Admin User</p>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter truncate">Super Admin</p>
                            </div>
                        )}
                        {!collapsed && <Settings size={14} className="ml-auto text-neutral-600 group-hover:text-white transition-colors" />}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main
                className={cn(
                    "flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out font-sans h-screen",
                    collapsed ? "ml-[70px]" : "ml-64"
                )}
            >
                {children}
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #262626;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
