
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, UserPlus, ArrowLeft, Check, ChevronDown, KeyRound, Layers } from 'lucide-react';
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
            const settings = await fetchMinistrySettings(mainMinistry);
            const dynamicRoles = settings.roles;
            if (dynamicRoles && dynamicRoles.length > 0) {
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

    // Trim inputs to avoid space errors
    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    const result = await loginWithEmail(cleanEmail, cleanPass);

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
    // Se sucesso, o redirect acontece e o loading fica até a página recarregar
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regName || !regEmail || !regPassword || regSelectedMinistries.length === 0) {
          setErrorMsg("Preencha todos os campos e selecione ao menos um ministério.");
          return;
      }
      
      setLocalLoading(true);
      setErrorMsg("");
      
      const cleanEmail = regEmail.trim();
      const cleanPass = regPassword.trim();
      const cleanName = regName.trim();

      const result = await registerWithEmail(cleanEmail, cleanPass, cleanName, regSelectedMinistries, undefined, regSelectedRoles);
      
      if (result.success) {
          setSuccessMsg(result.message);
          setTimeout(() => {
             setEmail(cleanEmail);
             setPassword(""); // Don't autofill password for security/UX
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

      const result = await sendPasswordResetEmail(email.trim());
      
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
                <div key="login-form" className="space-y-4 animate-slide-up">
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">E-mail</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-3 text-zinc-600" />
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="seu@email.com" 
                                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-600 text-white rounded-xl py-2.5 pl-9 pr-3 outline-none transition-colors text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">Senha</label>
                                <button 
                                    type="button" 
                                    onClick={() => setView('forgot')}
                                    className="text-[10px] text-teal-500 hover:text-teal-400 font-bold"
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
                                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-600 text-white rounded-xl py-2.5 pl-9 pr-10 outline-none transition-colors text-sm"
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
                            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 mt-2"
                        >
                            {localLoading ? <Loader2 className="animate-spin" size={18} /> : <>Entrar <ArrowRight size={18} /></>}
                        </button>
                    </form>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-zinc-800"></div>
                        <span className="flex-shrink-0 mx-4 text-zinc-600 text-[10px] font-bold uppercase">Ou continue com</span>
                        <div className="flex-grow border-t border-zinc-800"></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={localLoading || isLoading}
                        className="w-full bg-white hover:bg-zinc-100 text-zinc-800 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Google
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
                </div>
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
                                className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-600 text-white rounded-xl py-2.5 pl-9 pr-3 outline-none transition-colors text-sm"
                            />
                        </div>
                    </div>

                    {successMsg && <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs text-center animate-fade-in">{successMsg}</div>}
                    {errorMsg && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs text-center animate-fade-in">{errorMsg}</div>}

                    <button 
                        type="submit"
                        disabled={localLoading}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 mt-2"
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
                    <div className="bg-teal-900/10 p-3 rounded-lg border border-teal-900/30 mb-2">
                        <p className="text-[10px] text-teal-300 leading-tight text-center">
                            Você pode participar de vários ministérios com a mesma conta.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">Nome Completo</label>
                        <input 
                            value={regName} 
                            onChange={e => setRegName(e.target.value)}
                            placeholder="Ex: João Silva" 
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-600 text-white rounded-lg py-2 px-3 text-sm"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] uppercase text-zinc-500 font-bold">E-mail</label>
                        <input 
                            type="email"
                            value={regEmail} 
                            onChange={e => setRegEmail(e.target.value)}
                            placeholder="Ex: joao@gmail.com" 
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-600 text-white rounded-lg py-2 px-3 text-sm"
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
                                            ? 'bg-teal-900/20 border-teal-500 text-teal-100' 
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                                        }`}
                                    >
                                        <span>{m.label}</span>
                                        {isSelected && <Check size={14} className="text-teal-500"/>}
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
                                {loadingRoles && <Loader2 size={12} className="animate-spin text-teal-500"/>}
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
                                                    ? 'bg-teal-600 text-white border-teal-500 shadow-md shadow-teal-900/20' 
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
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-teal-600 text-white rounded-lg py-2 px-3 text-sm"
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
                            <button type="button" onClick={() => setLegalDoc('terms')} className="text-teal-500 hover:underline">Termos de Uso</button>
                            {' e '}
                            <button type="button" onClick={() => setLegalDoc('privacy')} className="text-teal-500 hover:underline">Política de Privacidade</button>.
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
