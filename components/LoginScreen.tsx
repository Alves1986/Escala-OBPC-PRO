
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, UserPlus, ArrowLeft, Check, ChevronDown, KeyRound, Layers } from 'lucide-react';
import { loginWithEmail, registerWithEmail, loadData, sendPasswordResetEmail } from '../services/supabaseService';
import { LegalModal, LegalDocType } from './LegalDocuments';
import { TypewriterBackground } from './TypewriterBackground';
import { MINISTRIES, DEFAULT_ROLES } from '../types';

interface Props {
  onLoginSuccess?: () => void; 
  isLoading?: boolean;
}

export const LoginScreen: React.FC<Props> = ({ isLoading = false }) => {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Register State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  // Agora suporta múltiplos ministérios
  const [regSelectedMinistries, setRegSelectedMinistries] = useState<string[]>([]);
  const [regSelectedRoles, setRegSelectedRoles] = useState<string[]>([]);
  
  // Roles State
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  
  // UI State
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);

  // Ref para o container de scroll (para rolar ao topo ao trocar de view)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Resetar scroll ao trocar de view
  useEffect(() => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
    }
    setErrorMsg("");
    setSuccessMsg("");
  }, [view]);

  useEffect(() => {
    async function fetchDynamicRoles() {
        // Carrega roles apenas do primeiro ministério selecionado para simplificar o UX inicial
        // (O usuário pode ajustar roles depois no perfil)
        if (regSelectedMinistries.length === 0) {
            setAvailableRoles([]);
            return;
        }

        const mainMinistry = regSelectedMinistries[0];
        setLoadingRoles(true);
        const defaults = DEFAULT_ROLES[mainMinistry] || [];
        setAvailableRoles(defaults);
        
        try {
            const dynamicRoles = await loadData<string[]>(mainMinistry, 'functions_config', defaults);
            if (JSON.stringify(dynamicRoles) !== JSON.stringify(defaults)) {
                setAvailableRoles(dynamicRoles);
            }
        } catch (e) {
            console.warn("Usando funções padrão (offline ou erro)");
        } finally {
            setLoadingRoles(false);
        }
    }

    if (view === 'register') {
        fetchDynamicRoles();
    }
  }, [regSelectedMinistries, view]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLocalLoading(true);
    setErrorMsg("");

    const result = await loginWithEmail(email, password);

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
      
      const result = await registerWithEmail(regEmail, regPassword, regName, regSelectedMinistries, undefined, regSelectedRoles);
      
      if (result.success) {
          setSuccessMsg(result.message);
          setTimeout(() => {
             setEmail(regEmail);
             setPassword(regPassword);
             setView('login');
             setSuccessMsg("Conta criada! Faça login.");
             setErrorMsg("");
          }, 2000);
      } else {
          setErrorMsg(result.message);
      }
      setLocalLoading(false);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) {
          setErrorMsg("Digite seu e-mail.");
          return;
      }
      
      setLocalLoading(true);
      setErrorMsg("");

      const result = await sendPasswordResetEmail(email);
      
      if (result.success) {
          setSuccessMsg(result.message);
      } else {
          setErrorMsg(result.message);
      }
      setLocalLoading(false);
  };

  const toggleRole = (role: string) => {
    if (regSelectedRoles.includes(role)) {
      setRegSelectedRoles(regSelectedRoles.filter(r => r !== role));
    } else {
      setRegSelectedRoles([...regSelectedRoles, role]);
    }
  };

  const toggleMinistry = (id: string) => {
      if (regSelectedMinistries.includes(id)) {
          setRegSelectedMinistries(regSelectedMinistries.filter(m => m !== id));
      } else {
          setRegSelectedMinistries([...regSelectedMinistries, id]);
      }
  };

  return (
    <div className="fixed inset-0 z-50 w-full h-full bg-zinc-950 flex flex-col items-center justify-center font-sans overflow-hidden">
      <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />

      {/* Main Scrollable Container (Z-Index 10) */}
      <div 
        ref={scrollContainerRef}
        className="relative z-10 w-full h-full overflow-y-auto custom-scrollbar flex flex-col items-center justify-center p-4 md:p-6"
      >
        <div className="w-full max-w-sm my-auto flex flex-col items-center">
            
            {/* Frases Efeito Typewriter ACIMA do card */}
            <TypewriterBackground />

            <div className="w-full bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl p-6 md:p-8 transition-all">
            
            {/* Header */}
            <div className="text-center mb-8">
                <img src="/icon.png?v=2" alt="Logo" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-xl hover:scale-105 transition-transform duration-300" />
                
                <h2 className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
                    Gestão de Escala OBPC
                </h2>

                <h1 className="text-2xl font-bold text-white tracking-tight animate-fade-in">
                    {view === 'login' && 'Entrar no Sistema'}
                    {view === 'register' && 'Criar Nova Conta'}
                    {view === 'forgot' && 'Recuperar Senha'}
                </h1>
            </div>

            {/* VIEWS - Usando Key para forçar remontagem limpa */}
            
            {/* LOGIN VIEW */}
            {view === 'login' && (
                <form key="login-form" onSubmit={handleLoginSubmit} className="space-y-4 animate-slide-up">
                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">E-mail</label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-3 top-3 text-zinc-600" />
                            <input 
                                type="email" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)}
                                placeholder="seu@email.com" 
                                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-xl py-2.5 pl-9 pr-3 outline-none transition-colors text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">Senha</label>
                            <button 
                                type="button" 
                                onClick={() => setView('forgot')}
                                className="text-[10px] text-blue-500 hover:text-blue-400 font-bold"
                            >
                                Esqueceu?
                            </button>
                        </div>
                        <div className="relative">
                            <Lock size={16} className="absolute left-3 top-3 text-zinc-600" />
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={password} 
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••" 
                                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-xl py-2.5 pl-9 pr-10 outline-none transition-colors text-sm"
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {successMsg && <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs text-center animate-fade-in">{successMsg}</div>}
                    {errorMsg && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs text-center animate-fade-in">{errorMsg}</div>}

                    <button 
                        type="submit"
                        disabled={localLoading || isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-2"
                    >
                        {localLoading ? <Loader2 className="animate-spin" size={18} /> : <>Entrar <ArrowRight size={18} /></>}
                    </button>
                    
                    <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
                        <button 
                            type="button"
                            onClick={() => setView('register')}
                            className="text-zinc-400 hover:text-white text-xs font-medium flex items-center justify-center gap-1 mx-auto transition-colors"
                        >
                            <UserPlus size={14}/> Não tem conta? Criar agora
                        </button>

                        <div className="flex justify-center gap-4 mt-4 pt-2">
                             <button type="button" onClick={() => setLegalDoc('terms')} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Termos de Uso</button>
                             <button type="button" onClick={() => setLegalDoc('privacy')} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">Política de Privacidade</button>
                        </div>
                    </div>
                </form>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {view === 'forgot' && (
                <form key="forgot-form" onSubmit={handleForgotSubmit} className="space-y-4 animate-slide-up">
                    <p className="text-xs text-zinc-400 text-center mb-4">
                        Digite seu e-mail cadastrado para receber um link de redefinição de senha.
                    </p>

                    <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">E-mail Cadastrado</label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-3 top-3 text-zinc-600" />
                            <input 
                                type="email" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)}
                                placeholder="seu@email.com" 
                                className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-xl py-2.5 pl-9 pr-3 outline-none transition-colors text-sm"
                            />
                        </div>
                    </div>

                    {successMsg && <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs text-center animate-fade-in">{successMsg}</div>}
                    {errorMsg && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs text-center animate-fade-in">{errorMsg}</div>}

                    <button 
                        type="submit"
                        disabled={localLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-2"
                    >
                        {localLoading ? <Loader2 className="animate-spin" size={18} /> : <>Enviar Link <KeyRound size={18} /></>}
                    </button>

                    <button 
                        type="button" 
                        onClick={() => setView('login')}
                        className="w-full mt-2 text-zinc-400 hover:text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                        <ArrowLeft size={14}/> Voltar para Login
                    </button>
                </form>
            )}

            {/* REGISTER VIEW */}
            {view === 'register' && (
                <form key="register-form" onSubmit={handleRegisterSubmit} className="space-y-3 animate-slide-up">
                    <div className="bg-blue-900/10 p-3 rounded-lg border border-blue-900/30 mb-2">
                        <p className="text-[10px] text-blue-300 leading-tight text-center">
                            Você pode participar de vários ministérios com a mesma conta.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">Nome Completo</label>
                        <input 
                            value={regName} 
                            onChange={e => setRegName(e.target.value)}
                            placeholder="Ex: João Silva" 
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-lg py-2 px-3 text-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">E-mail</label>
                        <input 
                            type="email"
                            value={regEmail} 
                            onChange={e => setRegEmail(e.target.value)}
                            placeholder="Ex: joao@gmail.com" 
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-lg py-2 px-3 text-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-zinc-500 font-bold flex items-center gap-1">
                            <Layers size={12}/> Ministérios (Selecione um ou mais)
                        </label>
                        <div className="grid grid-cols-1 gap-2 bg-zinc-950 border border-zinc-800 p-2 rounded-lg">
                            {MINISTRIES.map(m => {
                                const isSelected = regSelectedMinistries.includes(m.id);
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => toggleMinistry(m.id)}
                                        className={`flex items-center justify-between p-2 rounded-md border text-sm transition-all ${
                                            isSelected 
                                            ? 'bg-blue-900/20 border-blue-500 text-blue-100' 
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                        }`}
                                    >
                                        <span>{m.label}</span>
                                        {isSelected && <Check size={14} className="text-blue-500"/>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Seletor de Funções Dinâmico (Baseado no primeiro ministério selecionado) */}
                    {regSelectedMinistries.length > 0 && (
                        <div className="space-y-1 animate-fade-in">
                            <label className="text-[10px] uppercase text-zinc-500 font-bold flex justify-between">
                                Suas Funções (Principal)
                                {loadingRoles && <Loader2 size={12} className="animate-spin text-blue-500"/>}
                            </label>
                            
                            {availableRoles.length > 0 ? (
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {availableRoles.map(role => {
                                        const isSelected = regSelectedRoles.includes(role);
                                        return (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => toggleRole(role)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                                    isSelected 
                                                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/20' 
                                                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                                                }`}
                                            >
                                                {role}
                                                {isSelected && <Check size={12} />}
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-xs text-zinc-500 italic p-2">Nenhuma função configurada para esta equipe.</div>
                            )}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">Senha</label>
                        <input 
                            type="password"
                            value={regPassword} 
                            onChange={e => setRegPassword(e.target.value)}
                            placeholder="Crie uma senha forte" 
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-lg py-2 px-3 text-sm"
                        />
                    </div>

                    {errorMsg && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs text-center animate-fade-in">{errorMsg}</div>}

                    <div className="flex gap-2 mt-4">
                        <button type="button" onClick={() => setView('login')} className="p-3 bg-zinc-800 text-zinc-400 rounded-xl hover:text-white"><ArrowLeft size={18}/></button>
                        <button type="submit" disabled={localLoading} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center">
                            {localLoading ? <Loader2 className="animate-spin"/> : 'Finalizar Cadastro'}
                        </button>
                    </div>
                    
                    <div className="text-center mt-3">
                        <p className="text-[10px] text-zinc-500">
                            Ao se cadastrar, você concorda com nossos <br/>
                            <button type="button" onClick={() => setLegalDoc('terms')} className="text-blue-500 hover:underline">Termos de Uso</button>
                            {' e '}
                            <button type="button" onClick={() => setLegalDoc('privacy')} className="text-blue-500 hover:underline">Política de Privacidade</button>.
                        </p>
                    </div>
                </form>
            )}

            </div>

        </div>
      </div>
    </div>
  );
};