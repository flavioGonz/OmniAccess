"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Camera, UserPlus, ShieldAlert, UserCheck, Loader2, ChevronLeft, RefreshCw, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { registerFace } from "@/app/actions/users";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function UploadFacePage() {
    const [name, setName] = useState("");
    const [dni, setDni] = useState("");
    const [isBlacklist, setIsBlacklist] = useState(false);
    const [observations, setObservations] = useState("");
    const [photo, setPhoto] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhoto(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !photo) {
            toast.error("Nombre y foto son obligatorios");
            return;
        }

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append("name", name);
        formData.append("dni", dni);
        formData.append("isBlacklisted", isBlacklist.toString());
        formData.append("observations", observations);
        formData.append("photo", photo);

        try {
            await registerFace(formData);
            toast.success("Rostro registrado correctamente");
            setName(""); setDni(""); setPhoto(null); setPreview(null); setObservations("");
        } catch (e) {
            toast.error("Error al registrar rostro");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="pb-6 border-b border-white/5">
                <h1 className="text-3xl font-black text-white uppercase tracking-tight italic">Cargar Rostro</h1>
                <p className="text-sm text-neutral-400 font-medium mt-1">Inscripción en el Ecosistema OmniAccess</p>
            </header>

            <form onSubmit={handleRegister} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: Capture */}
                <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Biometric Capture</h3>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                            <span className="text-[8px] font-black uppercase text-red-500 tracking-widest">Live Scanner</span>
                        </div>
                    </div>

                    <div
                        onClick={() => document.getElementById('face-upload')?.click()}
                        className="w-full aspect-square rounded-2xl bg-black border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-6 cursor-pointer hover:bg-neutral-900 transition-all relative overflow-hidden group"
                    >
                        {preview ? (
                            <>
                                <Image src={preview} alt="Preview" fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                    <div className="flex flex-col items-center gap-2">
                                        <RefreshCw className="text-white animate-spin-slow" size={32} />
                                        <span className="text-[9px] font-black uppercase text-white tracking-widest">Cambiar Imagen</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-neutral-700 group-hover:text-white group-hover:scale-110 transition-all">
                                    <Camera size={32} />
                                </div>
                                <div className="text-center">
                                    <p className="text-xs font-black text-white uppercase tracking-widest">Seleccionar Archivo</p>
                                    <p className="text-[9px] text-neutral-600 font-bold uppercase mt-1 italic">Formatos: JPG, PNG, WEBP (Max 5MB)</p>
                                </div>
                            </>
                        )}
                    </div>
                    <input id="face-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </div>

                {/* Right: Data */}
                <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 space-y-6 flex flex-col">
                    <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Subject Metadata</h3>

                    <div className="space-y-4 flex-1">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest ml-1">Identidad Completa</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nombre del Sujeto..."
                                className="h-12 bg-black/50 border-white/10 text-white rounded-xl px-4 text-sm font-bold uppercase focus:border-[#B20D30]/50 transition-colors"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest ml-1">Documento Nacional / ID</label>
                            <Input
                                value={dni}
                                onChange={(e) => setDni(e.target.value)}
                                placeholder="DNI / Cédula..."
                                className="h-12 bg-black/50 border-white/10 text-white rounded-xl px-4 text-sm font-bold uppercase focus:border-[#B20D30]/50 transition-colors"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest ml-1">Observaciones</label>
                            <textarea
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                                placeholder="Notas adicionales..."
                                className="w-full h-24 bg-black/50 border border-white/10 text-white rounded-xl p-4 text-xs font-medium uppercase focus:border-[#B20D30]/50 focus:ring-0 outline-none transition-colors resize-none"
                            />
                        </div>

                        <div className="flex items-center gap-4 bg-black/50 p-4 rounded-xl border border-white/5">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all",
                                isBlacklist ? "bg-red-600/20 text-red-500" : "bg-emerald-600/20 text-emerald-500"
                            )}>
                                {isBlacklist ? <ShieldAlert size={18} /> : <UserCheck size={18} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-black uppercase text-white tracking-widest">{isBlacklist ? "Lista Negra" : "Autorizado"}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBlacklist(!isBlacklist)}
                                className={cn(
                                    "w-12 h-6 rounded-full relative transition-colors",
                                    isBlacklist ? "bg-red-600" : "bg-emerald-600"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                    isBlacklist ? "right-1" : "left-1"
                                )} />
                            </button>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className={cn(
                            "w-full h-12 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex gap-2 shadow-lg",
                            isBlacklist ? "bg-red-600 hover:bg-red-700 shadow-red-900/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
                        )}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <><Upload size={16} /> Ejecutar Inscripción</>}
                    </Button>
                </div>
            </form>
        </div>
    );
}
