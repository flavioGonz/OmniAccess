"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createVehicle, updateVehicle } from "@/app/actions/vehicles";
import { Loader2, Car, User as UserIcon, Palette, FileText, Check, Plus, Edit, ChevronDown, Bike, Truck, Bus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import Image from "next/image";
import { getCarLogo, VEHICLE_BRANDS } from "@/lib/car-logos";
import { Vehicle, User } from "@prisma/client";

const PRESET_COLORS = [
    { name: "Blanco", value: "#FFFFFF" },
    { name: "Negro", value: "#000000" },
    { name: "Gris", value: "#808080" },
    { name: "Plata", value: "#C0C0C0" },
    { name: "Rojo", value: "#FF0000" },
    { name: "Azul", value: "#0000FF" },
    { name: "Bordó", value: "#800000" },
    { name: "Beige", value: "#F5F5DC" },
];

interface VehicleDialogProps {
    users: User[];
    vehicle?: any;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export function VehicleDialog({ users, vehicle, trigger, onSuccess }: VehicleDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        plate: vehicle?.plate || "",
        brand: vehicle?.brand || "",
        model: vehicle?.model || "",
        color: vehicle?.color || "",
        notes: vehicle?.notes || "",
        userId: vehicle?.userId || "",
        type: vehicle?.type || "SEDAN",
    });
    const [openBrand, setOpenBrand] = useState(false);

    const isEdit = !!vehicle;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isEdit) {
                const res = await updateVehicle(vehicle.id, formData);
                if (res.success) toast.success("Vehículo actualizado");
            } else {
                const res = await createVehicle(formData);
                if (res.success) toast.success("Vehículo registrado");
            }
            setOpen(false);
            if (onSuccess) onSuccess();
        } catch (error) {
            toast.error("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <Plus size={18} /> Registrar Vehículo
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-0 bg-neutral-950 border-neutral-800 overflow-hidden rounded-2xl">
                <DialogHeader className="p-6 bg-neutral-900/50 border-b border-white/5 flex flex-row items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Car size={24} />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-black text-white uppercase tracking-tight">
                            {isEdit ? "Editar Vehículo" : "Nuevo Vehículo"}
                        </DialogTitle>
                        <DialogDescription className="text-neutral-500 text-xs">
                            Información del parque automotor y propietarios
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Plate & User */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Matrícula</Label>
                                <Input
                                    value={formData.plate}
                                    onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                                    className="bg-neutral-900 border-neutral-800 h-12 font-mono text-lg font-bold"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Titular</Label>
                                <Select value={formData.userId} onValueChange={(val) => setFormData({ ...formData, userId: val })}>
                                    <SelectTrigger className="bg-neutral-900 border-neutral-800 h-12">
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Brand & Model */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Marca</Label>
                                <Popover open={openBrand} onOpenChange={setOpenBrand}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between bg-neutral-900 border-neutral-800 h-12">
                                            {formData.brand || "Elegir..."}
                                            <ChevronDown size={14} className="opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[200px] p-0 bg-neutral-900 border-neutral-800">
                                        <Command>
                                            <CommandInput placeholder="Buscar..." />
                                            <CommandList>
                                                <CommandEmpty>No hay resultados</CommandEmpty>
                                                <CommandGroup>
                                                    {VEHICLE_BRANDS.map(b => (
                                                        <CommandItem
                                                            key={b.label}
                                                            onSelect={() => {
                                                                setFormData({ ...formData, brand: b.label });
                                                                setOpenBrand(false);
                                                            }}
                                                        >
                                                            {b.label}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Modelo</Label>
                                <Input
                                    value={formData.model}
                                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                    className="bg-neutral-900 border-neutral-800 h-12"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Type & Color */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Tipo</Label>
                                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                                    <SelectTrigger className="bg-neutral-900 border-neutral-800 h-12">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SEDAN">Sedán</SelectItem>
                                        <SelectItem value="SUV">SUV</SelectItem>
                                        <SelectItem value="PICKUP">Pickup</SelectItem>
                                        <SelectItem value="MOTORCYCLE">Moto</SelectItem>
                                        <SelectItem value="TRUCK">Camión</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Color</Label>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map(c => (
                                        <button
                                            key={c.name}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color: c.name })}
                                            className={cn(
                                                "w-8 h-8 rounded-full border border-white/10 transition-all",
                                                formData.color === c.name && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-neutral-950"
                                            )}
                                            style={{ backgroundColor: c.value }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Observaciones</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="bg-neutral-900 border-neutral-800 h-[104px] resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t border-white/5">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 min-w-[150px]">
                            {loading ? <Loader2 className="animate-spin" /> : "Guardar Cambios"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
