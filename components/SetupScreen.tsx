import React, { useState } from 'react';
import { Database, FileText, AlertTriangle, Sparkles, ArrowRight, Plug, Link, CheckCircle2, XCircle, Key, ShieldCheck } from 'lucide-react';
import { configureSupabaseManual, validateConnection } from '../services/supabaseService';

interface Props {
  onEnterDemo: () => void;
  onConfigured?: () => void; // Callback para notificar o App
}

export const SetupScreen: React.FC<Props> = ({ onEnterDemo, onConfigured }) => {
  const [customUrl, setCustomUrl] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleManualConnect = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!customUrl.trim() || !customKey.trim()) {
          setErrorMsg("Por favor, preencha a URL e a Chave do Supabase.");
          return;
      }

      setIsLoading(true);
      setErrorMsg("");

      // Validação Profissional
      const isValid = await validateConnection(customUrl.trim(), customKey.trim());

      if (isValid) {
          configureSupabaseManual(customUrl.trim(), customKey.trim());
          if (onConfigured) onConfigured();
      } else {
          setErrorMsg("Não foi possível conectar. Verifique se a URL e a KEY estão corretas e se o banco está ativo.");
      }
      setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6 font-sans relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#0a0f1e] to-slate-900"></div>
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl animate-fade-in relative z-10">
        
        <div className="text-center mb-8">
           <div className="inline-flex p-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl border border-white/10 shadow-inner mb-5">
             <Database size={32} className="text-emerald-400" />
           </div>
           <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Configuração do Sistema</h1>
           <p className="text-slate-400 text-sm">Conecte-se ao seu banco de dados Supabase para iniciar.</p>
        </div>

        {/* Manual Connection Form */}
        <form onSubmit={handleManualConnect} className="space-y-5">
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                    <Link size={10} /> Supabase Project URL
                </label>
                <div className="relative group">
                    <input 
                        type="text" 
                        value={customUrl} 
                        onChange={e => setCustomUrl(e.target.value)} 
                        placeholder="https://xyz.supabase.co" 
                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all font-medium font-mono"
                    />
                </div>
            </div>
            
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                    <Key size={10} /> Anon Public Key
                </label>
                <div className="relative group">
                    <input 
                        type="password" 
                        value={customKey} 
                        onChange={e => setCustomKey(e.target.value)} 
                        placeholder="eyJh..." 
                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all font-medium font-mono"
                    />
                </div>
            </div>

            {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-slide-up">
                    <XCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-200 leading-relaxed font-medium">{errorMsg}</p>
                </div>
            )}

            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
            >
                {isLoading ? (
                    <>Verificando...</>
                ) : (
                    <><Plug size={18} /> Conectar ao Servidor</>
                )}
            </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                <ShieldCheck size={12} /> Conexão Segura & Criptografada
            </div>
        </div>
      </div>
    </div>
  );
};