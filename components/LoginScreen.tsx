
import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, User as UserIcon, Lock, Eye, EyeOff, ShieldCheck, X, UserPlus, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authenticateUser, getMinistryRoles, registerMember } from '../services/supabaseService';
import { User } from '../types';

interface Props {
  onLogin: (id: string, user: User) => void;
  isLoading?: boolean;
}

export const LoginScreen: React.FC<Props> = ({ onLogin, isLoading = false }) => {
  const [view, setView] = useState<'login' | 'register-step-1' | 'register-step-2'>('login');
  
  // Login State
  const [ministryId, setMinistryId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [recentLogins, setRecentLogins] = useState<{mid: string, user: string}[]>([]);
  
  // Register State
  const [regMinistryId, setRegMinistryId] = useState("");
  const [regName, setRegName] = useState("");
  const [regWhatsapp, setRegWhatsapp] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  
  // UI State
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('escala_recent_logins_v2');
      if (stored) {
        setRecentLogins(JSON.parse(stored));
      }
    } catch (e) { console.error(e); }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministryId || !username || !password) return;

    setLocalLoading(true);
    setErrorMsg("");

    try {
      const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
      const cleanUser = username.trim().toLowerCase();
      
      const result = await authenticateUser(cleanMid, cleanUser, password);

      if (result.success && result.user) {
        // Save recent
        const newRecent = { mid: cleanMid, user: cleanUser };
        const updatedRecents = [newRecent, ...recentLogins.filter(r => r.mid !== cleanMid || r.user !== cleanUser)].slice(0, 3);
        localStorage.setItem('escala_recent_logins_v2', JSON.stringify(updatedRecents));
        
        onLogin(cleanMid, result.user);
      } else {
        setErrorMsg(result.message);
        setLocalLoading(false);
      }
    } catch (err) {
      setErrorMsg("Erro inesperado.");
      setLocalLoading(false);
    }
  };

  const handleVerifyMinistry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regMinistryId) return;
    
    setLocalLoading(true);
    setErrorMsg("");
    
    const cleanMid = regMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
    const roles = await getMinistryRoles(cleanMid);
    
    if (roles) {
        setAvailableRoles(roles);
        setRegMinistryId(cleanMid);
        setView('register-step-2');
    } else {
        setErrorMsg("Ministério não encontrado. Verifique o ID com seu líder.");
    }
    setLocalLoading(false);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regName || !regPassword || selectedRoles.length === 0) {
          setErrorMsg("Preencha nome, senha e selecione ao menos uma função.");
          return;
      }
      
      setLocalLoading(true);
      
      const result = await registerMember(regMinistryId, regName, regWhatsapp, regPassword, selectedRoles);
      
      if (result.success) {
          setSuccessMsg(result.message);
          setTimeout(() => {
             // Auto fill login
             setMinistryId(regMinistryId);
             setUsername(result.message.split(': ')[1]); // Extract generated username from message
             setPassword(regPassword);
             setView('login');
             setSuccessMsg("");
             setErrorMsg(""); // Clear any previous errors
          }, 3000);
      } else {
          setErrorMsg(result.message);
      }
      setLocalLoading(false);
  };

  const removeRecent = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRecents = [...recentLogins];
    newRecents.splice(idx, 1);
    setRecentLogins(newRecents);
    localStorage.setItem('escala_recent_logins_v2', JSON.stringify(newRecents));
  };

  const selectRecent = (mid: string, user: string) => {
    setMinistryId(mid);
    setUsername(user);
    document.getElementById('password-input')?.focus();
  };

  const toggleRole = (role: string) => {
      if (selectedRoles.includes(role)) {
          setSelectedRoles(selectedRoles.filter(r => r !== role));
      } else {
          setSelectedRoles([...selectedRoles, role]);
      }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden font-sans">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="z-10 w-full max-w-sm p-6">
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl p-8 transition-all">
          
          {/* Header */}
          <div className="text-center mb-6">
            <div className="relative inline-block">
              {imgError ? (
                 <div className="w-16 h-16 mb-2 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                   <ShieldCheck size={32} className="text-white" />
                 </div>
              ) : (
                <img 
                  src="/app-icon.png" 
                  alt="Logo" 
                  className="w-16 h-16 mb-2 rounded-2xl shadow-lg shadow-blue-500/20"
                  onError={() => setImgError(true)}
                />
              )}
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
                {view === 'login' ? 'Bem-vindo' : 'Criar Conta'}
            </h1>
          </div>

          {/* VIEW: LOGIN */}
          {view === 'login' && (
            <>
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                
                {/* Ministry ID */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">ID Ministério</label>
                  <input 
                    type="text" 
                    value={ministryId} 
                    onChange={e => setMinistryId(e.target.value)}
                    placeholder="Ex: midia-sede" 
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-xl py-2.5 px-3 outline-none transition-colors text-sm"
                    autoCapitalize="none"
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">Usuário</label>
                  <div className="relative">
                     <UserIcon size={16} className="absolute left-3 top-3 text-zinc-600" />
                     <input 
                        type="text" 
                        value={username} 
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Seu usuário" 
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-xl py-2.5 pl-9 pr-3 outline-none transition-colors text-sm"
                        autoCapitalize="none"
                     />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">Senha</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-zinc-600" />
                    <input 
                      id="password-input"
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••" 
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

                {/* Messages */}
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
              
              <div className="mt-4 pt-4 border-t border-zinc-800 text-center">
                  <button 
                    onClick={() => { setErrorMsg(""); setView('register-step-1'); }}
                    className="text-zinc-400 hover:text-white text-xs font-medium flex items-center justify-center gap-1 mx-auto transition-colors"
                  >
                      <UserPlus size={14}/> Quero me cadastrar na equipe
                  </button>
              </div>
              
              {/* Recents */}
              {recentLogins.length > 0 && (
                <div className="mt-6">
                   <p className="text-[10px] font-bold text-zinc-600 uppercase mb-2">Recentes</p>
                   <div className="space-y-2">
                      {recentLogins.map((rec, idx) => (
                         <div key={idx} onClick={() => selectRecent(rec.mid, rec.user)} className="flex justify-between items-center p-2 rounded bg-zinc-800/40 hover:bg-zinc-800 cursor-pointer border border-transparent hover:border-zinc-700 transition-all">
                            <div className="flex flex-col">
                               <span className="text-xs text-zinc-300 font-bold">{rec.user}</span>
                               <span className="text-[10px] text-zinc-500">{rec.mid}</span>
                            </div>
                            <button onClick={(e) => removeRecent(idx, e)} className="text-zinc-600 hover:text-red-400"><X size={14}/></button>
                         </div>
                      ))}
                   </div>
                </div>
              )}
            </>
          )}

          {/* VIEW: REGISTER STEP 1 (Ministry) */}
          {view === 'register-step-1' && (
              <form onSubmit={handleVerifyMinistry} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500">Qual o ID do Ministério?</label>
                    <input 
                        type="text" 
                        value={regMinistryId} 
                        onChange={e => setRegMinistryId(e.target.value)}
                        placeholder="Ex: midia-sede"
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-xl py-3 px-4 outline-none text-sm"
                    />
                    <p className="text-[10px] text-zinc-600">Peça este ID ao seu líder de mídia.</p>
                  </div>
                  
                  {errorMsg && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs text-center">{errorMsg}</div>}

                  <div className="flex gap-2">
                      <button type="button" onClick={() => setView('login')} className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-xl text-sm font-medium hover:text-white">Voltar</button>
                      <button type="submit" disabled={localLoading} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl text-sm font-bold flex justify-center items-center">
                          {localLoading ? <Loader2 className="animate-spin"/> : 'Continuar'}
                      </button>
                  </div>
              </form>
          )}

          {/* VIEW: REGISTER STEP 2 (Details) */}
          {view === 'register-step-2' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div className="bg-blue-900/20 p-2 rounded border border-blue-900/50 mb-2">
                      <p className="text-[10px] text-blue-300 text-center">Cadastrando em: <strong>{regMinistryId}</strong></p>
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
                      <label className="text-[10px] uppercase text-zinc-500 font-bold">WhatsApp (Opcional)</label>
                      <input 
                        value={regWhatsapp} 
                        onChange={e => setRegWhatsapp(e.target.value)}
                        placeholder="Ex: 11999999999" 
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-lg py-2 px-3 text-sm"
                      />
                  </div>

                  <div className="space-y-1">
                      <label className="text-[10px] uppercase text-zinc-500 font-bold">Senha de Acesso</label>
                      <input 
                        type="password"
                        value={regPassword} 
                        onChange={e => setRegPassword(e.target.value)}
                        placeholder="Crie uma senha" 
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-lg py-2 px-3 text-sm"
                      />
                  </div>

                  <div className="space-y-2 pt-1">
                      <label className="text-[10px] uppercase text-zinc-500 font-bold">Quais funções você exerce?</label>
                      <div className="grid grid-cols-2 gap-2">
                          {availableRoles.map(role => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => toggleRole(role)}
                                className={`text-xs py-2 px-2 rounded border transition-all ${selectedRoles.includes(role) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                              >
                                  {role}
                              </button>
                          ))}
                      </div>
                  </div>

                  {successMsg && <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs text-center flex items-center justify-center gap-1"><CheckCircle2 size={12}/> {successMsg}</div>}
                  {errorMsg && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs text-center">{errorMsg}</div>}

                  <div className="flex gap-2 mt-2">
                      <button type="button" onClick={() => setView('login')} className="p-3 bg-zinc-800 text-zinc-400 rounded-xl hover:text-white"><ArrowLeft size={18}/></button>
                      <button type="submit" disabled={localLoading || !!successMsg} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center">
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
