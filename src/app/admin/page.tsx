import { redirect } from "next/navigation";

export default function AdminPage() {
    redirect("/admin/dashboard");

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-1000">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                <h1 className="relative text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-neutral-200 to-neutral-500 tracking-tighter italic">
                    WELCOME
                </h1>
            </div>
            <div className="flex items-center gap-3 px-6 py-2 bg-neutral-900 border border-white/5 rounded-full backdrop-blur-xl">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.4em]">Iniciando Núcleo LPR...</p>
            </div>
        </div>
    );
}

