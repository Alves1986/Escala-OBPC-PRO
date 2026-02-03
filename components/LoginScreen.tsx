import React, { useState } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, Layout } from 'lucide-react';
import { loginWithEmail } from '../services/supabaseService';
import { LegalModal, LegalDocType } from './LegalDocuments';

export const LoginScreen: React.FC<{ isLoading?: boolean }> = ({ isLoading = false }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoadingAction(true);
    setErrorMsg("");
    
    try {
        const result = await loginWithEmail(email.trim(), password.trim());
        if (!result.success) {
            setErrorMsg(result.message || "Erro ao conectar.");
            setLoadingAction(false);
        }
        // Se sucesso, o SessionContext vai atualizar e redirecionar
    } catch (e: any) {
        setErrorMsg("Erro de conexão. Verifique sua internet.");
        setLoadingAction(false);
    }
  };

  const isGlobalLoading = loadingAction || isLoading;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row relative overflow-hidden font-sans">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[150px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] animate-pulse"></div>
      </div>

      <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />

      {/* Hero Section (Left on Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 relative z-10">
          <div>
              <div className="flex items-center gap-3 mb-12">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 shadow-2xl shadow-emerald-500/20 flex items-center justify-center text-white">
                      <Layout size={24} />
                  </div>
                  <h1 className="text-2xl font-black tracking-tighter text-white uppercase">OBPC Gestão <span className="text-emerald-500">Pro</span></h1>
              </div>
              <h2 className="text-6xl font-black text-white leading-[1.05] tracking-tighter mb-8">
                  Excelência no <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">serviço</span> ministerial.
              </h2>
              <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                  Sincronize sua equipe, organize escalas e mantenha o foco no que realmente importa. Simples, moderno e eficiente.
              </p>
          </div>
      </div>

      {/* Form Section (Right on Desktop) */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10 bg-slate-950/40 backdrop-blur-md">
          <div className="w-full max-w-[420px]">
              <div className="text-center lg:text-left mb-10">
                  <div className="lg:hidden flex justify-center mb-6">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-500 shadow-xl flex items-center justify-center text-white">
                          <Layout size={32} />
                      </div>
                  </div>
                  <h3 className="text-xs font-black text-emerald-500 uppercase tracking-[0.3em] mb-3">Bem-vindo</h3>
                  <h1 className="text-4xl font-black text-white tracking-tighter">
                      Conecte-se
                  </h1>
              </div>

              {/* Form Card */}
              <div className="bg-slate-900/80 border border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden group">
                  
                  <form onSubmit={handleLoginSubmit} className="space-y-6">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                          <div className="relative group">
                              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-400 transition-colors" />
                              <input 
                                  type="email" 
                                  value={email} 
                                  onChange={e => setEmail(e.target.value)}
                                  placeholder="seu@email.com" 
                                  className="w-full bg-slate-950 border border-white/5 focus:border-emerald-500/50 text-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                  disabled={isGlobalLoading}
                              />
                          </div>
                      </div>

                      <div className="space-y-2">
                          <div className="flex justify-between items-center ml-1">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Senha</label>
                          </div>
                          <div className="relative group">
                              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-400 transition-colors" />
                              <input 
                                  type={showPassword ? "text" : "password"} 
                                  value={password} 
                                  onChange={e => setPassword(e.target.value)}
                                  placeholder="••••••••" 
                                  className="w-full bg-slate-950 border border-white/5 focus:border-emerald-500/50 text-white rounded-2xl py-4 pl-12 pr-12 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                  disabled={isGlobalLoading}
                              />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white">
                                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                          </div>
                      </div>

                      {errorMsg && <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold animate-slide-up text-center">{errorMsg}</div>}

                      <button 
                          type="submit" 
                          disabled={isGlobalLoading}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                      >
                          {isGlobalLoading ? <Loader2 size={20} className="animate-spin" /> : <>Entrar agora <ArrowRight size={18}/></>}
                      </button>
                  </form>
              </div>

              <div className="mt-8 text-center">
                  <div className="flex justify-center gap-6 mt-6">
                      <button onClick={() => setLegalDoc('terms')} className="text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-slate-400 transition-colors">Termos</button>
                      <button onClick={() => setLegalDoc('privacy')} className="text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-slate-400 transition-colors">Privacidade</button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};