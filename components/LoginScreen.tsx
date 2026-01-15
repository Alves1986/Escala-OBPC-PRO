import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, Sparkles, Layout, Database, AlertCircle } from 'lucide-react';
import { loginWithEmail, loginWithGoogle, registerWithEmail, fetchMinistrySettings, fetchOrganizationMinistries, disconnectManual } from '../services/supabaseService';
import { LegalModal, LegalDocType } from './LegalDocuments';
import { DEFAULT_ROLES, MinistryDef } from '../types';

export const LoginScreen: React.FC<{ isLoading?: boolean }> = ({ isLoading = false }) => {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regSelectedMinistries, setRegSelectedMinistries] = useState<string[]>([]);
  const [regSelectedRoles, setRegSelectedRoles] = useState<string[]>([]);
  
  const [ministriesList, setMinistriesList] = useState<MinistryDef[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingAction, setLoadingAction] = useState<'email' | 'google' | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);
  
  const [orgContext, setOrgContext] = useState<string | null>(null);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const urlOrg = params.get('org') || params.get('orgId');
      if (urlOrg) setOrgContext(urlOrg);
  }, []);

  useEffect(() => {
    async function loadMinistries() {
        if (!orgContext) return;
        try {
            const list = await fetchOrganizationMinistries(orgContext);
            setMinistriesList(list);
        } catch (e) {
            console.error("Failed to load ministries", e);
        }
    }
    if (view === 'register') loadMinistries();
  }, [view, orgContext]);

  useEffect(() => {
    async function fetchDynamicRoles() {
        if (regSelectedMinistries.length === 0 || !orgContext) {
            setAvailableRoles([]);
            return;
        }
        const mainMinistry = regSelectedMinistries[0];
        const ministry = ministriesList.find(m => m.id === mainMinistry);

        setLoadingRoles(true);
        // Correctly use ministry code for defaults
        const defaults = (ministry && DEFAULT_ROLES[ministry.code]) ? DEFAULT_ROLES[ministry.code] : (DEFAULT_ROLES['default'] || []);
        setAvailableRoles(defaults);
        try {
            const settings = await fetchMinistrySettings(mainMinistry, orgContext);
            if (settings && settings.roles && settings.roles.length > 0) setAvailableRoles(settings.roles);
        } catch (e) { console.warn("Defaults used"); } 
        finally { setLoadingRoles(false); }
    }
    if (view === 'register') fetchDynamicRoles();
  }, [regSelectedMinistries, view, ministriesList, orgContext]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoadingAction('email');
    setErrorMsg("");
    const result = await loginWithEmail(email.trim(), password.trim());
    if (!result.success) {
      setErrorMsg(result.message);
      setLoadingAction(null);
    }
  };

  const handleGoogleLogin = async () => {
    setLoadingAction('google');
    setErrorMsg("");
    const result = await loginWithGoogle();
    if (!result.success) {
        setErrorMsg(result.message);
        setLoadingAction(null);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!orgContext) {
          setErrorMsg("Erro crítico: Organização não identificada.");
          return;
      }
      if (!regName || !regEmail || !regPassword || regSelectedMinistries.length === 0) {
          setErrorMsg("Preencha todos os campos obrigatórios.");
          return;
      }
      setLoadingAction('email');
      
      const result = await registerWithEmail(regEmail.trim(), regPassword.trim(), regName.trim(), regSelectedMinistries, orgContext, regSelectedRoles);
      if (result.success) {
          setSuccessMsg(result.message);
          setTimeout(() => setView('login'), 2000);
      } else {
          setErrorMsg(result.message);
      }
      setLoadingAction(null);
  };

  const isGlobalLoading = !!loadingAction || isLoading;

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

          <div className="flex items-center gap-8">
              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-[2rem] border border-white/10 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <ShieldCheck className="text-emerald-400" size={20}/>
                    <span className="text-xs font-black uppercase tracking-widest text-white">Segurança Enterprise</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Proteção de dados com criptografia de ponta a ponta via Supabase Auth.</p>
              </div>
              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-[2rem] border border-white/10 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Sparkles className="text-emerald-400" size={20}/>
                    <span className="text-xs font-black uppercase tracking-widest text-white">Interface Inteligente</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Experiência de usuário fluida em qualquer dispositivo com suporte a PWA.</p>
              </div>
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
                      {view === 'login' ? 'Conecte-se' : view === 'register' ? 'Crie sua conta' : 'Recupere o acesso'}
                  </h1>
              </div>

              {/* Form Card */}
              <div className="bg-slate-900/80 border border-white/5 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden group">
                  
                  {view === 'login' && (
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
                                  <button type="button" onClick={() => setView('forgot')} className="text-[10px] font-black text-slate-600 hover:text-white uppercase">Esqueceu?</button>
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
                              {loadingAction === 'email' ? <Loader2 size={20} className="animate-spin" /> : <>Entrar agora <ArrowRight size={18}/></>}
                          </button>

                          <div className="relative flex items-center py-2">
                              <div className="flex-grow border-t border-white/5"></div>
                              <span className="flex-shrink-0 mx-4 text-slate-700 text-[10px] font-black uppercase">Ou acesse com</span>
                              <div className="flex-grow border-t border-white/5"></div>
                          </div>

                          <button 
                              type="button" 
                              onClick={handleGoogleLogin} 
                              disabled={isGlobalLoading}
                              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl disabled:opacity-50 uppercase tracking-widest text-[10px]"
                          >
                              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/google.svg" className="w-5 h-5" alt="Google" />
                              Google Account
                          </button>
                      </form>
                  )}

                  {view === 'register' && (
                      !orgContext ? (
                          <div className="text-center py-8 space-y-4 animate-fade-in">
                              <div className="bg-red-500/10 p-4 rounded-full inline-block border border-red-500/20">
                                  <AlertCircle size={32} className="text-red-500"/>
                              </div>
                              <div>
                                  <h3 className="text-white font-bold text-lg">Cadastro Restrito</h3>
                                  <p className="text-slate-400 text-xs mt-2 max-w-[260px] mx-auto leading-relaxed">
                                      O cadastro público está desabilitado. Você precisa de um <strong>link de convite</strong> da sua organização para se registrar.
                                  </p>
                              </div>
                              <button type="button" onClick={() => setView('login')} className="text-emerald-400 hover:text-emerald-300 font-black text-xs uppercase tracking-widest underline decoration-emerald-500/50 underline-offset-4">Voltar ao Login</button>
                          </div>
                      ) : (
                      <form onSubmit={handleRegisterSubmit} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome</label>
                                  <input value={regName} onChange={e => setRegName(e.target.value)} disabled={isGlobalLoading} className="w-full bg-slate-950 border border-white/5 text-white rounded-xl py-3.5 px-4 outline-none text-sm font-bold focus:border-emerald-500/50" placeholder="Seu nome" />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                                  <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} disabled={isGlobalLoading} className="w-full bg-slate-950 border border-white/5 text-white rounded-xl py-3.5 px-4 outline-none text-sm font-bold focus:border-emerald-500/50" placeholder="ex@gmail.com" />
                              </div>
                          </div>

                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ministério</label>
                              <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                                  {ministriesList.length === 0 ? (
                                      <p className="text-xs text-slate-500 italic">Nenhum ministério encontrado.</p>
                                  ) : (
                                      ministriesList.map(m => (
                                          <button key={m.id} type="button" onClick={() => setRegSelectedMinistries([m.id])} className={`text-left px-4 py-3 rounded-xl border text-xs font-bold transition-all ${regSelectedMinistries.includes(m.id) ? 'bg-emerald-500 border-emerald-400 text-emerald-950 shadow-lg' : 'bg-slate-950 border-white/5 text-slate-400 hover:border-white/20'}`}>
                                              {m.label}
                                          </button>
                                      ))
                                  )}
                              </div>
                          </div>

                          <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nova Senha</label>
                              <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} disabled={isGlobalLoading} className="w-full bg-slate-950 border border-white/5 text-white rounded-xl py-3.5 px-4 outline-none text-sm font-bold focus:border-emerald-500/50" placeholder="••••••••" />
                          </div>

                          {successMsg && <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold text-center">{successMsg}</div>}
                          {errorMsg && <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-bold text-center">{errorMsg}</div>}

                          <div className="flex gap-3 pt-2">
                              <button type="button" onClick={() => setView('login')} className="p-4 bg-white/5 text-slate-400 rounded-2xl hover:text-white transition-colors"><ArrowLeft size={20}/></button>
                              <button type="submit" disabled={isGlobalLoading} className="flex-1 bg-emerald-500 text-emerald-950 font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest text-xs">Criar Conta</button>
                          </div>
                      </form>
                      )
                  )}
              </div>

              <div className="mt-8 text-center">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                      {view === 'login' ? 'Não possui acesso?' : 'Já possui conta?'}
                      <button onClick={() => setView(view === 'login' ? 'register' : 'login')} className="ml-2 text-white hover:text-emerald-400 transition-colors underline decoration-emerald-500 underline-offset-4">
                          {view === 'login' ? 'Registre-se' : 'Entrar'}
                      </button>
                  </p>
                  
                  {/* Reset Connection Button */}
                  <div className="mt-4">
                      <button 
                        onClick={() => {
                            if (confirm("Deseja desconectar do servidor atual e reconfigurar a conexão?")) {
                                disconnectManual();
                            }
                        }}
                        className="text-[10px] text-slate-600 hover:text-red-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-colors"
                      >
                          <Database size={12} /> Alterar Conexão
                      </button>
                  </div>

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