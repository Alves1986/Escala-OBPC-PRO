
import React from 'react';
import { Database, FileText, AlertTriangle, Terminal, Sparkles, ArrowRight } from 'lucide-react';

interface Props {
  onEnterDemo: () => void;
}

export const SetupScreen: React.FC<Props> = ({ onEnterDemo }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4 font-sans relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-zinc-900/80"></div>

      <div className="w-full max-w-lg bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-8 shadow-2xl animate-fade-in relative z-10">
        
        {/* Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-teal-500/50 blur-[30px]"></div>

        <div className="text-center mb-8">
           <div className="inline-flex p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50 shadow-inner mb-4">
             <Database size={32} className="text-teal-500" />
           </div>
           <h1 className="text-2xl font-bold text-white tracking-tight">Configuração do Sistema</h1>
           <p className="text-zinc-400 text-sm mt-2">Conecte seu banco de dados ou visualize a demonstração.</p>
        </div>
        
        {/* Demo Button - High Emphasis */}
        <button 
            onClick={onEnterDemo}
            className="group w-full relative overflow-hidden bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-900/20 transition-all active:scale-[0.98] mb-8 border border-white/10"
        >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <div className="relative flex items-center justify-center gap-3">
                <Sparkles size={20} className="text-yellow-300 animate-pulse" />
                <span>Visualizar Modo Demonstração</span>
                <ArrowRight size={18} className="opacity-60 group-hover:translate-x-1 transition-transform" />
            </div>
        </button>

        <div className="relative flex items-center py-4 mb-6">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="flex-shrink-0 mx-4 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Para Desenvolvedores</span>
            <div className="flex-grow border-t border-zinc-800"></div>
        </div>

        <div className="bg-amber-900/10 border border-amber-900/20 p-4 rounded-xl mb-6 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-amber-200/60 text-xs leading-relaxed">
                As variáveis de ambiente do Supabase não foram detectadas. Siga os passos abaixo apenas se for configurar o backend real.
            </p>
        </div>

        <div className="space-y-4 opacity-60 hover:opacity-100 transition-opacity duration-300">
            <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FileText size={14}/> 1. Crie o arquivo .env
                </h3>
                <div className="bg-black/40 border border-zinc-800 rounded-lg p-3 font-mono text-[10px] text-zinc-400 overflow-x-auto">
                    VITE_SUPABASE_URL=...<br/>
                    VITE_SUPABASE_KEY=...
                </div>
            </div>

            <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Terminal size={14}/> 2. Reinicie o servidor
                </h3>
                <div className="bg-black/40 border border-zinc-800 rounded-lg p-2.5 font-mono text-[10px] text-zinc-400">
                    npm run dev
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
