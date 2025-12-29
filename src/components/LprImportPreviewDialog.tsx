"use client";

import { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    ArrowRight,
    Download,
    Loader2,
    Database,
    HardDrive,
    CheckCircle2,
    AlertCircle,
    Info,
    ArrowDownToLine,
    Car
} from "lucide-react";
import { importPlateBatch } from "@/app/actions/devices";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface LprImportPreviewDialogProps {
    device: any;
    cameraPlates: string[];
    localPlates: string[];
    localVehicles: string[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function LprImportPreviewDialog({
    device,
    cameraPlates,
    localPlates,
    localVehicles,
    open,
    onOpenChange,
    onSuccess
}: LprImportPreviewDialogProps) {
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    // Normalize for counting
    const normalize = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

    const uniqueCameraPlates = useMemo(() => Array.from(new Set(cameraPlates.map(p => normalize(p)))), [cameraPlates]);
    const normalizedLocalPlates = useMemo(() => localPlates.map(p => normalize(p)), [localPlates]);
    const normalizedLocalVehicles = useMemo(() => localVehicles.map(v => normalize(v)), [localVehicles]);

    // Calculate differences
    const newPlates = useMemo(() => uniqueCameraPlates.filter(cp => !normalizedLocalPlates.includes(cp)), [uniqueCameraPlates, normalizedLocalPlates]);
    const missingVehicles = useMemo(() => uniqueCameraPlates.filter(cp => !normalizedLocalVehicles.includes(cp)), [uniqueCameraPlates, normalizedLocalVehicles]);

    const platesToProcess = useMemo(() => Array.from(new Set([...newPlates, ...missingVehicles])), [newPlates, missingVehicles]);
    const totalToSync = platesToProcess.length;

    const handleConfirmImport = async () => {
        setIsImporting(true);
        setImportProgress(0);

        const BATCH_SIZE = 20;
        let processedCount = 0;
        let totalCreated = 0;

        try {
            // Split into batches
            for (let i = 0; i < platesToProcess.length; i += BATCH_SIZE) {
                const batch = platesToProcess.slice(i, i + BATCH_SIZE);
                const res = await importPlateBatch(device.id, batch);

                if (!res.success) throw new Error(res.message);

                totalCreated += res.count || 0;
                processedCount += batch.length;
                setImportProgress(Math.round((processedCount / totalToSync) * 100));
            }

            toast.success(`Importación finalizada: ${totalCreated} nuevos registros.`);
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl p-0 gap-0 border-neutral-800 bg-neutral-950 overflow-hidden shadow-2xl">
                <DialogHeader className="p-8 border-b border-neutral-900 bg-blue-500/5">
                    <div className="flex items-center gap-5">
                        <div className="p-3.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
                            <ArrowDownToLine className="w-6 h-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-neutral-100">Sincronización hacia App</DialogTitle>
                            <DialogDescription className="text-xs text-neutral-500 font-medium">
                                Descargando base de datos del hardware LPR
                            </DialogDescription>
                        </div>
                    </div>

                    {isImporting && (
                        <div className="mt-6 space-y-1.5">
                            <div className="flex justify-between text-[10px] items-center">
                                <span className="font-bold text-blue-400 uppercase tracking-wider">Procesando lotes...</span>
                                <span className="font-mono text-neutral-400">{importProgress}%</span>
                            </div>
                            <Progress value={importProgress} className="h-1 bg-neutral-900" indicatorClassName="bg-blue-500" />
                        </div>
                    )}
                </DialogHeader>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl border border-neutral-900 bg-neutral-900/40">
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Cámara</span>
                            <span className="text-2xl font-bold font-mono text-neutral-100">{uniqueCameraPlates.length}</span>
                        </div>
                        <div className="p-4 rounded-2xl border border-blue-500/10 bg-blue-500/5">
                            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Por Procesar</span>
                            <span className="text-2xl font-bold font-mono text-blue-400">{totalToSync}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-900 bg-neutral-900/20">
                            <div>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Nueva Credencial</p>
                                <p className="text-[8px] text-neutral-600 font-bold uppercase">Sin registro en App</p>
                            </div>
                            <span className="text-lg font-bold text-indigo-400">{newPlates.length}</span>
                        </div>
                        <div className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-900 bg-neutral-900/20">
                            <div>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Sin Ficha Vehicular</p>
                                <p className="text-[8px] text-neutral-600 font-bold uppercase">Solo existe el número</p>
                            </div>
                            <span className="text-lg font-bold text-orange-400">{missingVehicles.length}</span>
                        </div>
                    </div>

                    <Separator className="bg-neutral-900" />

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Ejemplo de registros</h4>
                        <ScrollArea className="h-32 rounded-xl border border-neutral-900 bg-neutral-900/20 p-4">
                            <div className="flex flex-wrap gap-1.5">
                                {platesToProcess.slice(0, 50).map(plate => (
                                    <Badge key={plate} variant="outline" className="text-[10px] font-mono py-0.5 px-2 border-neutral-800 bg-neutral-950 text-neutral-400">
                                        {plate}
                                    </Badge>
                                ))}
                                {platesToProcess.length > 50 && (
                                    <span className="text-[10px] py-1 text-neutral-600 font-bold uppercase">
                                        ... y {platesToProcess.length - 50} más
                                    </span>
                                )}
                                {platesToProcess.length === 0 && (
                                    <div className="w-full py-4 flex flex-col items-center gap-2 opacity-50">
                                        <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                                        <span className="text-[10px] uppercase font-bold tracking-widest">Todo al día</span>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <div className="p-6 border-t border-neutral-900 bg-neutral-900/10 flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isImporting}
                        className="flex-1 text-neutral-500 hover:text-white font-bold text-xs uppercase tracking-wider h-11"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmImport}
                        disabled={isImporting || totalToSync === 0}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider h-11 rounded-xl shadow-lg shadow-blue-900/20 shadow-glow"
                    >
                        {isImporting ? (
                            <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        ) : (
                            <Download className="w-4 h-4 mr-2" />
                        )}
                        Iniciar Sincronización
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
