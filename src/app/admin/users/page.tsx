"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { getUsers, deleteUser } from "@/app/actions/users";
import { getUnits } from "@/app/actions/units";
import { getAccessGroups } from "@/app/actions/groups";
import { getParkingSlots } from "@/app/actions/parking";
import { getDevices, getLprSyncMap } from "@/app/actions/devices";
import { UserRole } from "@prisma/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    UserCheck,
    UserX,
    Users,
    Shield,
    Briefcase,
    Car,
    Truck,
    Bus,
    Bike,
    Plus,
    Trash2,
    Edit,
    Search,
    ScanFace,
    Camera,
    CreditCard,
    Building2,
    KeyRound,
    Fingerprint,
    Server,
    ShieldCheck,
    Loader2,
    ChevronDown,
    Zap,
    Filter
} from "lucide-react";
import { UserFormDialog } from "@/components/UserFormDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { cn } from "@/lib/utils";

// Mock User with relations until prisma generate is ready
interface UserWithRelations {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    dni: string | null;
    cara: string | null;
    role: UserRole;
    apartment: string | null;
    accessTags: string[];
    createdAt: Date;
    updatedAt: Date;
    unitId: string | null;
    parkingSlotId: string | null;
    unit: any | null;
    credentials: any[];
    accessGroups: any[];
    vehicles: any[];
    [key: string]: any; // Allow additional properties
}

const ROLE_LABELS: Record<string, { label: string, color: string, icon: any }> = {
    RESIDENT: { label: "Residente", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: UserCheck },
    VISITOR: { label: "Visitante", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: UserX },
    STAFF: { label: "Personal", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: Briefcase },
    ADMIN: { label: "Admin", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: Shield },
};

export default function UsersPage() {
    const [users, setUsers] = useState<UserWithRelations[]>([]);
    const [visibleUsers, setVisibleUsers] = useState<UserWithRelations[]>([]);
    const [units, setUnits] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [parkingSlots, setParkingSlots] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [lprSyncMap, setLprSyncMap] = useState<Record<string, string[]>>({});
    const [isSyncLoading, setIsSyncLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterRole, setFilterRole] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<UserWithRelations | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserWithRelations | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const observerTarget = useRef(null);
    const pageSize = 10;

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && !searchQuery && !filterRole && visibleUsers.length < users.length) {
                    handleLoadMore();
                }
            },
            { threshold: 0.1 }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, [visibleUsers, users, searchQuery, filterRole]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [usersData, unitsData, groupsData, parkingData, devicesData] = await Promise.all([
                getUsers(),
                getUnits(),
                getAccessGroups(),
                getParkingSlots(),
                getDevices()
            ]);
            setUsers(usersData as UserWithRelations[]);
            setUnits(unitsData);
            setGroups(groupsData);
            setParkingSlots(parkingData);
            setDevices(devicesData);
            setVisibleUsers(usersData.slice(0, pageSize) as UserWithRelations[]);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSyncMap = async () => {
        setIsSyncLoading(true);
        try {
            const data = await getLprSyncMap();
            setLprSyncMap(data);
        } catch (error) {
            console.error("Error fetching sync map:", error);
        } finally {
            setIsSyncLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleLoadMore = () => {
        const nextBatch = users.slice(visibleUsers.length, visibleUsers.length + pageSize);
        if (nextBatch.length > 0) {
            setVisibleUsers(prev => [...prev, ...nextBatch]);
        }
    };


    const filteredUsers = users.filter(user => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = (
            user.name?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query) ||
            user.phone?.toLowerCase().includes(query) ||
            user.unit?.name?.toLowerCase().includes(query)
        );
        const matchesRole = filterRole ? user.role === filterRole : true;
        return matchesSearch && matchesRole;
    });

    // Use filtered users for the visible view when searching or filtering, else use the paginated visibleUsers
    const usersToDisplay = (searchQuery || filterRole) ? filteredUsers : visibleUsers;

    const getCredentialsInfo = (user: UserWithRelations) => {
        const hasFace = user.credentials?.some((c: any) => c.type === 'FACE') || !!user.cara;
        const hasTag = user.credentials?.some((c: any) => c.type === 'TAG');
        const hasPin = user.credentials?.some((c: any) => c.type === 'PIN');
        const hasFinger = user.credentials?.some((c: any) => c.type === 'FINGERPRINT');
        const hasPlate = user.credentials?.some((c: any) => c.type === 'PLATE') || (user.vehicles && user.vehicles.length > 0);

        return { hasFace, hasTag, hasPin, hasFinger, hasPlate };
    };

    return (
        <div className="relative h-screen flex flex-col gap-6 p-6 overflow-hidden">

            {/* Header */}
            <div className="relative flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3">
                        <Users className="text-blue-500" size={32} />
                        GESTIÓN DE IDENTIDADES
                    </h1>
                    <div className="flex items-center gap-2 text-neutral-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Directorio Maestro de Residentes y Staff</p>
                    </div>
                </div>
                <Button
                    onClick={fetchSyncMap}
                    disabled={isSyncLoading}
                    className="bg-neutral-900 hover:bg-neutral-800 text-neutral-400 h-12 px-6 rounded-lg font-black uppercase tracking-widest transition-all border border-white/5"
                >
                    {isSyncLoading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} className="mr-2" />}
                    {isSyncLoading ? "Escaneando..." : "Escanear Hardware"}
                </Button>
                <Button
                    onClick={() => {
                        setSelectedUser(null);
                        setIsFormOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white h-12 px-8 rounded-lg font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 border border-white/10"
                >
                    <Plus size={20} className="mr-2 stroke-[3px]" />
                    Nuevo Usuario
                </Button>
            </div>

            {/* Search & Stats Bar */}
            <div className="relative flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="text-neutral-600 group-focus-within:text-blue-500 transition-colors" size={20} />
                    </div>
                    <Input
                        placeholder="Buscar por nombre, email, teléfono..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-14 bg-neutral-900/40 backdrop-blur-xl border-white/5 rounded-lg text-base font-medium placeholder:text-neutral-700 focus:bg-neutral-900/60 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    />
                </div>

                <div className="flex gap-2">
                    <div className="bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-lg px-6 flex items-center gap-4">
                        <div className="text-center">
                            <p className="text-xl font-black text-white leading-none">{users.length}</p>
                            <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mt-1">Total</p>
                        </div>
                        <div className="w-[1px] h-8 bg-white/5" />
                        <div className="text-center">
                            <p className="text-xl font-black text-blue-400 leading-none">{users.filter(u => getCredentialsInfo(u).hasFace).length}</p>
                            <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mt-1">Face ID</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <div className="flex items-center gap-2 pr-4 border-r border-white/5 mr-2">
                    <Filter size={14} className="text-neutral-500" />
                    <span className="text-[10px] font-bold uppercase text-neutral-600 tracking-widest">Filtrar:</span>
                </div>
                <Button
                    variant="ghost"
                    onClick={() => setFilterRole(null)}
                    className={cn(
                        "h-8 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all border",
                        filterRole === null
                            ? "bg-white text-black border-white hover:bg-white/90"
                            : "bg-transparent text-neutral-500 border-neutral-800 hover:text-white hover:border-white/20 hover:bg-white/5"
                    )}
                >
                    Todos
                </Button>
                {Object.entries(ROLE_LABELS).map(([key, info]) => {
                    const RoleIcon = info.icon;
                    const isActive = filterRole === key;
                    return (
                        <Button
                            key={key}
                            variant="ghost"
                            onClick={() => setFilterRole(isActive ? null : key)}
                            className={cn(
                                "h-8 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all gap-2",
                                isActive
                                    ? cn(info.color, "bg-opacity-20 border-opacity-50 ring-1 ring-white/10")
                                    : "bg-transparent text-neutral-500 border-neutral-800 hover:text-white hover:border-white/20 hover:bg-white/5"
                            )}
                        >
                            <RoleIcon size={12} />
                            {info.label}
                        </Button>
                    );
                })}
            </div>

            {/* Main Content Area with Backdrop Blur & Infinite Scroll */}
            <div className="flex-1 relative rounded-xl border border-white/5 bg-[#080808]/40 backdrop-blur-2xl overflow-hidden shadow-2xl group/table">

                {/* Scroll Container */}
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                    <Table>
                        <TableHeader className="sticky top-0 bg-[#080808]/90 backdrop-blur-xl z-20 shadow-sm border-b border-white/5">
                            <TableRow className="border-white/5 hover:bg-transparent bg-transparent">
                                <TableHead className="text-neutral-500 font-black uppercase text-[10px] tracking-widest py-6 px-4">Usuario & Perfil</TableHead>
                                <TableHead className="text-neutral-500 font-black uppercase text-[10px] tracking-widest px-4">Grupos de Acceso</TableHead>
                                <TableHead className="text-neutral-500 font-black uppercase text-[10px] tracking-widest px-4">Dispositivos Cargados</TableHead>
                                <TableHead className="text-neutral-500 font-black uppercase text-[10px] tracking-widest px-4">Sincro Hardware</TableHead>
                                <TableHead className="text-neutral-500 font-black uppercase text-[10px] tracking-widest px-4">Origen de Datos</TableHead>
                                <TableHead className="text-neutral-500 font-black uppercase text-[10px] tracking-widest text-right px-8">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4 py-20 grayscale opacity-20">
                                            <Loader2 className="animate-spin text-white" size={48} />
                                            <p className="text-xs font-black uppercase tracking-[0.5em]">Cargando Base de Datos...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : usersToDisplay.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4 py-20 opacity-20">
                                            <UserX size={64} />
                                            <p className="text-xs font-black uppercase tracking-[0.5em]">No se encontraron usuarios</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {usersToDisplay.map((user, idx) => {
                                        const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.RESIDENT;
                                        const RoleIcon = roleInfo.icon;
                                        const creds = getCredentialsInfo(user);
                                        const syncDevices = user.accessGroups?.flatMap((g: any) => g.devices || []) || [];
                                        const uniqueDevices = Array.from(new Map(syncDevices.map((d: any) => [d.id, d])).values());

                                        const tagCred = user.credentials?.find((c: any) => c.type === 'TAG' && c.notes?.includes("Importado"));
                                        const importSource = tagCred?.notes?.match(/\[(.*?)\]/)?.[1] || "";
                                        const isImported = !!tagCred;

                                        return (
                                            <TableRow key={user.id} className="border-white/5 hover:bg-blue-500/[0.02] transition-colors group">
                                                <TableCell className="py-5 px-4 max-w-[250px]">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative shrink-0">
                                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-950 border border-white/5 flex items-center justify-center overflow-hidden">
                                                                {user.cara ? (
                                                                    <img src={user.cara} alt={user.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                                                                ) : (
                                                                    <span className="text-sm font-black text-neutral-600 group-hover:text-blue-500 transition-colors uppercase">
                                                                        {user.name?.[0]}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {creds.hasFace && (
                                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#080808] flex items-center justify-center">
                                                                    <Zap size={6} className="text-white fill-white" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-white text-xs uppercase tracking-tight truncate">{user.name}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Badge variant="outline" className={cn("h-4 px-1.5 text-[8px] font-bold uppercase border-0 rounded-sm", roleInfo.color)}>
                                                                    {roleInfo.label}
                                                                </Badge>
                                                                <span className="text-[9px] text-neutral-600 font-bold max-w-[80px] truncate">{user.unit?.name || "Sin Unidad"}</span>
                                                            </div>
                                                            {user.vehicles && user.vehicles.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {user.vehicles.map((v: any) => (
                                                                        <div key={v.id} className="flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                                                            <Car size={8} className="text-blue-400" />
                                                                            <span className="text-[8px] font-black text-blue-400 font-mono">{v.plate}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            <div className="flex gap-1.5 mt-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                                <ScanFace size={12} className={cn(creds.hasFace ? "text-blue-400" : "text-neutral-800")} />
                                                                <CreditCard size={12} className={cn(creds.hasTag ? "text-emerald-400" : "text-neutral-800")} />
                                                                <Fingerprint size={12} className={cn(creds.hasFinger ? "text-purple-400" : "text-neutral-800")} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {user.accessGroups && user.accessGroups.length > 0 ? (
                                                            user.accessGroups.map((g: any) => (
                                                                <Badge key={g.id} variant="secondary" className="bg-neutral-900 border border-neutral-800 text-neutral-400 text-[9px] font-bold hover:bg-neutral-800 px-1.5 h-5 rounded-md">
                                                                    {g.name}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-neutral-700 uppercase">Sin Grupos</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4">
                                                    <div className="flex flex-col gap-1">
                                                        {uniqueDevices.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {uniqueDevices.slice(0, 3).map((d: any) => (
                                                                    <div key={d.id} className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded text-[9px] font-bold text-neutral-400 border border-white/5">
                                                                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                                        {d.name.split(' ')[0]}
                                                                    </div>
                                                                ))}
                                                                {uniqueDevices.length > 3 && (
                                                                    <span className="text-[9px] text-neutral-600 font-bold px-1 py-0.5">+{uniqueDevices.length - 3}</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-neutral-800 uppercase">-</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4">
                                                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                                                        {user.vehicles && user.vehicles.length > 0 ? (
                                                            user.vehicles.map((v: any) => {
                                                                const normPlate = v.plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
                                                                const devicesPresent = lprSyncMap[normPlate] || [];

                                                                if (devicesPresent.length === 0) {
                                                                    return (
                                                                        <div key={v.id} className="flex flex-col gap-0.5 mb-1 last:mb-0">
                                                                            <span className="text-[7px] font-black text-neutral-700 uppercase tracking-tight">{v.plate}</span>
                                                                            <Badge className="bg-red-500/5 text-red-500/40 border-none text-[6px] px-1 py-0 h-3 leading-none uppercase">Desconectado</Badge>
                                                                        </div>
                                                                    );
                                                                }

                                                                return (
                                                                    <div key={v.id} className="flex flex-col gap-0.5 mb-1 last:mb-0">
                                                                        <span className="text-[7px] font-black text-white/40 uppercase tracking-tight">{v.plate}</span>
                                                                        <div className="flex flex-wrap gap-0.5">
                                                                            {devicesPresent.map((dev: string) => (
                                                                                <Badge key={dev} className="bg-emerald-500/10 text-emerald-400 border-none text-[6px] px-1 py-0 h-3 leading-none uppercase">
                                                                                    {dev}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <span className="text-[9px] text-neutral-800 font-black uppercase tracking-widest italic">N/A</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4">
                                                    <div className="flex items-center gap-2">
                                                        {isImported ? (
                                                            <>
                                                                <div className="p-1.5 bg-purple-500/10 rounded-md">
                                                                    <Server size={10} className="text-purple-500" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-black text-white uppercase tracking-tight">Importado</span>
                                                                    <span className="text-[8px] font-bold text-neutral-500 uppercase truncate max-w-[100px]" title={tagCred?.notes}>
                                                                        {importSource || "Dispositivo"}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-2 opacity-50">
                                                                <UserCheck size={12} className="text-neutral-600" />
                                                                <span className="text-[9px] font-bold text-neutral-600 uppercase">Manual</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right px-8">
                                                    <div className="flex items-center justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedUser(user);
                                                                setIsFormOpen(true);
                                                            }}
                                                            className="h-10 w-10 p-0 bg-white/5 backdrop-blur-md hover:bg-blue-600 hover:text-white rounded-md transition-all"
                                                        >
                                                            <Edit size={16} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setUserToDelete(user)}
                                                            className="h-10 w-10 p-0 bg-white/5 backdrop-blur-md hover:bg-red-600 hover:text-white rounded-md transition-all"
                                                        >
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {/* Sentinel for Infinite Scroll */}
                                    {!isLoading && !searchQuery && !filterRole && visibleUsers.length < users.length && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="p-0 border-0">
                                                <div ref={observerTarget} className="h-24 w-full flex items-center justify-center">
                                                    <div className="flex items-center gap-2 opacity-30">
                                                        <Loader2 className="animate-spin text-white" size={20} />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Cargando más...</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {/* Spacer for Fade Effect */}
                                    <TableRow><TableCell colSpan={6} className="h-32 border-0 p-0" /></TableRow>
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {/* Visual Fade Overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#080808] via-[#080808]/80 to-transparent pointer-events-none z-10" />
            </div>

            {/* Dialogs */}
            <UserFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                user={selectedUser || undefined}
                units={units}
                groups={groups}
                devices={devices}
                parkingSlots={parkingSlots}
                onSuccess={() => {
                    loadData();
                    setIsFormOpen(false);
                    setSelectedUser(null);
                }}
            />


            <DeleteConfirmDialog
                id={userToDelete?.id || ""}
                open={!!userToDelete}
                onOpenChange={(open) => !open && setUserToDelete(null)}
                title="Eliminar Usuario"
                description={`¿Estás seguro de eliminar a ${userToDelete?.name}? Esta acción revocará todos sus permisos de acceso.`}
                onDelete={deleteUser}
                onSuccess={() => {
                    loadData();
                    setUserToDelete(null);
                }}
            />

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .scrollbar-none::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-none {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
