
import React, { useState } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck, UserPlus, ArrowLeft, CheckCircle2, ChevronDown, Check } from 'lucide-react';
import { loginWithEmail, registerWithEmail } from '../services/supabaseService';
import { User } from '../types';

interface Props {
  onLoginSuccess?: () => void; // Apenas para trigger visual, o App.tsx gerencia o estado real via onAuthStateChange
  isLoading?: boolean;
}

// Configuração dos Ministérios Disponíveis
const MINISTRIES = [
  { id: 'midia', label: 'Mídia / Projeção' },
  { id: 'louvor', label: 'Louvor / Banda' },
  { id: 'infantil', label: 'Ministério Infantil' },
  { id: 'diaconia', label: 'Diaconia / Recepção' },
  { id: 'teatro', label: 'Teatro / Artes' }
];

// Configuração das Funções por Ministério
const ROLES_BY_MINISTRY: Record<string, string[]> = {
  'midia': ['Projeção', 'Transmissão', 'Fotografia', 'Storys', 'Som', 'Iluminação', 'Design'],
  'louvor': ['Vocal', 'Violão', 'Teclado', 'Bateria', 'Baixo', 'Guitarra', 'Sax', 'Violino'],
  'infantil': ['Professor(a)', 'Monitor(a)', 'Apoio', 'Berçário'],
  'diaconia': ['Recepção', 'Portaria', 'Estacionamento', 'Ceia'],
  'teatro': ['Ator/Atriz', 'Roteiro', 'Figurino', 'Maquiagem']
};

export const LoginScreen: React.FC<Props> = ({ isLoading = false }) => {
  const [view, setView] = useState<'login' | 'register'>('login');
  
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
  
  // UI State
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

  const toggleRole = (role: string) => {
    if (regSelectedRoles.includes(role)) {
      setRegSelectedRoles(regSelectedRoles.filter(r => r !== role));
    } else {
      setRegSelectedRoles([...regSelectedRoles, role]);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden font-sans">
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
             <h1 className="text-xl font-bold text-white tracking-tight">
                {view === 'login' ? 'Entrar no Sistema' : 'Criar Nova Conta'}
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
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">Senha</label>
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
                      <label className="text-[10px] uppercase text-zinc-500 font-bold">ID do Ministério (Equipe)</label>
                      <div className="relative">
                        <select
                          value={regMinistryId}
                          onChange={(e) => {
                            setRegMinistryId(e.target.value);
                            setRegSelectedRoles([]); // Limpa as funções ao mudar o ministério
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

                  {/* Seletor de Funções (Aparece apenas quando o ministério é selecionado) */}
                  {regMinistryId && ROLES_BY_MINISTRY[regMinistryId] && (
                    <div className="space-y-1 animate-fade-in">
                       <label className="text-[10px] uppercase text-zinc-500 font-bold">Suas Funções (Selecione 1 ou mais)</label>
                       <div className="flex flex-wrap gap-2 mt-1">
                          {ROLES_BY_MINISTRY[regMinistryId].map(role => {
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
              </form>
          )}

        </div>
      </div>
    </div>
  );
};
