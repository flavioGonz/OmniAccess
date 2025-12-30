"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
    HelpCircle, LayoutDashboard, Calendar, History, Home, Users, Car, Cpu, Key,
    ShieldCheck, CreditCard, LayoutGrid, Settings, Activity, ChevronRight,
    Search, Info, ArrowRight, Layers, ExternalLink, Edit2, Save, X, Plus,
    Trash2, Upload, Play, ChevronDown, ChevronUp, Image as ImageIcon, Video
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getHelpDocs, updateHelpDocs, uploadHelpMedia, type HelpDoc, type FaqItem } from "@/app/actions/help";

const ICON_MAP: Record<string, any> = {
    LayoutDashboard, Calendar, History, Home, Users, Car, Cpu, Key,
    ShieldCheck, CreditCard, LayoutGrid, Settings, Activity
};

export default function HelpPage() {
    const [docs, setDocs] = useState<HelpDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [editingDoc, setEditingDoc] = useState<HelpDoc | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadDocs();
    }, []);

    const loadDocs = async () => {
        setLoading(true);
        const data = await getHelpDocs();
        setDocs(data);
        if (data.length > 0 && !selectedDocId) {
            setSelectedDocId(data[0].id);
        }
        setLoading(false);
    };

    const selectedDoc = docs.find(d => d.id === selectedDocId) || docs[0];

    const filteredDocs = docs.filter(doc => {
        const query = searchQuery.toLowerCase();
        return (
            doc.title.toLowerCase().includes(query) ||
            doc.description.toLowerCase().includes(query) ||
            doc.features.some(f => f.toLowerCase().includes(query))
        );
    });

    const handleSave = async () => {
        if (!editingDoc) return;
        const newDocs = docs.map(d => d.id === editingDoc.id ? editingDoc : d);
        setDocs(newDocs);
        const res = await updateHelpDocs(newDocs);
        if (res.success) {
            toast.success("Documentación actualizada");
            setIsEditing(false);
        } else {
            toast.error("Error al guardar");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        const file = e.target.files?.[0];
        if (!file || !editingDoc) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await uploadHelpMedia(formData);
            if (res.success && res.url) {
                if (type === 'image') {
                    setEditingDoc({ ...editingDoc, image: res.url });
                } else {
                    setEditingDoc({ ...editingDoc, videoUrl: res.url });
                }
                toast.success("Archivo subido correctamente");
            } else {
                toast.error("Error en la subida");
            }
        } catch (err) {
            toast.error("Error crítico de subida");
        } finally {
            setUploading(false);
        }
    };

    if (loading) return (
        <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
            <Activity className="animate-spin text-blue-500" size={40} />
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] animate-in fade-in duration-700 overflow-hidden">
            {/* Header */}
            <header className="shrink-0 border-b border-white/5 bg-neutral-900/50 backdrop-blur-md px-8 py-8">
                <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 text-blue-500 mb-1">
                            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <HelpCircle size={20} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Centro de Soporte Técnico</span>
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-tight uppercase">
                            Documentación <span className="text-neutral-600">OmniAccess</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative w-64 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-blue-500 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar en la guía..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-11 pl-12 pr-4 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all"
                            />
                        </div>
                        <Button
                            onClick={() => {
                                setIsEditing(!isEditing);
                                setEditingDoc(selectedDoc);
                            }}
                            className={cn(
                                "h-11 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                isEditing ? "bg-red-500 hover:bg-red-600 text-white" : "bg-white/5 hover:bg-white text-white hover:text-black border border-white/10"
                            )}
                        >
                            {isEditing ? <X className="mr-2" size={14} /> : <Edit2 className="mr-2" size={14} />}
                            {isEditing ? "Cancelar" : "Modo Editor"}
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-hidden">
                <div className="max-w-[1400px] mx-auto h-full grid grid-cols-1 lg:grid-cols-12">
                    {/* Navigation Sidebar */}
                    <aside className="lg:col-span-3 border-r border-white/5 bg-neutral-900/20 overflow-y-auto custom-scrollbar p-6 space-y-8">
                        <div>
                            <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest px-3 mb-4">Módulos</p>
                            <div className="space-y-1">
                                {filteredDocs.map((doc) => {
                                    const Icon = ICON_MAP[doc.icon] || HelpCircle;
                                    const isActive = selectedDocId === doc.id;
                                    return (
                                        <button
                                            key={doc.id}
                                            onClick={() => {
                                                setSelectedDocId(doc.id);
                                                if (isEditing) setEditingDoc(doc);
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative overflow-hidden",
                                                isActive
                                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]"
                                                    : "text-neutral-500 hover:bg-white/5 hover:text-white"
                                            )}
                                        >
                                            <Icon size={18} className={cn("transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                                            <span className="text-xs font-bold uppercase tracking-tight truncate flex-1 text-left">
                                                {doc.title}
                                            </span>
                                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-6 border-t border-white/5 space-y-4">
                            <Link
                                href="/admin/help/structure"
                                className="w-full flex items-center justify-between p-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/20 rounded-xl group transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-600/20 rounded-lg text-blue-400">
                                        <Layers size={16} />
                                    </div>
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Core Architecture</span>
                                </div>
                                <ChevronRight size={14} className="text-blue-500" />
                            </Link>
                        </div>
                    </aside>

                    {/* Content Area */}
                    <main className="lg:col-span-9 overflow-y-auto custom-scrollbar p-10 bg-black/40">
                        {isEditing ? (
                            <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
                                <DocEditor
                                    doc={editingDoc!}
                                    setDoc={setEditingDoc}
                                    onSave={handleSave}
                                    onUpload={handleFileUpload}
                                    uploading={uploading}
                                />
                            </div>
                        ) : (
                            <div className="max-w-4xl space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <DocViewer doc={selectedDoc} />
                                <FaqSection faqs={selectedDoc?.faqs || []} />
                            </div>
                        )}
                    </main>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
            `}</style>
        </div>
    );
}

function DocViewer({ doc }: { doc: HelpDoc }) {
    const Icon = ICON_MAP[doc?.icon] || HelpCircle;

    return (
        <div className="space-y-12">
            <div className="flex flex-col md:flex-row gap-10 items-start">
                <div className="md:w-1/2 space-y-6">
                    <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center border shadow-2xl transition-all",
                        doc.bg, doc.color, "border-white/10"
                    )}>
                        <Icon size={32} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-none">
                            {doc.title}
                        </h2>
                        <div className="flex items-center gap-2">
                            <div className="h-0.5 w-12 bg-blue-600" />
                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Technical Spec</span>
                        </div>
                    </div>
                    <p className="text-xl text-neutral-400 font-medium leading-relaxed">
                        {doc.description}
                    </p>
                </div>

                <div className="md:w-1/2 space-y-4">
                    <div className="aspect-video bg-neutral-900 rounded-2xl border border-white/10 overflow-hidden relative shadow-2xl group">
                        {doc.videoUrl ? (
                            <video
                                src={doc.videoUrl}
                                controls
                                className="w-full h-full object-cover"
                                poster={doc.image}
                            />
                        ) : (
                            <Image
                                src={doc.image}
                                alt={doc.title}
                                fill
                                className="object-cover opacity-60 group-hover:scale-110 transition-transform duration-1000 grayscale group-hover:grayscale-0"
                            />
                        )}
                        {!doc.videoUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />}
                        {doc.videoUrl && <div className="absolute top-4 right-4 p-2 bg-blue-600 rounded-lg shadow-xl"><Video size={16} className="text-white" /></div>}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-white mb-2">
                        <Info size={18} className="text-blue-500" />
                        <h3 className="text-xs font-black uppercase tracking-widest">Resumen General</h3>
                    </div>
                    <p className="text-neutral-500 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                        {doc.details}
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-white mb-2">
                        <Activity size={18} className="text-emerald-500" />
                        <h3 className="text-xs font-black uppercase tracking-widest">Funciones Clave</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {doc.features.map((feature, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 px-4 py-3 rounded-xl group hover:bg-white/5 transition-all">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-tight group-hover:text-white transition-colors">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function FaqSection({ faqs }: { faqs: FaqItem[] }) {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <div className="space-y-8 pt-8 border-t border-white/5">
            <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-white/5" />
                <h3 className="text-sm font-black text-blue-500 uppercase tracking-[0.2em] whitespace-nowrap">Preguntas Frecuentes (FAQ)</h3>
                <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="space-y-3">
                {faqs.map((faq, i) => (
                    <div
                        key={i}
                        className={cn(
                            "border border-white/5 rounded-2xl overflow-hidden transition-all duration-300",
                            openIndex === i ? "bg-white/[0.03] border-blue-500/20 shadow-2xl" : "bg-transparent hover:bg-white/[0.01]"
                        )}
                    >
                        <button
                            onClick={() => setOpenIndex(openIndex === i ? null : i)}
                            className="w-full flex items-center justify-between p-6 text-left"
                        >
                            <span className="text-sm font-bold text-white tracking-tight uppercase">{faq.question}</span>
                            <div className={cn(
                                "p-2 rounded-lg transition-all",
                                openIndex === i ? "bg-blue-600 text-white" : "bg-white/5 text-neutral-500"
                            )}>
                                {openIndex === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                        </button>
                        {openIndex === i && (
                            <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
                                <p className="text-sm text-neutral-400 leading-relaxed font-medium">
                                    {faq.answer}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function DocEditor({ doc, setDoc, onSave, onUpload, uploading }: {
    doc: HelpDoc,
    setDoc: (d: HelpDoc) => void,
    onSave: () => void,
    onUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => void,
    uploading: boolean
}) {
    return (
        <div className="space-y-8">
            <div className="bg-neutral-900/50 p-8 rounded-3xl border border-white/5 shadow-3xl space-y-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Editor de Contenido</h3>
                    <Button onClick={onSave} className="bg-blue-600 hover:bg-blue-500 text-white font-black px-8">
                        <Save size={16} className="mr-2" /> GUARDAR TODO
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Título Módulo</label>
                        <Input
                            value={doc.title}
                            onChange={e => setDoc({ ...doc, title: e.target.value })}
                            className="bg-black border-white/10 h-12 font-bold uppercase"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Descripción Corta</label>
                        <Input
                            value={doc.description}
                            onChange={e => setDoc({ ...doc, description: e.target.value })}
                            className="bg-black border-white/10 h-12"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Detalle Extendido</label>
                    <Textarea
                        value={doc.details}
                        onChange={e => setDoc({ ...doc, details: e.target.value })}
                        className="bg-black border-white/10 min-h-[150px] leading-relaxed"
                    />
                </div>

                <div className="grid grid-cols-2 gap-10 pt-4">
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Multimedia (Imágenes)</h4>
                        <div className="aspect-video bg-black rounded-2xl border border-dashed border-white/10 relative overflow-hidden group">
                            {doc.image && <img src={doc.image} className="w-full h-full object-cover opacity-50" />}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <label className="cursor-pointer bg-white/5 hover:bg-white text-white hover:text-black p-4 rounded-xl transition-all border border-white/10 flex flex-col items-center gap-2">
                                    {uploading ? <Activity className="animate-spin" /> : <Upload size={20} />}
                                    <span className="text-[10px] font-black uppercase">Subir Imagen</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={e => onUpload(e, 'image')} disabled={uploading} />
                                </label>
                            </div>
                        </div>
                        <Input
                            placeholder="O pega URL de imagen..."
                            value={doc.image}
                            onChange={e => setDoc({ ...doc, image: e.target.value })}
                            className="bg-black border-white/10 text-[10px]"
                        />
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Video (MP4)</h4>
                        <div className="aspect-video bg-black rounded-2xl border border-dashed border-white/10 relative overflow-hidden group">
                            {doc.videoUrl && <div className="w-full h-full flex items-center justify-center text-blue-500"><Play size={40} /></div>}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <label className="cursor-pointer bg-white/5 hover:bg-white text-white hover:text-black p-4 rounded-xl transition-all border border-white/10 flex flex-col items-center gap-2">
                                    {uploading ? <Activity className="animate-spin" /> : <Upload size={20} />}
                                    <span className="text-[10px] font-black uppercase">Subir Video</span>
                                    <input type="file" className="hidden" accept="video/*" onChange={e => onUpload(e, 'video')} disabled={uploading} />
                                </label>
                            </div>
                        </div>
                        <Input
                            placeholder="O pega URL de video (YouTube/MP4)..."
                            value={doc.videoUrl || ""}
                            onChange={e => setDoc({ ...doc, videoUrl: e.target.value })}
                            className="bg-black border-white/10 text-[10px]"
                        />
                    </div>
                </div>

                {/* FAQ Editor */}
                <div className="pt-8 border-t border-white/5 space-y-6">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Gestor de Preguntas Frecuentes</h4>
                    {doc.faqs.map((faq, i) => (
                        <div key={i} className="bg-black/40 p-6 rounded-2xl border border-white/5 space-y-4 relative group">
                            <button
                                onClick={() => {
                                    const newFaqs = doc.faqs.filter((_, idx) => idx !== i);
                                    setDoc({ ...doc, faqs: newFaqs });
                                }}
                                className="absolute top-4 right-4 text-neutral-700 hover:text-red-500 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                            <Input
                                placeholder="Pregunta..."
                                value={faq.question}
                                onChange={e => {
                                    const newFaqs = [...doc.faqs];
                                    newFaqs[i].question = e.target.value;
                                    setDoc({ ...doc, faqs: newFaqs });
                                }}
                                className="bg-neutral-900 border-white/5 font-bold"
                            />
                            <Textarea
                                placeholder="Respuesta..."
                                value={faq.answer}
                                onChange={e => {
                                    const newFaqs = [...doc.faqs];
                                    newFaqs[i].answer = e.target.value;
                                    setDoc({ ...doc, faqs: newFaqs });
                                }}
                                className="bg-neutral-900 border-white/5 text-neutral-400"
                            />
                        </div>
                    ))}
                    <Button
                        onClick={() => setDoc({ ...doc, faqs: [...doc.faqs, { question: "", answer: "" }] })}
                        className="w-full bg-white/5 hover:bg-white/10 text-white border border-dashed border-white/10 rounded-2xl h-14 font-black uppercase tracking-widest"
                    >
                        <Plus size={16} className="mr-2" /> AÑADIR PREGUNTA
                    </Button>
                </div>
            </div>
        </div>
    );
}
