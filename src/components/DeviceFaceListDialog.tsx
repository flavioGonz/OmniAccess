
import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Loader2,
    RefreshCw,
    AlertTriangle,
    Download,
    Search,
    Database,
    ArrowRightLeft,
    Share2,
    ScanFace,
    User,
    Power
} from "lucide-react";
import { toast } from "sonner";
import { getDeviceFaces, exportAllToDevice } from "@/app/actions/deviceMemory";
import { getUsers } from "@/app/actions/users";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FaceImportPreviewDialog } from "./FaceImportPreviewDialog"; // Created in previous step

interface DeviceFaceListDialogProps {
    device: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DeviceFaceListDialog({ device, open, onOpenChange }: DeviceFaceListDialogProps) {
    const [loading, setLoading] = useState(false);
    const [faces, setFaces] = useState<any[]>([]); // Camera List
    const [systemUsers, setSystemUsers] = useState<any[]>([]); // App List
    const [searchTerm, setSearchTerm] = useState("");

    const [showImportPreview, setShowImportPreview] = useState(false);
    const [isSyncingToCamera, setIsSyncingToCamera] = useState(false);

    useEffect(() => {
        if (open) {
            loadData();
        }
    }, [open, device]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [deviceFaces, appUsers] = await Promise.all([
                getDeviceFaces(device.id),
                getUsers()
            ]);
            setFaces(deviceFaces);
            setSystemUsers(appUsers);
        } catch (error) {
            toast.error("Error al cargar datos.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncClick = () => {
        if (confirm("⚠️ IMPORTANTE:\n\nAl sincronizar, se VOLCARÁ la base de datos de la App al equipo. Los usuarios existentes en el equipo serán actualizados. ¿Deseas continuar?")) {
            handleSyncToCamera();
        }
    };

    const handleSyncToCamera = async () => {
        setIsSyncingToCamera(true);
        try {
            const result = await exportAllToDevice(device.id);
            toast.success(`Sincronización enviada: ${result.processed} usuarios procesados.`);
            // Reload faces to see changes (might take a moment for device to reflect)
            setTimeout(loadData, 2000);
        } catch (error) {
            console.error(error);
            toast.error("Error al sincronizar con la cámara.");
        } finally {
            setIsSyncingToCamera(false);
        }
    };

    // Filter Logic
    const filteredFaces = faces.filter(f =>
        (f.Name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.UserID || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredSystemUsers = systemUsers.filter(u =>
        (u.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.dni || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const usersWithFaceCount = systemUsers.filter(u =>
        (u.cara && u.cara.length > 0) || u.credentials?.some((c: any) => c.type === 'FACE')
    ).length;

    const usersWithoutFaceCount = systemUsers.length - usersWithFaceCount;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[90vh] bg-[#09090b] border border-white/10 p-0 flex flex-col gap-0 overflow-hidden shadow-2xl rounded-xl">
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 bg-[#0c0c0c] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-inner">
                                <ScanFace className="text-indigo-400" size={24} />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black text-white uppercase tracking-tight">Gestión de Rostros</DialogTitle>
                                <DialogDescription className="text-neutral-500 font-medium text-xs uppercase tracking-widest mt-1">
                                    {device?.name} - {device?.ip}
                                </DialogDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadData}
                                disabled={loading || isSyncingToCamera}
                                className="border-white/10 hover:bg-white/5 text-neutral-400 hover:text-white"
                            >
                                <RefreshCw size={14} className={cn("mr-2", loading ? "animate-spin" : "")} />
                                Recargar
                            </Button>

                            <div className="h-6 w-px bg-white/10 mx-1 hidden md:block" />

                            <Button
                                variant="outline" // Changed to outline/secondary to emphasize Flow Direction
                                size="sm"
                                onClick={() => setShowImportPreview(true)}
                                disabled={loading || isSyncingToCamera || faces.length === 0}
                                className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border-emerald-600/20 font-bold uppercase text-[10px] tracking-wider"
                            >
                                <Download size={14} className="mr-2" />
                                Importar a App
                            </Button>

                            <Button
                                size="sm"
                                onClick={handleSyncClick}
                                disabled={loading || isSyncingToCamera}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 font-bold uppercase text-[10px] tracking-wider"
                            >
                                {isSyncingToCamera ? <Loader2 className="animate-spin mr-2" size={14} /> : <Share2 size={14} className="mr-2" />}
                                Sincronizar (App &rarr; Cam)
                            </Button>
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="p-4 bg-black/40 border-b border-white/5 flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
                            <input
                                type="text"
                                placeholder="Buscar por Nombre o ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-9bg-transparent bg-neutral-900 border border-white/10 rounded-lg pl-9 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                            />
                        </div>
                        <div className="ml-auto flex items-center gap-6 text-[10px] font-mono uppercase tracking-wider">
                            <span className="flex items-center gap-2 text-neutral-500"><div className="w-2 h-2 rounded-full bg-emerald-500" />En Cámara: {faces.length}</span>
                            <div className="h-4 w-px bg-white/10" />
                            <div className="flex flex-col gap-1 items-end">
                                <span className="flex items-center gap-2 text-indigo-400"><div className="w-2 h-2 rounded-full bg-indigo-500" />Usuarios en App: {systemUsers.length}</span>
                                <div className="flex gap-3">
                                    <span className="text-emerald-500/70">Con Rostro: {usersWithFaceCount}</span>
                                    <span className="text-red-500/70">Sin Rostro: {usersWithoutFaceCount}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Grid */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-[#09090b]">

                        {/* LEFT: Camera Face List */}
                        <div className="flex flex-col border-r border-white/5 overflow-hidden">
                            <div className="p-3 bg-neutral-900/50 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                                    <Database size={14} /> Memoria del Dispositivo
                                </h3>
                            </div>
                            <div className="flex-1 overflow-auto bg-[#0a0a0a]">
                                <Table>
                                    <TableHeader className="bg-neutral-900/80 sticky top-0 z-10 backdrop-blur-md">
                                        <TableRow className="border-white/5 hover:bg-transparent">
                                            <TableHead className="text-[10px] uppercase font-bold text-neutral-500 pl-6">ID / UserID</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold text-neutral-500">Nombre</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold text-neutral-500 text-right pr-6">Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-32 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Loader2 className="animate-spin text-neutral-500" />
                                                        <span className="text-xs text-neutral-500 font-mono">Cargando rostros...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredFaces.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-32 text-center text-neutral-600 text-xs">
                                                    No se encontraron registros en la cámara.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredFaces.map((face, idx) => (
                                                <TableRow key={idx} className="border-white/5 hover:bg-emerald-900/5 group text-xs text-neutral-300">
                                                    <TableCell className="font-mono pl-6 opacity-70 group-hover:text-emerald-400 group-hover:opacity-100 transition-colors">
                                                        {face.UserID || face.ID}
                                                    </TableCell>
                                                    <TableCell className="font-bold uppercase group-hover:text-white transition-colors">
                                                        {face.Name || "SIN NOMBRE"}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase border border-emerald-500/20">
                                                            En Cámara
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* RIGHT: System User List */}
                        <div className="flex flex-col overflow-hidden bg-[#0c0c0c]">
                            <div className="p-3 bg-neutral-900/50 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                                    <Database size={14} /> Base de Datos (App)
                                </h3>
                            </div>
                            <div className="flex-1 overflow-auto">
                                <Table>
                                    <TableHeader className="bg-neutral-900/80 sticky top-0 z-10 backdrop-blur-md">
                                        <TableRow className="border-white/5 hover:bg-transparent">
                                            <TableHead className="text-[10px] uppercase font-bold text-neutral-500 pl-6">DNI / Legajo</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold text-neutral-500">Nombre</TableHead>
                                            <TableHead className="text-[10px] uppercase font-bold text-neutral-500 text-right pr-6">Credenciales</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-32 text-center">
                                                    <Loader2 className="animate-spin text-neutral-500 mx-auto" />
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredSystemUsers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="h-32 text-center text-neutral-600 text-xs">
                                                    No hay usuarios en el sistema.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredSystemUsers.map((user) => (
                                                <TableRow key={user.id} className={cn(
                                                    "border-white/5 hover:bg-indigo-900/5 group text-xs text-neutral-300",
                                                    !((user.cara && user.cara.length > 0) || user.credentials?.some((c: any) => c.type === 'FACE')) && "bg-red-500/5"
                                                )}>
                                                    <TableCell className="font-mono pl-6 opacity-70 group-hover:text-indigo-400 group-hover:opacity-100 transition-colors">
                                                        {user.dni}
                                                    </TableCell>
                                                    <TableCell className="font-bold uppercase group-hover:text-white transition-colors">
                                                        <div className="flex flex-col">
                                                            <span>{user.name}</span>
                                                            {!((user.cara && user.cara.length > 0) || user.credentials?.some((c: any) => c.type === 'FACE')) && (
                                                                <span className="text-[9px] text-red-500/60 font-black tracking-tighter">FALTA ROSTRO</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex justify-end gap-1">
                                                            {((user.cara && user.cara.length > 0) || user.credentials?.some((c: any) => c.type === 'FACE')) ? (
                                                                <span className="w-5 h-5 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400" title="Tiene Rostro">
                                                                    <ScanFace size={10} />
                                                                </span>
                                                            ) : (
                                                                <span className="w-5 h-5 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500" title="Sin Rostro">
                                                                    <AlertTriangle size={10} />
                                                                </span>
                                                            )}
                                                            {user.credentials?.some((c: any) => c.type === 'TAG') && (
                                                                <span className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400" title="Tiene Tag">
                                                                    <User size={10} />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                    </div>

                    {/* Warning Footer */}
                    {device?.brand === 'HIKVISION' && !loading && !isSyncingToCamera && (
                        <div className="p-3 bg-orange-500/5 border-t border-orange-500/10 flex items-center justify-center gap-2 text-orange-400/80">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <p className="text-[10px] uppercase font-bold tracking-wide">
                                Advertencia: La sincronización (App &rarr; Cam) sobrescribirá la lista interna del dispositivo.
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <FaceImportPreviewDialog
                open={showImportPreview}
                onOpenChange={setShowImportPreview}
                deviceId={device.id}
                faces={faces}
                existingUsers={systemUsers}
                onSuccess={() => {
                    setShowImportPreview(false);
                    loadData();
                }}
            />
        </>
    );
}
