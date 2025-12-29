"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, ShieldAlert, AlertTriangle } from "lucide-react";
import { deleteUser } from "@/app/actions/users";
import { cn } from "@/lib/utils";

interface DeleteConfirmDialogProps {
    id: string;
    title: string;
    description?: string;
    onDelete: (id: string) => Promise<void>;
    onSuccess: () => void;
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function DeleteConfirmDialog({ id, title, description, onDelete, onSuccess, children, open: controlledOpen, onOpenChange }: DeleteConfirmDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);

    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;

    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await onDelete(id);
            setOpen(false);
            onSuccess();
        } catch (error) {
            console.error("Error deleting record:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-[400px] bg-[#0c0c0c] border border-white/5 text-white p-0 gap-0 shadow-2xl backdrop-blur-xl sm:rounded-3xl overflow-hidden">
                <div className="flex flex-col items-center text-center p-8 pt-10 space-y-6">
                    {/* Icon with subtle red ambient glow */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-red-600 blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
                        <div className="relative bg-neutral-900/80 border border-white/5 p-5 rounded-3xl text-red-500 shadow-2xl ring-1 ring-white/5 group-hover:scale-105 transition-transform duration-300">
                            <Trash2 size={32} strokeWidth={2} />
                        </div>
                    </div>

                    <div className="space-y-2 max-w-[280px] mx-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-white uppercase tracking-tight text-center">
                                {title}
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm font-medium text-neutral-400 leading-relaxed">
                            Esta acción es <span className="text-red-500 font-bold">irreversible</span>.
                            El registro se eliminará permanentemente del sistema.
                        </p>
                    </div>

                    {/* Warning Box */}
                    <div className="w-full bg-red-500/5 border border-red-500/10 rounded-2xl p-4 flex items-start gap-3 text-left">
                        <AlertTriangle className="shrink-0 text-red-500 mt-0.5" size={16} />
                        <p className="text-[11px] font-medium text-red-200/60 leading-normal">
                            Si eliminas este usuario del dispositivo, dejará de tener acceso inmediatamente.
                        </p>
                    </div>
                </div>

                <div className="p-6 pt-0 flex flex-col gap-3">
                    <Button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="h-12 w-full rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-red-900/20 hover:shadow-red-500/20 transition-all active:scale-[0.98]"
                    >
                        {isDeleting ? "Eliminando..." : "Confirmar Eliminación"}
                    </Button>
                    <Button
                        onClick={() => setOpen(false)}
                        variant="ghost"
                        className="h-12 w-full rounded-xl text-neutral-500 hover:text-white hover:bg-white/5 font-bold text-xs uppercase tracking-widest transition-all"
                    >
                        Cancelar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
