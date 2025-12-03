
import React, { useState } from 'react';
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck, UserPlus, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { loginWithEmail, registerWithEmail, sendPasswordResetEmail } from '../services/supabaseService';
import { User } from '../types';

interface Props {
  onLoginSuccess?: () => void; // Apenas para trigger visual, o App.tsx gerencia o estado real via onAuthStateChange
  isLoading?: boolean;
}

export const LoginScreen: React.FC<Props> = ({ isLoading = false }) => {
  const [view, setView] = useState<'login' | 'register' | 'forgot-password'>('login');
  
  // Login State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Register State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regMinistryId, setRegMinistryId] = useState("");

  // Forgot Password State
  const [resetEmail, setResetEmail] = useState("");
  
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
          setErrorMsg("Preencha todos os campos.");
          return;
      }
      
      setLocalLoading(true);
      setErrorMsg("");
      
      // O ID do ministério é CRUCIAL para manter os dados antigos
      const result = await registerWithEmail(regEmail, regPassword, regName, regMinistryId);
      
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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!resetEmail) {
          setErrorMsg("Digite seu e-mail.");
          return;
      }

      setLocalLoading(true);
      setErrorMsg("");
      setSuccessMsg("");

      const result = await sendPasswordResetEmail(resetEmail);

      if (result.success) {
          setSuccessMsg(result.message);
          // Opcional: voltar para login após alguns segundos
      } else {
          setErrorMsg(result.message);
      }
      setLocalLoading(false);
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
          
          <div className="text-center mb-6">
             <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
               {view === 'forgot-password' ? <KeyRound size={32} className="text-white"/> : <ShieldCheck size={32} className="text-white" />}
             </div>
             <h1 className="text-xl font-bold text-white tracking-tight">
                {view === 'login' && 'Entrar no Sistema'}
                {view === 'register' && 'Criar Nova Conta'}
                {view === 'forgot-password' && 'Recuperar Senha'}
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
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase">Senha</label>
                    <button type="button" onClick={() => { setErrorMsg(""); setView('forgot-password'); }} className="text-[10px] font-medium text-blue-400 hover:text-blue-300">Esqueceu?</button>
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

          {/* REGISTER VIEW */}
          {view === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div className="bg-blue-900/10 p-3 rounded-lg border border-blue-900/30 mb-2">
                      <p className="text-[10px] text-blue-300 leading-tight text-center">
                        <strong>Atenção:</strong> No campo "ID do Ministério", digite o mesmo código que você usava antes (ex: <em>midia-sede</em>) para recuperar seus dados antigos.
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
                      <label className="text-[10px] uppercase text-zinc-500 font-bold">ID do Ministério (Importante)</label>
                      <input 
                        value={regMinistryId} 
                        onChange={e => setRegMinistryId(e.target.value)}
                        placeholder="Ex: midia-sede" 
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-lg py-2 px-3 text-sm"
                      />
                  </div>

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

          {/* FORGOT PASSWORD VIEW */}
          {view === 'forgot-password' && (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-700 mb-2">
                      <p className="text-[10px] text-zinc-300 leading-tight text-center">
                        Digite o e-mail associado à sua conta para receber um link de redefinição de senha.
                      </p>
                  </div>

                  <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase ml-1">E-mail</label>
                      <div className="relative">
                          <Mail size={16} className="absolute left-3 top-3 text-zinc-600" />
                          <input 
                              type="email" 
                              value={resetEmail} 
                              onChange={e => setResetEmail(e.target.value)}
                              placeholder="seu@email.com" 
                              className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-xl py-2.5 pl-9 pr-3 outline-none transition-colors text-sm"
                          />
                      </div>
                  </div>

                  {successMsg && <div className="p-2 rounded bg-green-500/10 text-green-400 text-xs text-center">{successMsg}</div>}
                  {errorMsg && <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs text-center">{errorMsg}</div>}

                  <div className="flex gap-2 mt-4">
                      <button type="button" onClick={() => { setErrorMsg(""); setSuccessMsg(""); setView('login'); }} className="p-3 bg-zinc-800 text-zinc-400 rounded-xl hover:text-white"><ArrowLeft size={18}/></button>
                      <button type="submit" disabled={localLoading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center">
                          {localLoading ? <Loader2 className="animate-spin"/> : 'Enviar Link'}
                      </button>
                  </div>
              </form>
          )}

        </div>
      </div>
    </div>
  );
};