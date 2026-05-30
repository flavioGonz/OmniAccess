"use client";

import { useEffect, useState, useRef } from "react";
import { Palette, Upload, Save, Image as ImageIcon, Loader2, Eye, Smartphone } from "lucide-react";
import { getAppBranding, saveAppBranding, uploadBrandingFile, savePwaIcon } from "@/app/actions/settings";
import { toast } from "sonner";

export default function BrandingSection() {
    const [form, setForm] = useState({ name: "", subtitle: "", logoUrl: "", loginBgUrl: "", primary: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<"logo" | "bg" | null>(null);
    const logoRef = useRef<HTMLInputElement>(null);
    const bgRef = useRef<HTMLInputElement>(null);
    const pwaRef = useRef<HTMLInputElement>(null);
    const [uploadingPwa, setUploadingPwa] = useState(false);
    const [pwaTs, setPwaTs] = useState(Date.now());

    useEffect(() => { (async () => { try { setForm(await getAppBranding() as any); } catch (e) { console.error(e); } finally { setLoading(false); } })(); }, []);

    const upload = async (file: File, which: "logo" | "bg") => {
        setUploading(which);
        try {
            const fd = new FormData(); fd.append("file", file);
            const res = await uploadBrandingFile(fd);
            if (res.success && res.url) {
                setForm(f => ({ ...f, [which === "logo" ? "logoUrl" : "loginBgUrl"]: res.url }));
                toast.success("Imagen subida");
            } else toast.error(res.message || "Error al subir");
        } catch { toast.error("Error al subir"); } finally { setUploading(null); }
    };

    const uploadPwa = async (file: File) => {
        setUploadingPwa(true);
        try {
            const fd = new FormData(); fd.append("file", file);
            const res = await savePwaIcon(fd, "filas");
            if (res.success) { setPwaTs(Date.now()); toast.success("Icono PWA actualizado"); }
            else toast.error(res.message || "Error");
        } catch { toast.error("Error al subir"); } finally { setUploadingPwa(false); }
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await saveAppBranding({
                APP_BRAND_NAME: form.name, APP_BRAND_SUBTITLE: form.subtitle,
                APP_BRAND_LOGO_URL: form.logoUrl, APP_BRAND_LOGIN_BG_URL: form.loginBgUrl,
                APP_BRAND_PRIMARY: form.primary,
            });
            if (res.success) toast.success("Branding guardado · refrescá el login para verlo");
            else toast.error(res.message || "Error al guardar");
        } catch { toast.error("Error al guardar"); } finally { setSaving(false); }
    };

    if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="animate-spin mr-2" size={18} /> Cargando…</div>;

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/30">
                    <Palette size={20} className="text-white" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-foreground">Branding</h2>
                    <p className="text-xs text-muted-foreground">Identidad visual de la pantalla de login</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                    <label className="block text-sm font-medium text-foreground/80">
                        Nombre de la app
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="OmniAccess"
                            className="mt-1.5 w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-violet-500" />
                    </label>
                    <label className="block text-sm font-medium text-foreground/80">
                        Subtítulo / eslogan
                        <input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="Plataforma unificada de control de acceso"
                            className="mt-1.5 w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-violet-500" />
                    </label>
                    <label className="block text-sm font-medium text-foreground/80">
                        Color principal (opcional, hex)
                        <div className="mt-1.5 flex items-center gap-2">
                            <input value={form.primary} onChange={e => setForm({ ...form, primary: e.target.value })} placeholder="#7c3aed"
                                className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-violet-500 font-mono" />
                            {form.primary && <span className="w-9 h-9 rounded-lg border border-border shrink-0" style={{ background: form.primary }} />}
                        </div>
                    </label>

                    {/* Logo */}
                    <div>
                        <span className="block text-sm font-medium text-foreground/80 mb-1.5">Logo</span>
                        <div className="flex items-center gap-3">
                            <div className="w-16 h-16 rounded-xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                                {form.logoUrl ? <img src={form.logoUrl} alt="logo" className="w-full h-full object-contain" /> : <ImageIcon size={20} className="text-muted-foreground" />}
                            </div>
                            <input ref={logoRef} type="file" accept="image/png,image/webp,image/jpeg,image/svg+xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, "logo"); }} />
                            <button onClick={() => logoRef.current?.click()} disabled={uploading === "logo"}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted hover:bg-accent border border-border text-sm font-semibold text-foreground transition">
                                {uploading === "logo" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir logo
                            </button>
                        </div>
                    </div>

                    {/* Background */}
                    <div>
                        <span className="block text-sm font-medium text-foreground/80 mb-1.5">Foto de fondo del login</span>
                        <div className="flex items-center gap-3">
                            <div className="w-24 h-16 rounded-xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                                {form.loginBgUrl ? <img src={form.loginBgUrl} alt="bg" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-muted-foreground" />}
                            </div>
                            <input ref={bgRef} type="file" accept="image/png,image/webp,image/jpeg,image/svg+xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, "bg"); }} />
                            <button onClick={() => bgRef.current?.click()} disabled={uploading === "bg"}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted hover:bg-accent border border-border text-sm font-semibold text-foreground transition">
                                {uploading === "bg" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir fondo
                            </button>
                        </div>
                    </div>

                    <button onClick={save} disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-bold transition">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar branding
                    </button>
                </div>

                {/* Live preview */}
                <div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5"><Eye size={13} /> Vista previa del login</div>
                    <div className="relative rounded-xl border border-border overflow-hidden aspect-[4/3] bg-zinc-900">
                        {form.loginBgUrl && <img src={form.loginBgUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                        <div className="relative h-full flex flex-col items-center justify-center text-center p-6 gap-3">
                            {form.logoUrl
                                ? <img src={form.logoUrl} alt="logo" className="h-14 object-contain drop-shadow-lg" />
                                : <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg" style={{ background: form.primary || "#7c3aed" }}>{(form.name || "O").charAt(0)}</div>}
                            <div className="text-white font-black text-2xl drop-shadow">{form.name || "OmniAccess"}</div>
                            <div className="text-white/80 text-sm max-w-[80%]">{form.subtitle}</div>
                        </div>
                    </div>
                </div>
            </div>
            {/* PWA icon */}
            <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Smartphone size={15} className="text-violet-400" />
                    <span className="text-sm font-bold text-foreground">Icono de la PWA (Filas)</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl border border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                        <img src={`/iconos/filas-512.png?t=${pwaTs}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <input ref={pwaRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPwa(f); }} />
                        <button onClick={() => pwaRef.current?.click()} disabled={uploadingPwa}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-xs font-semibold transition">
                            {uploadingPwa ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Cambiar icono
                        </button>
                        <p className="text-[10px] text-muted-foreground mt-1.5">Se genera en 192 y 512 px (incl. maskable). Reinstalá/actualizá la PWA para ver el cambio.</p>
                    </div>
                </div>
            </div>

        </div>
    );
}
