
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, UserPlus, ArrowLeft, Check, ChevronDown, KeyRound, Layers, ShieldCheck, Sparkles } from 'lucide-react';
import { loginWithEmail, loginWithGoogle, registerWithEmail, fetchMinistrySettings, sendPasswordResetEmail } from '../services/supabaseService';
import { LegalModal, LegalDocType } from './LegalDocuments';
import { TypewriterBackground } from './TypewriterBackground';
import { MINISTRIES, DEFAULT_ROLES } from '../types';

interface Props {
  onLoginSuccess?: () => void; 
  isLoading?: boolean;
}

export const LoginScreen: React.FC<Props> = ({ isLoading = false }) => {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regSelectedMinistries, setRegSelectedMinistries] = useState<string[]>([]);
  const [regSelectedRoles, setRegSelectedRoles] = useState<string[]>([]);
  
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    setErrorMsg("");
    setSuccessMsg("");
  }, [view]);

  useEffect(() => {
    async function fetchDynamicRoles() {
        if (regSelectedMinistries.length === 0) {
            setAvailableRoles([]);
            return;
        }
        const mainMinistry = regSelectedMinistries[0];
        setLoadingRoles(true);
        const defaults = DEFAULT_ROLES[mainMinistry] || [];
        setAvailableRoles(defaults);
        try {
            const settings = await fetchMinistrySettings(mainMinistry);
            if (settings.roles && settings.roles.length > 0) setAvailableRoles(settings.roles);
        } catch (e) { console.warn("Using default roles"); } 
        finally { setLoadingRoles(false); }
    }
    if (view === 'register') fetchDynamicRoles();
  }, [regSelectedMinistries, view]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLocalLoading(true);
    setErrorMsg("");
    const result = await loginWithEmail(email.trim(), password.trim());
    if (!result.success) {
      setErrorMsg(result.message);
      setLocalLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLocalLoading(true);
    setErrorMsg("");
    const result = await loginWithGoogle();
    if (!result.success) {
        setErrorMsg(result.message);
        setLocalLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regName || !regEmail || !regPassword || regSelectedMinistries.length === 0) {
          setErrorMsg("Preencha todos os campos e selecione ao menos um ministério.");
          return;
      }
      setLocalLoading(true);
      setErrorMsg("");
      const result = await registerWithEmail(regEmail.trim(), regPassword.trim(), regName.trim(), regSelectedMinistries, undefined, regSelectedRoles);
      if (result.success) {
          setSuccessMsg(result.message);
          setTimeout(() => {
             setEmail(regEmail.trim()); setPassword(""); setView('login'); setSuccessMsg("Conta criada! Faça login."); setErrorMsg("");
          }, 2000);
      } else {
          setErrorMsg(result.message);
      }
      setLocalLoading(false);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) { setErrorMsg("Digite seu e-mail."); return; }
      setLocalLoading(true);
      setErrorMsg("");
      const result = await sendPasswordResetEmail(email.trim());
      if (result.success) setSuccessMsg(result.message); else setErrorMsg(result.message);
      setLocalLoading(false);
  };

  const toggleRole = (role: string) => {
    setRegSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const toggleMinistry = (id: string) => {
      setRegSelectedMinistries(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-[#050505] flex flex-col items-center justify-center font-sans overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
          {/* Subtle static gradient mesh */}
          <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] bg-purple-900/20 rounded-full blur-[120px] mix-blend-screen opacity-40"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-teal-900/20 rounded-full blur-[100px] mix-blend-screen opacity-40"></div>
          
          {/* Dynamic Aurora */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/5 opacity-30 animate-pulse-slow"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-100 contrast-150"></div>
      </div>
      
      <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />

      <div ref={scrollContainerRef} className="relative z-10 w-full h-full overflow-y-auto custom-scrollbar flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[400px] my-auto flex flex-col items-center animate-fade-in transition-all duration-500">
            
            <div className="mb-8 opacity-80 scale-90 sm:scale-100 transition-transform">
                <TypewriterBackground />
            </div>

            {/* Main Card */}
            <div className="w-full bg-[#0F0F11]/80 backdrop-blur-xl border border-white/5 rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] p-6 sm:p-8 relative overflow-hidden group ring-1 ring-white/5 hover:ring-white/10 transition-all duration-500">
                
                {/* Brand Header */}
                <div className="text-center mb-8 relative">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10 bg-gradient-to-b from-[#1a1a1c] to-[#0a0a0c] flex items-center justify-center group-hover:scale-105 transition-transform duration-500 relative z-10">
                        <img src="https://i.ibb.co/jPKNYLQ2/icon.png" alt="Logo" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 text-[10px] font-black uppercase tracking-[0.3em]">Plataforma Ministerial</h2>
                        <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
                            {view === 'login' && 'Bem-vindo de volta'}
                            {view === 'register' && 'Criar Conta'}
                            {view === 'forgot' && 'Recuperar Acesso'}
                        </h1>
                    </div>
                </div>

                {view === 'login' && (
                    <div className="space-y-5 animate-slide-up">
                        <form onSubmit={handleLoginSubmit} className="space-y-4">
                            <div className="space-y-1.5 group">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1 group-focus-within:text-teal-500 transition-colors">E-mail</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-4 top-3.5 text-zinc-500 group-focus-within:text-teal-400 transition-colors z-10" />
                                    <input 
                                        type="email" 
                                        value={email} 
                                        onChange={e => setEmail(e.target.value)} 
                                        placeholder="seu@email.com" 
                                        className="w-full bg-[#18181b]/50 border border-white/5 focus:border-teal-500/50 text-white rounded-xl py-3.5 pl-11 pr-4 outline-none transition-all placeholder:text-zinc-600 text-sm focus:bg-[#18181b] shadow-inner focus:ring-1 focus:ring-teal-500/50" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 group">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1 group-focus-within:text-teal-500 transition-colors">Senha</label>
                                    <button type="button" onClick={() => setView('forgot')} className="text-[10px] text-zinc-400 hover:text-white font-medium transition-colors">Esqueceu?</button>
                                </div>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-4 top-3.5 text-zinc-500 group-focus-within:text-teal-400 transition-colors z-10" />
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        value={password} 
                                        onChange={e => setPassword(e.target.value)} 
                                        placeholder="••••••••" 
                                        className="w-full bg-[#18181b]/50 border border-white/5 focus:border-teal-500/50 text-white rounded-xl py-3.5 pl-11 pr-11 outline-none transition-all placeholder:text-zinc-600 text-sm focus:bg-[#18181b] shadow-inner focus:ring-1 focus:ring-teal-500/50" 
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-zinc-300">
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {successMsg && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-medium animate-fade-in flex items-center justify-center gap-2 backdrop-blur-md"><Check size={14}/> {successMsg}</div>}
                            {errorMsg && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium animate-fade-in backdrop-blur-md">{errorMsg}</div>}

                            <button 
                                type="submit" 
                                disabled={localLoading || isLoading} 
                                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 mt-4 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group border border-white/10"
                            >
                                {localLoading ? <Loader2 className="animate-spin" size={20} /> : <>Entrar <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
                            </button>
                        </form>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-white/5"></div>
                            <span className="flex-shrink-0 mx-4 text-zinc-600 text-[10px] font-bold uppercase tracking-widest">Ou</span>
                            <div className="flex-grow border-t border-white/5"></div>
                        </div>

                        <button 
                            type="button" 
                            onClick={handleGoogleLogin} 
                            disabled={localLoading || isLoading} 
                            className="w-full bg-white text-black hover:bg-zinc-200 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 shadow-sm"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            Continuar com Google
                        </button>
                        
                        <div className="pt-2 text-center">
                            <p className="text-zinc-500 text-xs font-medium mb-3">
                                Não tem conta? <button type="button" onClick={() => setView('register')} className="text-white hover:text-teal-400 font-bold underline decoration-white/20 hover:decoration-teal-400 underline-offset-4 transition-all ml-1">Criar agora</button>
                            </p>
                            <div className="flex justify-center gap-6 mt-4">
                                 <button type="button" onClick={() => setLegalDoc('terms')} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-medium">Termos de Uso</button>
                                 <button type="button" onClick={() => setLegalDoc('privacy')} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-medium">Privacidade</button>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'forgot' && (
                    <form onSubmit={handleForgotSubmit} className="space-y-5 animate-slide-up">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 items-start">
                            <ShieldCheck className="text-blue-400 shrink-0 mt-0.5" size={18}/>
                            <p className="text-xs text-blue-200/80 leading-relaxed">
                                Informe seu e-mail e enviaremos um link seguro para você redefinir sua senha.
                            </p>
                        </div>
                        <div className="space-y-1.5 group">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1 group-focus-within:text-teal-500">E-mail</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-3.5 text-zinc-500 group-focus-within:text-teal-400 transition-colors z-10" />
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    placeholder="seu@email.com" 
                                    className="w-full bg-[#18181b]/50 border border-white/5 focus:border-teal-500/50 text-white rounded-xl py-3.5 pl-11 pr-4 outline-none transition-all placeholder:text-zinc-600 text-sm focus:bg-[#18181b] shadow-inner focus:ring-1 focus:ring-teal-500/50" 
                                />
                            </div>
                        </div>
                        {successMsg && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-medium flex items-center justify-center gap-2 backdrop-blur-md"><Check size={14}/> {successMsg}</div>}
                        {errorMsg && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium backdrop-blur-md">{errorMsg}</div>}
                        
                        <button type="submit" disabled={localLoading} className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4 active:scale-95 disabled:opacity-50">
                            {localLoading ? <Loader2 className="animate-spin" size={20} /> : <>Enviar Link <KeyRound size={18} /></>}
                        </button>
                        <button type="button" onClick={() => setView('login')} className="w-full text-zinc-400 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors py-2">
                            <ArrowLeft size={16}/> Voltar para Login
                        </button>
                    </form>
                )}

                {view === 'register' && (
                    <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-slide-up">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase text-zinc-500 font-bold ml-1">Nome</label>
                                <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Seu nome" className="w-full bg-[#18181b]/50 border border-white/5 focus:border-teal-500/50 text-white rounded-xl py-3 px-3 text-sm outline-none transition-all placeholder:text-zinc-600 focus:bg-[#18181b]" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] uppercase text-zinc-500 font-bold ml-1">E-mail</label>
                                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="joao@gmail.com" className="w-full bg-[#18181b]/50 border border-white/5 focus:border-teal-500/50 text-white rounded-xl py-3 px-3 text-sm outline-none transition-all placeholder:text-zinc-600 focus:bg-[#18181b]" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase text-zinc-500 font-bold flex items-center gap-1 ml-1"><Layers size={12}/> Ministérios</label>
                            <div className="grid grid-cols-1 gap-2 bg-[#18181b]/50 border border-white/5 p-2 rounded-xl max-h-32 overflow-y-auto custom-scrollbar">
                                {MINISTRIES.map(m => {
                                    const isSelected = regSelectedMinistries.includes(m.id);
                                    return (
                                        <button key={m.id} type="button" onClick={() => toggleMinistry(m.id)} className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium transition-all ${isSelected ? 'bg-teal-500/20 border-teal-500/40 text-teal-300' : 'bg-transparent border-transparent text-zinc-400 hover:bg-white/5'}`}>
                                            <span>{m.label}</span>
                                            {isSelected && <Check size={14} className="text-teal-400"/>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {regSelectedMinistries.length > 0 && (
                            <div className="space-y-1.5 animate-fade-in">
                                <label className="text-[10px] uppercase text-zinc-500 font-bold flex justify-between ml-1">
                                    Funções {loadingRoles && <Loader2 size={10} className="animate-spin text-teal-500"/>}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {availableRoles.map(role => {
                                        const isSelected = regSelectedRoles.includes(role);
                                        return (
                                            <button key={role} type="button" onClick={() => toggleRole(role)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${isSelected ? 'bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-500/20' : 'bg-[#18181b] text-zinc-400 border-white/5 hover:border-white/20'}`}>
                                                {role} {isSelected && <Check size={10} />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase text-zinc-500 font-bold ml-1">Senha</label>
                            <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Senha segura" className="w-full bg-[#18181b]/50 border border-white/5 focus:border-teal-500/50 text-white rounded-xl py-3 px-3 text-sm outline-none transition-all placeholder:text-zinc-600 focus:bg-[#18181b]" />
                        </div>

                        {errorMsg && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium animate-fade-in backdrop-blur-md">{errorMsg}</div>}

                        <div className="flex gap-3 mt-2">
                            <button type="button" onClick={() => setView('login')} className="p-3.5 bg-white/5 text-zinc-400 rounded-xl hover:text-white hover:bg-white/10 transition-colors"><ArrowLeft size={20}/></button>
                            <button type="submit" disabled={localLoading} className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-900/30 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50 border border-white/10">
                                {localLoading ? <Loader2 className="animate-spin" size={20}/> : <><UserPlus size={18}/> Criar Conta</>}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
