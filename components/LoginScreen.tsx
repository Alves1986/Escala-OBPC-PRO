
import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, User, Lock, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import { authenticateUser } from '../services/supabaseService';

interface Props {
  onLogin: (id: string) => void;
  isLoading?: boolean;
}

export const LoginScreen: React.FC<Props> = ({ onLogin, isLoading = false }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [recentLogins, setRecentLogins] = useState<string[]>([]);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('escala_recent_logins');
      if (stored) {
        setRecentLogins(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Erro ao ler logins recentes", e);
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLocalLoading(true);
    setErrorMsg("");

    try {
      // Limpa o username para evitar espaços extras e garantir formato de ID
      const cleanId = username.trim().toLowerCase().replace(/\s+/g, '-');
      
      const result = await authenticateUser(cleanId, password);

      if (result.success) {
        // Sucesso: Salvar nos recentes e prosseguir
        const newRecents = [cleanId, ...recentLogins.filter(r => r !== cleanId)].slice(0, 3);
        localStorage.setItem('escala_recent_logins', JSON.stringify(newRecents));
        
        onLogin(cleanId);
      } else {
        // Falha
        setErrorMsg(result.message);
        setLocalLoading(false);
      }
    } catch (err) {
      setErrorMsg("Erro inesperado. Tente novamente.");
      setLocalLoading(false);
    }
  };

  const removeRecent = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRecents = recentLogins.filter(id => id !== idToRemove);
    setRecentLogins(newRecents);
    localStorage.setItem('escala_recent_logins', JSON.stringify(newRecents));
  };

  const selectRecent = (id: string) => {
    setUsername(id);
    // Foca no campo de senha (simulado visualmente, o usuário deve digitar)
    document.getElementById('password-input')?.focus();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="z-10 w-full max-w-sm p-6">
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl p-8 transform transition-all">
          
          {/* Logo / Header */}
          <div className="text-center mb-8">
            <div className="relative inline-block">
              {imgError ? (
                 <div className="w-20 h-20 mb-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                   <ShieldCheck size={40} className="text-white" />
                 </div>
              ) : (
                <img 
                  src="/app-icon.png" 
                  alt="Logo" 
                  className="w-20 h-20 mb-4 rounded-2xl shadow-lg shadow-blue-500/20"
                  onError={() => setImgError(true)}
                />
              )}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Bem-vindo</h1>
            <p className="text-zinc-500 text-sm mt-1">Faça login para gerenciar a escala</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            {/* Username Field */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 ml-1">Usuário</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-zinc-500" />
                </div>
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Seu ID de Ministério" 
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-xl py-3 pl-10 pr-4 outline-none transition-colors placeholder:text-zinc-700 text-sm"
                  autoCapitalize="none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-zinc-500" />
                </div>
                <input 
                  id="password-input"
                  type={showPassword ? "text" : "password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Sua senha" 
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-600 text-white rounded-xl py-3 pl-10 pr-10 outline-none transition-colors placeholder:text-zinc-700 text-sm"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center animate-pulse">
                {errorMsg}
              </div>
            )}

            {/* Warning for new users */}
            {!errorMsg && !localLoading && username && password.length > 0 && (
              <p className="text-[10px] text-zinc-600 text-center px-2">
                Se for seu primeiro acesso com este usuário, a senha digitada será salva como sua nova senha.
              </p>
            )}

            <button 
              type="submit"
              disabled={localLoading || isLoading || !username || !password}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {localLoading || isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Entrar
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Saved Accounts */}
          {recentLogins.length > 0 && (
            <div className="mt-8 pt-6 border-t border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 mb-3 text-center">Contas Salvas</p>
              <div className="space-y-2">
                {recentLogins.map(id => (
                  <div 
                    key={id} 
                    onClick={() => selectRecent(id)}
                    className={`group flex items-center justify-between p-2 rounded-lg border border-transparent cursor-pointer transition-all ${username === id ? 'bg-blue-900/20 border-blue-800' : 'bg-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 font-bold text-xs border border-zinc-800">
                        {id.substring(0, 1).toUpperCase()}
                      </div>
                      <span className={`text-sm font-medium ${username === id ? 'text-blue-400' : 'text-zinc-300'}`}>{id}</span>
                    </div>
                    <button 
                      onClick={(e) => removeRecent(id, e)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      title="Remover conta salva"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
