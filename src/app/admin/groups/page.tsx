"use client";

import { useEffect, useState } from "react";
import { createAccessGroup, deleteAccessGroup, getAccessGroups } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Users } from "lucide-react";

type AccessGroupWithCounts = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    _count: {
        users: number;
        devices?: number;
    }
}

export default function GroupsPage() {
    const [groups, setGroups] = useState<AccessGroupWithCounts[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        load();
    }, []);

    async function load() {
        const data = await getAccessGroups();
        setGroups(data);
    }

    async function handleSubmit(formData: FormData) {
        await createAccessGroup(formData);
        setOpen(false);
        load();
    }

    async function handleDelete(id: string) {
        if (confirm("¿Eliminar grupo?")) {
            await deleteAccessGroup(id);
            load();
        }
    }

    return (
        <div className="p-6 space-y-6">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-card/50 p-8 border border-border rounded-[2rem] shadow-2xl backdrop-blur-xl mb-8">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20 shadow-inner group transition-all hover:scale-110">
                        <Users size={32} className="text-purple-400 group-hover:rotate-[15deg] transition-transform duration-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-300 to-indigo-500 uppercase tracking-tight">
                            Grupos de Acceso
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium">Define niveles de permisos y jerarquías de acceso para el recinto.</p>
                    </div>
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-foreground shadow-xl shadow-purple-900/30 font-black h-14 px-10 rounded-2xl transition-all hover:scale-105 active:scale-95 uppercase tracking-tighter text-sm">
                            <Plus className="mr-3 h-6 w-6" /> Crear Grupo
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md p-8 bg-card/95 border-border rounded-[2.5rem] shadow-3xl backdrop-blur-3xl font-sans">
                        <DialogHeader className="mb-6">
                            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 border border-purple-500/20 mb-4 mx-auto">
                                <Users size={24} />
                            </div>
                            <DialogTitle className="text-2xl font-black text-center uppercase tracking-tight">Nivel de Autorización</DialogTitle>
                        </DialogHeader>
                        <form action={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] ml-1">Nombre del Grupo Político</Label>
                                <Input id="name" name="name" placeholder="Ej: Residentes VIP / Torre Norte" required className="h-12 bg-background border-border rounded-xl focus:ring-2 focus:ring-purple-500/20 font-bold" />
                            </div>
                            <Button type="submit" className="w-full h-14 bg-gradient-to-r from-emerald-600 to-teal-600 text-foreground font-black uppercase tracking-tighter rounded-2xl shadow-xl shadow-emerald-900/20 transition-all hover:scale-[1.02] active:scale-95">
                                Validar y Guardar Grupo
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </header>

            <div className="border border-border rounded-[2rem] overflow-hidden bg-card/50 backdrop-blur-sm shadow-2xl">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="border-border hover:bg-transparent">
                            <TableHead icon={<Users size={14} />} className="text-muted-foreground">Identidad del Grupo</TableHead>
                            <TableHead icon={<Users size={14} />} className="text-muted-foreground">Quorum de Usuarios</TableHead>
                            <TableHead className="text-muted-foreground">Nodos de Acceso</TableHead>
                            <TableHead className="text-right text-muted-foreground pr-8">Gestión</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groups.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-24 text-muted-foreground opacity-20">
                                    <Users size={60} className="mx-auto mb-6" />
                                    <p className="text-xs font-black uppercase tracking-widest">No hay grupos operativos definidos</p>
                                </TableCell>
                            </TableRow>
                        )}
                        {groups.map((g) => (
                            <TableRow key={g.id} className="border-border hover:bg-muted/40 group transition-colors">
                                <TableCell className="py-6 pl-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center text-muted-foreground group-hover:text-purple-400 group-hover:bg-purple-500/10 transition-colors border border-border">
                                            <Users size={18} />
                                        </div>
                                        <div>
                                            <p className="font-black text-foreground group-hover:text-foreground transition-colors uppercase tracking-tight">{g.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-bold font-mono uppercase tracking-tighter">Cluster G-{g.id.slice(-4)}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted/50 border border-border rounded-full">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{g._count.users} Sujetos</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted/50 border border-border rounded-full">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{g._count.devices || 0} Nodos</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(g.id)}
                                        className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
