
import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck, UserPlus, ArrowLeft, Check, ChevronDown, HelpCircle, KeyRound } from 'lucide-react';
import { loginWithEmail, registerWithEmail, loadData, sendPasswordResetEmail } from '../services/supabaseService';
import { User } from '../types';
import { LegalModal, LegalDocType } from './LegalDocuments';

interface Props {
  onLoginSuccess?: () => void; // Apenas para trigger visual, o App.tsx gerencia o estado real via onAuthStateChange
  isLoading?: boolean;
}

// Configuração dos Ministérios Disponíveis
const MINISTRIES = [
  { id: 'midia', label: 'Mídia / Comunicação' },
  { id: 'louvor', label: 'Louvor / Adoração' }
];

// Configuração Padrão das Funções por Ministério
// OBS: O sistema tentará carregar funções atualizadas do banco de dados se existirem
const DEFAULT_ROLES: Record<string, string[]> = {
  'midia': ['Projeção', 'Transmissão', 'Fotografia', 'Storys'],
  'louvor': ['Ministro', 'Vocal', 'Guitarra', 'Baixo', 'Teclado', 'Bateria', 'Dança', 'Mesa de Som']
};

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
  const [regMinistryId, setRegMinistryId] = useState(""); // Stores the ID (e.g., 'midia')
  const [regSelectedRoles, setRegSelectedRoles] = useState<string[]>([]);
  
  // Dynamic Roles State
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  
  // UI State
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Legal Modal State
  const [legalDoc, setLegalDoc] = useState<LegalDocType>(null);

  // Effect to load dynamic roles when ministry changes
  useEffect(() => {
    async function fetchDynamicRoles() {
        if (!regMinistryId) {
            setAvailableRoles([]);
            return;
        }

        setLoadingRoles(true);
        const defaults = DEFAULT_ROLES[regMinistryId] || [];
        
        // Define as padrão imediatamente para não deixar o usuário esperando
        setAvailableRoles(defaults);
        setRegSelectedRoles([]); // Limpa seleção anterior

        try {
            // Tenta buscar configurações salvas no banco (caso o admin tenha criado novas funções)
            // Se falhar ou não tiver internet, mantém os defaults
            const dynamicRoles = await loadData<string[]>(regMinistryId, 'functions_config', defaults);
            
            // Atualiza apenas se houver diferença
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
  }, [regMinistryId, view]);

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
    // Se sucesso, o listener no App.tsx vai pegar a sessão e mudar a tela automaticamente
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regName || !regEmail || !regPassword || !regMinistryId) {
          setErrorMsg("Preencha todos os campos obrigatórios.");
          return;
      }
      
      setLocalLoading(true);
      setErrorMsg("");
      
      // O ID do ministério é CRUCIAL para manter os dados antigos
      const result = await registerWithEmail(regEmail, regPassword, regName, regMinistryId, undefined, regSelectedRoles);
      
      if (result.success) {
          setSuccessMsg(result.message);
          setTimeout(() => {
             // Auto preencher login
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
      setSuccessMsg("");

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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden font-sans">
      <LegalModal isOpen={!!legalDoc} type={legalDoc} onClose={() => setLegalDoc(null)} />

      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="z-10 w-full max-w-sm p-6 overflow-y-auto max-h-screen custom-scrollbar">
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl p-8 transition-all">
          
          <div className="text-center mb-6">
             <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
               <ShieldCheck size={32} className="text-white" />
             </div>
             
             <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">
                Gestão de Escala OBPC <span className="text-blue-400 bg-blue-400/10 px-1 rounded">v2.0</span>
             </h2>

             <h1 className="text-xl font-bold text-white tracking-tight">
                {view === 'login' && 'Entrar no Sistema'}
                {view === 'register' && 'Criar Nova Conta'}
                {view === 'forgot' && 'Recuperar Senha'}
             </h1>
          </div>

          {/* LOGIN VIEW */}
          {view === 'login' && (
            <>
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
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-xl py-2.5 pl-9 pr-3 outline-none transition-colors text-sm"
                     />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">Senha</label>
                    <button 
                        type="button" 
                        onClick={() => { setErrorMsg(""); setSuccessMsg(""); setView('forgot'); }}
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

                {successMsg && <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs text-center">{successMsg}</div>}
                {errorMsg && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs text-center">{errorMsg}</div>}

                <button 
                  type="submit"
                  disabled={localLoading || isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-2"
                >
                  {localLoading ? <Loader2 className="animate-spin" size={18} /> : <>Entrar <ArrowRight size={18} /></>}
                </button>
              </form>
              
              <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
                  <button 
                    onClick={() => { setErrorMsg(""); setView('register'); }}
                    className="text-zinc-400 hover:text-white text-xs font-medium flex items-center justify-center gap-1 mx-auto transition-colors"
                  >
                      <UserPlus size={14}/> Não tem conta? Criar agora
                  </button>
              </div>
            </>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {view === 'forgot' && (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
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

                  {successMsg && <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs text-center">{successMsg}</div>}
                  {errorMsg && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs text-center">{errorMsg}</div>}

                  <button 
                    type="submit"
                    disabled={localLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-2"
                  >
                    {localLoading ? <Loader2 className="animate-spin" size={18} /> : <>Enviar Link <KeyRound size={18} /></>}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => { setErrorMsg(""); setSuccessMsg(""); setView('login'); }}
                    className="w-full mt-2 text-zinc-400 hover:text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                      <ArrowLeft size={14}/> Voltar para Login
                  </button>
              </form>
          )}

          {/* REGISTER VIEW */}
          {view === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div className="bg-blue-900/10 p-3 rounded-lg border border-blue-900/30 mb-2">
                      <p className="text-[10px] text-blue-300 leading-tight text-center">
                        Selecione o ministério correto para sincronizar com a equipe certa.
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
                      <label className="text-[10px] uppercase text-zinc-500 font-bold">Ministério (Equipe)</label>
                      <div className="relative">
                        <select
                          value={regMinistryId}
                          onChange={(e) => {
                            setRegMinistryId(e.target.value);
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-lg py-2 px-3 text-sm appearance-none outline-none"
                        >
                          <option value="">Selecione a equipe...</option>
                          {MINISTRIES.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                      </div>
                  </div>

                  {/* Seletor de Funções Dinâmico */}
                  {regMinistryId && (
                    <div className="space-y-1 animate-fade-in">
                       <label className="text-[10px] uppercase text-zinc-500 font-bold flex justify-between">
                         Suas Funções
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

                  {errorMsg && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs text-center">{errorMsg}</div>}

                  <div className="flex gap-2 mt-4">
                      <button type="button" onClick={() => setView('login')} className="p-3 bg-zinc-800 text-zinc-400 rounded-xl hover:text-white"><ArrowLeft size={18}/></button>
                      <button type="submit" disabled={localLoading} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center">
                          {localLoading ? <Loader2 className="animate-spin"/> : 'Finalizar Cadastro'}
                      </button>
                  </div>
                  
                  {/* Links de Termos */}
                  <div className="text-center mt-3">
                      <p className="text-[10px] text-zinc-500">
                          Ao se cadastrar, você concorda com nossos <br/>
                          <button onClick={() => setLegalDoc('terms')} className="text-blue-500 hover:underline">Termos de Uso</button>
                          {' e '}
                          <button onClick={() => setLegalDoc('privacy')} className="text-blue-500 hover:underline">Política de Privacidade</button>.
                      </p>
                  </div>
              </form>
          )}

        </div>
      </div>
    </div>
  );
};
