
import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors duration-500">
      {/* Styles for the custom progress animation */}
      <style>{`
        @keyframes indeterminate-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(20%); width: 50%; }
          100% { transform: translateX(200%); width: 20%; }
        }
        .animate-indeterminate {
          animation: indeterminate-bar 1.5s infinite linear;
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        {/* Logo Container com Glow */}
        <div className="relative w-28 h-28 mb-8">
            <div className="absolute inset-0 bg-teal-500/30 blur-2xl rounded-full animate-pulse-slow"></div>
            
            {/* Spinner Ring - Circular */}
            <div className="absolute -inset-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-full animate-[spin_10s_linear_infinite]"></div>
            
            {/* Logo Image - Agora Circular (rounded-full) */}
            <div className="relative w-full h-full bg-zinc-900 rounded-full shadow-2xl flex items-center justify-center border border-zinc-800 overflow-hidden z-10">
                <img src="https://i.ibb.co/jPKNYLQ2/icon.png" alt="Logo" className="w-full h-full object-cover opacity-90 scale-90 rounded-full" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
        </div>

        {/* Texto de Carregamento */}
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 tracking-tight animate-fade-in mt-4">
          Gestão Escala OBPC
        </h2>
        <div className="flex items-center gap-2 mt-2 text-sm text-zinc-500 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
          <span>Sincronizando dados...</span>
        </div>

        {/* Barra de Progresso em Movimento */}
        <div className="w-48 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-8 overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-teal-500 to-emerald-600 rounded-full animate-indeterminate w-full"></div>
        </div>
      </div>
      
      <div className="absolute bottom-8 text-[10px] text-zinc-400 uppercase tracking-widest font-bold opacity-60">
        Sistema Seguro & Criptografado
      </div>
    </div>
  );
};
