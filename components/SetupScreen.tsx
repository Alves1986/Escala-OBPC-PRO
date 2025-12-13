
import React from 'react';
import { Database, FileText, AlertTriangle, Terminal } from 'lucide-react';

export const SetupScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4 font-sans">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl animate-fade-in relative overflow-hidden">
        
        {/* Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-teal-500/50 blur-[20px]"></div>

        <div className="flex justify-center mb-6">
           <div className="p-4 bg-zinc-800 rounded-2xl border border-zinc-700 shadow-inner">
             <Database size={32} className="text-teal-500" />
           </div>
        </div>
        
        <h1 className="text-xl font-bold text-center mb-2 text-white">Configuração Necessária</h1>
        
        <div className="bg-amber-900/20 border border-amber-900/30 p-4 rounded-xl mb-6 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-amber-200/80 text-sm leading-relaxed">
                As variáveis de ambiente do Supabase não foram detectadas. Para segurança da aplicação, a configuração manual foi desativada.
            </p>
        </div>

        <div className="space-y-6">
            <div>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileText size={16}/> 1. Crie o arquivo .env
                </h3>
                <p className="text-zinc-500 text-sm mb-2">
                    Na raiz do projeto, crie um arquivo chamado <code>.env</code> (ou <code>.env.local</code>) e adicione suas credenciais:
                </p>
                <div className="bg-black/50 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-green-400 overflow-x-auto">
                    VITE_SUPABASE_URL=https://seu-projeto.supabase.co<br/>
                    VITE_SUPABASE_KEY=sua-chave-anonima-aqui
                </div>
            </div>

            <div>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Terminal size={16}/> 2. Reinicie o servidor
                </h3>
                <p className="text-zinc-500 text-sm">
                    Após criar o arquivo, pare o servidor de desenvolvimento e inicie novamente para carregar as novas variáveis.
                </p>
                <div className="mt-2 bg-black/50 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-300">
                    npm run dev
                </div>
            </div>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
            <p className="text-[10px] text-zinc-600">
                Se você está vendo esta tela em produção, verifique as configurações de variáveis de ambiente no seu painel de hospedagem (Vercel, Netlify, etc).
            </p>
        </div>
      </div>
    </div>
  );
};
