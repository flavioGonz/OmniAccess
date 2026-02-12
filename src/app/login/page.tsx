'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Mail, Lock, User, ArrowRight, RefreshCw, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { login, resetPassword } from '@/app/actions/auth';
import Image from 'next/image';

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'reset'>('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        const formData = new FormData(e.currentTarget);
        try {
            const result = await login(formData);
            if (result?.error) {
                setError(result.error);
            }
        } catch (err) {
            console.error(err);
            setError('Ocurrió un error inesperado');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        const formData = new FormData(e.currentTarget);
        try {
            const result = await resetPassword(formData);
            if (result?.success) {
                setSuccess(result.success);
            }
        } catch (err) {
            setError('Error al procesar la solicitud');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#050507]">
            {/* BACKGROUND ANIMATION */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/branding/login-bg.png"
                    alt="Background"
                    fill
                    className="object-cover opacity-40 blur-[1px]"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#050507] via-transparent to-[#B20D30]/10" />

                {/* Animated Glows */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.2, 0.1],
                        x: [0, 100, 0],
                        y: [0, -50, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute top-1/4 -left-20 w-96 h-96 bg-[#B20D30] rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.05, 0.15, 0.05],
                        x: [0, -100, 0],
                        y: [0, 50, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[150px]"
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-md relative z-10"
            >
                {/* LOGO SECTION */}
                <div className="flex flex-col items-center mb-10">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="relative group"
                    >
                        <div className="absolute inset-0 bg-[#B20D30] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
                        <div className="w-24 h-24 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] flex items-center justify-center border border-white/10 shadow-2xl relative z-10 overflow-hidden">
                            <Image src="/logo-transparent.png" width={64} height={64} alt="Logo" className="drop-shadow-2xl" />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.5 }}
                        className="text-center mt-6"
                    >
                        <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-1 drop-shadow-sm">
                            OMNI<span className="text-[#B20D30]">ACCESS</span>
                        </h1>
                        <div className="flex items-center gap-2 justify-center">
                            <div className="h-px w-8 bg-gradient-to-r from-transparent to-neutral-700" />
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.3em]">Advanced Security System</p>
                            <div className="h-px w-8 bg-gradient-to-l from-transparent to-neutral-700" />
                        </div>
                    </motion.div>
                </div>

                {/* AUTH CARD */}
                <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        {mode === 'login' ? (
                            <motion.div
                                key="login"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="mb-8">
                                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Bienvenido</h2>
                                    <p className="text-sm text-neutral-400 font-medium">Inicie sesión para continuar al panel</p>
                                </div>

                                <form onSubmit={handleLogin} className="space-y-5">
                                    <div className="space-y-1.5 group">
                                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1 group-focus-within:text-[#B20D30] transition-colors">Usuario</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-[#B20D30] transition-colors" size={18} />
                                            <Input
                                                name="username"
                                                type="text"
                                                required
                                                className="bg-black/40 border-white/5 h-14 pl-12 text-white font-medium focus:ring-1 focus:ring-[#B20D30]/50 focus:border-[#B20D30]/50 transition-all rounded-2xl placeholder:text-neutral-700"
                                                placeholder="Nombre de usuario"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 group">
                                        <div className="flex justify-between items-center ml-1">
                                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest group-focus-within:text-[#B20D30] transition-colors">Contraseña</label>
                                            <button
                                                type="button"
                                                onClick={() => setMode('reset')}
                                                className="text-[10px] font-black text-[#B20D30] uppercase tracking-widest hover:text-white transition-colors"
                                            >
                                                ¿Olvidó su contraseña?
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-[#B20D30] transition-colors" size={18} />
                                            <Input
                                                name="password"
                                                type="password"
                                                required
                                                className="bg-black/40 border-white/5 h-14 pl-12 text-white font-medium focus:ring-1 focus:ring-[#B20D30]/50 focus:border-[#B20D30]/50 transition-all rounded-2xl placeholder:text-neutral-700"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3"
                                        >
                                            <AlertCircle className="text-red-500 shrink-0" size={18} />
                                            <p className="text-red-500 text-xs font-bold uppercase tracking-wide">{error}</p>
                                        </motion.div>
                                    )}

                                    <Button
                                        disabled={loading}
                                        className="w-full h-14 bg-gradient-to-r from-[#B20D30] to-[#8a0a25] hover:from-[#d9123c] hover:to-[#B20D30] text-white font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-[0_10px_20px_-5px_rgba(178,13,48,0.4)] group relative overflow-hidden disabled:opacity-50"
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            {loading ? <RefreshCw className="animate-spin" size={20} /> : (
                                                <>
                                                    Ingresar <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </span>
                                    </Button>
                                </form>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="reset"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <button
                                    onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                                    className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors mb-6 text-xs font-bold uppercase tracking-widest group"
                                >
                                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver al login
                                </button>

                                <div className="mb-8">
                                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Recuperar Acceso</h2>
                                    <p className="text-sm text-neutral-400 font-medium">Enviaremos instrucciones de recuperación</p>
                                </div>

                                <form onSubmit={handleReset} className="space-y-6">
                                    <div className="space-y-1.5 group">
                                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1 group-focus-within:text-white transition-colors">Correo Electrónico</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-white transition-colors" size={18} />
                                            <Input
                                                name="email"
                                                type="email"
                                                required
                                                className="bg-black/40 border-white/5 h-14 pl-12 text-white font-medium focus:ring-1 focus:ring-white/30 transition-all rounded-2xl placeholder:text-neutral-700"
                                                placeholder="ejemplo@correo.com"
                                            />
                                        </div>
                                    </div>

                                    {success && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3"
                                        >
                                            <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
                                            <p className="text-emerald-500 text-xs font-bold uppercase tracking-wide">{success}</p>
                                        </motion.div>
                                    )}

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3"
                                        >
                                            <AlertCircle className="text-red-500 shrink-0" size={18} />
                                            <p className="text-red-500 text-xs font-bold uppercase tracking-wide">{error}</p>
                                        </motion.div>
                                    )}

                                    <Button
                                        disabled={loading || !!success}
                                        className="w-full h-14 bg-white text-black hover:bg-neutral-200 font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-white/5 group disabled:opacity-50"
                                    >
                                        <span className="relative z-10 flex items-center justify-center gap-2 text-black">
                                            {loading ? <RefreshCw className="animate-spin" size={20} /> : "Enviar Instrucciones"}
                                        </span>
                                    </Button>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* FOOTER */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="mt-10 text-center space-y-4"
                >
                    <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-[0.4em]">
                        Panel de Administración v12.4
                    </p>
                    <div className="flex items-center justify-center gap-6 opacity-40">
                        <Shield size={16} className="text-neutral-400" />
                        <div className="h-4 w-px bg-neutral-800" />
                        <span className="text-[10px] text-neutral-400 font-mono tracking-tighter">SECURED BY OMNIACCESS CORP</span>
                    </div>
                </motion.div>
            </motion.div>

            {/* Corner Deco */}
            <div className="fixed top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-64 h-64 bg-[#B20D30]/10 rounded-full blur-[100px] -ml-32 -mb-32 pointer-events-none" />
        </div>
    );
}
