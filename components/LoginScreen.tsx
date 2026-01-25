import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, Sparkles, Layout, Database, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { loginWithEmail, registerWithEmail, fetchMinistrySettings, fetchOrganizationMinistries } from '../services/supabaseService';
import { LegalModal, LegalDocType } from './LegalDocuments';
import { DEFAULT_ROLES, MinistryDef } from '../types';

export const LoginScreen: React.FC<{ isLoading?: boolean }> = ({ isLoading = false }) => {
  // States
  const [view, setView] = useState<'welcome' | 'login' | 'register' | 'forgot'>('login');
  
  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Register State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regSelectedMinistries, setRegSelectedMinistries] = useState<string[]>([]);
  const [regSelectedRoles, setRegSelectedRoles] = useState<string[]>([]);
  
  // Data State
  const [ministriesList, setMinistriesList] = useState<MinistryDef[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  
  // UI State
  const [loadingAction, setLoadingAction] = useState<'email' | 'google' | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);
  
  const [orgContext, setOrgContext] = useState<string | null>(null);

  // Initialize from URL (Invite Flow)
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const urlOrg = params.get('org') || params.get('orgId');
      
      if (urlOrg) {
          setOrgContext(urlOrg);
          setView('welcome'); // New Welcome Screen for Invites
      } else {
          setView('login');
      }
  }, []);

  // Load Ministries when needed
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
    if (view === 'register' || view === 'welcome') loadMinistries();
  }, [view, orgContext]);

  // Load Roles dynamically
  useEffect(() => {
    async function fetchDynamicRoles() {
        if (regSelectedMinistries.length === 0 || !orgContext) {
            setAvailableRoles([]);
            return;
        }
        const mainMinistry = regSelectedMinistries[0];
        const ministry = ministriesList.find(m => m.id === mainMinistry);

        setLoadingRoles(true);
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
    
    try {
        const result = await loginWithEmail(email.trim(), password.trim());
        if (!result.success) {
          setErrorMsg(result.message);
          setLoadingAction(null);
        }
        // Success redirects automatically via SessionContext
    } catch (error: any) {
        console.error("Login Error:", error);
        if (error.message === 'SUPABASE_NOT_INITIALIZED') {
            setErrorMsg("Erro de Configuração: Conexão com banco de dados não estabelecida.");
        } else {
            setErrorMsg("Erro ao entrar. Verifique suas credenciais.");
        }
        setLoadingAction(null);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!orgContext) {
          setErrorMsg("Link de convite inválido ou expirado.");
          return;
      }
      if (!regName || !regEmail || !regPassword || regSelectedMinistries.length === 0) {
          setErrorMsg("Preencha todos os campos e selecione um ministério.");
          return;
      }
      setLoadingAction('email');
      
      try {
          const result = await registerWithEmail(regEmail.trim(), regPassword.trim(), regName.trim(), regSelectedMinistries, orgContext, regSelectedRoles);
          
          if (result.success) {
              setSuccessMsg("Conta ativada com sucesso! Redirecionando para o login...");
              setTimeout(() => {
                  setEmail(regEmail);
                  setPassword("");
                  setSuccessMsg("");
                  setView('login');
              }, 2000);
          } else {
              if (result.message?.includes("already registered") || result.message?.includes("already in use")) {
                  setErrorMsg("Este e-mail já possui cadastro. Tente fazer Login.");
              } else {
                  setErrorMsg(result.message || "Erro ao criar conta.");
              }
          }
      } catch (error: any) {
          console.error("Register Error:", error);
          if (error.message === 'SUPABASE_NOT_INITIALIZED') {
              setErrorMsg("Erro de Configuração: Sistema offline.");
          } else {
              setErrorMsg("Erro inesperado. Tente novamente.");
          }
      } finally {
          setLoadingAction(null);
      }
  };

  const isGlobalLoading = !!loadingAction || isLoading;

  // --- RENDER HELPERS ---

  const InviteWelcomeCard = () => (
      <div className="text-center space-y-6 animate-slide-up">
          <div className="inline-block p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 mb-2">
              <Sparkles size={32} className="text-emerald-400 animate-pulse" />
          </div>
          <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Você foi convidado!</h2>
              <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
                  Para acessar a escala e ferramentas da sua equipe, escolha uma das opções abaixo.
              </p>
          </div>
          
          <div className="grid gap-3">
              <button 
                  onClick={() => setView('register')}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/10 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs group"
              >
                  <UserPlus size={18} className="group-hover:scale-110 transition-transform"/>
                  Primeiro Acesso (Criar Conta)
              </button>
              
              <button 
                  onClick={() => setView('login')}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
              >
                  <LogIn size={18} />
                  Já tenho conta (Entrar)
              </button>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row relative overflow-hidden font-sans">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-600/10 blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[100px] animate-pulse"></div>
      </div>

      <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />

      {/* Left Column: Brand & Value Prop */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 relative z-10">
          <div>
              <div className="flex items-center gap-3 mb-10">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 shadow-2xl shadow-emerald-500/20 flex items-center justify-center text-white">
                      <Layout size={24} />
                  </div>
                  <h1 className="text-2xl font-black tracking-tighter text-white uppercase">OBPC Gestão <span className="text-emerald-500">Pro</span></h1>
              </div>
              <h2 className="text-5xl font-black text-white leading-[1.1] tracking-tighter mb-6">
                  Transforme a <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">gestão</span> do seu ministério.
              </h2>
              <p className="text-slate-400 text-lg max-w-md leading-relaxed">
                  Escalas automatizadas, repertório integrado e comunicação eficiente. Tudo em um só lugar.
              </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10">
                  <ShieldCheck className="text-emerald-400 mb-3" size={24}/>
                  <h3 className="text-white font-bold text-sm">Seguro & Privado</h3>
                  <p className="text-slate-500 text-xs mt-1">Seus dados protegidos com criptografia de ponta.</p>
              </div>
              <div className="bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10">
                  <Sparkles className="text-emerald-400 mb-3" size={24}/>
                  <h3 className="text-white font-bold text-sm">Simples de Usar</h3>
                  <p className="text-slate-500 text-xs mt-1">Interface intuitiva pensada para voluntários.</p>
              </div>
          </div>
      </div>

      {/* Right Column: Auth Forms */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative z-10 bg-slate-950/50 backdrop-blur-sm lg:bg-transparent">
          <div className="w-full max-w-[420px]">
              
              {/* Mobile Header */}
              <div className="lg:hidden text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 shadow-xl flex items-center justify-center text-white mx-auto mb-4">
                      <Layout size={28} />
                  </div>
                  <h1 className="text-2xl font-black text-white uppercase tracking-tight">OBPC Gestão</h1>
              </div>

              {/* Card Container */}
              <div className="bg-slate-900/90 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                  
                  {view === 'welcome' && <InviteWelcomeCard />}

                  {view === 'login' && (
                      <div className="animate-fade-in">
                          <h2 className="text-2xl font-black text-white mb-6">Acesse sua conta</h2>
                          <form onSubmit={handleLoginSubmit} className="space-y-5">
                              <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                                  <div className="relative group">
                                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-400 transition-colors" />
                                      <input 
                                          type="email" 
                                          value={email} 
                                          onChange={e => setEmail(e.target.value)}
                                          placeholder="seu@email.com" 
                                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 text-white rounded-xl py-3.5 pl-11 pr-4 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                          disabled={isGlobalLoading}
                                      />
                                  </div>
                              </div>

                              <div className="space-y-1.5">
                                  <div className="flex justify-between items-center ml-1">
                                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Senha</label>
                                      <button type="button" onClick={() => setView('forgot')} className="text-[10px] font-black text-slate-600 hover:text-white uppercase transition-colors">Esqueceu?</button>
                                  </div>
                                  <div className="relative group">
                                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-400 transition-colors" />
                                      <input 
                                          type={showPassword ? "text" : "password"} 
                                          value={password} 
                                          onChange={e => setPassword(e.target.value)}
                                          placeholder="••••••••" 
                                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 text-white rounded-xl py-3.5 pl-11 pr-11 outline-none transition-all placeholder:text-slate-700 text-sm font-bold"
                                          disabled={isGlobalLoading}
                                      />
                                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                      </button>
                                  </div>
                              </div>

                              {errorMsg && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center animate-slide-up">{errorMsg}</div>}
                              {successMsg && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold text-center animate-slide-up">{successMsg}</div>}

                              <button 
                                  type="submit" 
                                  disabled={isGlobalLoading}
                                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black py-4 rounded-xl shadow-lg shadow-emerald-500/10 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                              >
                                  {loadingAction === 'email' ? <Loader2 size={20} className="animate-spin" /> : <>Entrar <ArrowRight size={18}/></>}
                              </button>
                          </form>
                      </div>
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
                                      Você precisa de um <strong>link de convite</strong> da sua liderança para criar uma conta.
                                  </p>
                              </div>
                              <button type="button" onClick={() => setView('login')} className="text-emerald-400 hover:text-emerald-300 font-bold text-xs uppercase tracking-widest">Voltar ao Login</button>
                          </div>
                      ) : (
                      <div className="animate-fade-in">
                          <button onClick={() => setView('welcome')} className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-bold mb-4 transition-colors"><ArrowLeft size={14}/> Voltar</button>
                          <h2 className="text-2xl font-black text-white mb-6">Ativar Conta</h2>
                          
                          <form onSubmit={handleRegisterSubmit} className="space-y-4">
                              <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nome Completo</label>
                                  <input value={regName} onChange={e => setRegName(e.target.value)} disabled={isGlobalLoading} className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-emerald-500/50" placeholder="Seu nome na escala" />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">E-mail</label>
                                  <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} disabled={isGlobalLoading} className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-emerald-500/50" placeholder="exemplo@gmail.com" />
                              </div>
                              
                              <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Ministério Principal</label>
                                  <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1 bg-slate-950 rounded-xl border border-slate-800">
                                      {ministriesList.length === 0 ? (
                                          <p className="text-xs text-slate-500 p-2 italic text-center">Nenhum ministério encontrado.</p>
                                      ) : (
                                          ministriesList.map(m => (
                                              <button key={m.id} type="button" onClick={() => setRegSelectedMinistries([m.id])} className={`text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${regSelectedMinistries.includes(m.id) ? 'bg-emerald-500 text-emerald-950' : 'text-slate-400 hover:bg-slate-900'}`}>
                                                  {m.label}
                                                  {regSelectedMinistries.includes(m.id) && <ArrowRight size={14}/>}
                                              </button>
                                          ))
                                      )}
                                  </div>
                              </div>

                              <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Definir Senha</label>
                                  <input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} disabled={isGlobalLoading} className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-emerald-500/50" placeholder="••••••••" />
                              </div>

                              {successMsg && <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold text-center animate-pulse">{successMsg}</div>}
                              {errorMsg && <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold text-center">{errorMsg}</div>}

                              <button type="submit" disabled={isGlobalLoading} className="w-full bg-emerald-500 text-emerald-950 font-black py-4 rounded-xl shadow-xl uppercase tracking-widest text-xs mt-2 hover:bg-emerald-400 transition-colors">
                                  {isGlobalLoading ? <Loader2 className="animate-spin mx-auto" size={20}/> : "Confirmar Cadastro"}
                              </button>
                          </form>
                      </div>
                      )
                  )}
              </div>

              {/* Footer Links */}
              {view !== 'welcome' && (
                  <div className="mt-6 text-center">
                      <div className="flex justify-center gap-6">
                          <button onClick={() => setLegalDoc('terms')} className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors">Termos</button>
                          <button onClick={() => setLegalDoc('privacy')} className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors">Privacidade</button>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};