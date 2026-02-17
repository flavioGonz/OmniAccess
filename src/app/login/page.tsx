'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Mail, Lock, User, ArrowRight, RefreshCw, AlertCircle, CheckCircle2, ChevronLeft, Quote } from 'lucide-react';
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
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#0a0a0c]">
            {/* LEFT SIDE: LOGIN FORM */}
            <div className="flex flex-col relative bg-[#0a0a0c] border-r border-white/5 overflow-y-auto">
                {/* Brand Name Top Left */}
                <div className="p-8 lg:p-12">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">
                            OMNI<span className="text-[#B20D30]">ACCESS</span>
                        </h1>
                        <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-[0.3em] mt-1.5 ml-0.5">Security Systems</p>
                    </motion.div>
                </div>

                {/* Form Container */}
                <div className="flex-1 flex flex-col justify-center px-8 lg:px-24 xl:px-32 py-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-md w-full mx-auto lg:mx-0"
                    >
                        <AnimatePresence mode="wait">
                            {mode === 'login' ? (
                                <motion.div
                                    key="login"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="mb-10">
                                        <h2 className="text-4xl font-bold text-white mb-3">Bienvenido de nuevo</h2>
                                        <p className="text-neutral-400 text-lg">Inicie sesión para acceder a su panel de seguridad.</p>
                                    </div>

                                    <form onSubmit={handleLogin} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-neutral-300">Usuario</label>
                                            <div className="relative group">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-[#B20D30] transition-colors" size={20} />
                                                <Input
                                                    name="username"
                                                    type="text"
                                                    required
                                                    className="bg-white/5 border-white/10 h-14 pl-12 text-white text-base focus:ring-[#B20D30] focus:border-[#B20D30] rounded-xl placeholder:text-neutral-600 transition-all"
                                                    placeholder="Nombre de usuario"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-medium text-neutral-300">Contraseña</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setMode('reset')}
                                                    className="text-sm font-semibold text-[#B20D30] hover:text-[#d9123c] transition-colors"
                                                >
                                                    ¿Olvidó su contraseña?
                                                </button>
                                            </div>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-[#B20D30] transition-colors" size={20} />
                                                <Input
                                                    name="password"
                                                    type="password"
                                                    required
                                                    className="bg-white/5 border-white/10 h-14 pl-12 text-white text-base focus:ring-[#B20D30] focus:border-[#B20D30] rounded-xl placeholder:text-neutral-600 transition-all"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>

                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3"
                                            >
                                                <AlertCircle className="text-red-500 shrink-0" size={18} />
                                                <p className="text-red-400 text-sm font-medium">{error}</p>
                                            </motion.div>
                                        )}

                                        <Button
                                            disabled={loading}
                                            className="w-full h-14 bg-[#B20D30] hover:bg-[#d9123c] text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-[#B20D30]/20 active:scale-[0.98] disabled:opacity-50"
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                {loading ? <RefreshCw className="animate-spin" size={22} /> : (
                                                    <>
                                                        Acceder al sistema <ArrowRight size={20} />
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
                                        className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors mb-8 text-sm font-semibold group"
                                    >
                                        <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Volver al inicio
                                    </button>

                                    <div className="mb-10">
                                        <h2 className="text-4xl font-bold text-white mb-3">Recuperar Acceso</h2>
                                        <p className="text-neutral-400 text-lg">Ingrese su correo para recibir instrucciones.</p>
                                    </div>

                                    <form onSubmit={handleReset} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-neutral-300">Correo Electrónico</label>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-white transition-colors" size={20} />
                                                <Input
                                                    name="email"
                                                    type="email"
                                                    required
                                                    className="bg-white/5 border-white/10 h-14 pl-12 text-white text-base focus:ring-white/30 rounded-xl placeholder:text-neutral-600 transition-all border-none ring-1 ring-white/10"
                                                    placeholder="ejemplo@correo.com"
                                                />
                                            </div>
                                        </div>

                                        {success && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3"
                                            >
                                                <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
                                                <p className="text-emerald-400 text-sm font-medium">{success}</p>
                                            </motion.div>
                                        )}

                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3"
                                            >
                                                <AlertCircle className="text-red-500 shrink-0" size={18} />
                                                <p className="text-red-400 text-sm font-medium">{error}</p>
                                            </motion.div>
                                        )}

                                        <Button
                                            disabled={loading || !!success}
                                            className="w-full h-14 bg-white text-black hover:bg-neutral-200 font-bold text-lg rounded-xl transition-all shadow-xl shadow-white/5 disabled:opacity-50"
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                {loading ? <RefreshCw className="animate-spin" size={22} /> : "Enviar Instrucciones"}
                                            </span>
                                        </Button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>

                {/* Footer Left */}
                <div className="p-8 lg:p-12">
                    <div className="flex items-center justify-between text-neutral-500 text-xs font-medium">
                        <p>© 2026 OmniAccess Corp.</p>
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1.5"><Shield size={12} /> v12.4</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE: IMAGE & QUOTE */}
            <div className="hidden lg:block relative overflow-hidden">
                <Image
                    src="/login-bg-split.png"
                    alt="Security Command Center"
                    fill
                    className="object-cover"
                    priority
                />
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                {/* Quote Content */}
                <div className="absolute bottom-0 left-0 right-0 pb-32 xl:pb-48 px-16 xl:px-24 flex justify-between items-end">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.6 }}
                        className="max-w-xl"
                    >
                        <Quote className="text-[#B20D30] mb-6 w-12 h-12 opacity-80" />
                        <h3 className="text-3xl xl:text-4xl font-semibold text-white leading-tight mb-8">
                            "OmniAccess ha revolucionado la forma en que gestionamos la seguridad. No es solo un sistema, es la base de nuestra tranquilidad operativa."
                        </h3>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full border-2 border-[#B20D30] overflow-hidden bg-neutral-800">
                                <User className="w-full h-full p-2 text-neutral-400" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-lg underline decoration-[#B20D30] decoration-2 underline-offset-4">Ricardo Valenzuela</p>
                                <p className="text-neutral-400 font-medium">Director de Seguridad Patrimonial</p>
                            </div>
                        </div>

                        {/* Pagination indicator dots like in the UI kit */}
                        <div className="flex gap-2 mt-12">
                            <div className="w-8 h-2 bg-[#B20D30] rounded-full" />
                            <div className="w-2 h-2 bg-white/20 rounded-full" />
                            <div className="w-2 h-2 bg-white/20 rounded-full" />
                        </div>
                    </motion.div>

                    {/* CLIENT LOGO - BOTTOM RIGHT */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.5 }}
                        className="p-4"
                    >
                        <Image
                            src="/logo-sildan-white.png"
                            width={200}
                            height={80}
                            alt="Sildan Seguridad"
                            className="object-contain drop-shadow-md"
                        />
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
