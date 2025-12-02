
import React, { useState, useEffect } from 'react';
import { ArrowRight, History, Loader2, X, User } from 'lucide-react';

interface Props {
  onLogin: (id: string) => void;
  isLoading?: boolean;
}

export const LoginScreen: React.FC<Props> = ({ onLogin, isLoading = false }) => {
  const [input, setInput] = useState("");
  const [recentLogins, setRecentLogins] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);

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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input || input.length < 3) return;
    
    // Save to recents
    const newRecents = [input, ...recentLogins.filter(r => r !== input)].slice(0, 3);
    localStorage.setItem('escala_recent_logins', JSON.stringify(newRecents));
    
    onLogin(input);
  };

  const removeRecent = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRecents = recentLogins.filter(id => id !== idToRemove);
    setRecentLogins(newRecents);
    localStorage.setItem('escala_recent_logins', JSON.stringify(newRecents));
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="z-10 w-full max-w-md p-6">
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-8 transform transition-all duration-500 hover:border-zinc-700">
          
          {/* Header */}
          <div className="text-center mb-8">
            <img 
              src="/app-icon.png" 
              alt="Logo Escala Mídia" 
              className="mx-auto w-24 h-24 mb-6 rounded-2xl shadow-2xl shadow-blue-900/20 hover:scale-105 transition-transform duration-300"
            />
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Escala Mídia Pro</h1>
            <p className="text-zinc-400 text-sm">Acesse o painel do seu ministério</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">ID do Ministério</label>
              <div className={`relative group transition-all duration-300 ${isFocused ? 'scale-[1.02]' : ''}`}>
                <input 
                  type="text" 
                  value={input} 
                  onChange={e => setInput(e.target.value.toLowerCase())}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="ex: midia-sede" 
                  className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl p-4 pl-12 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-zinc-600 shadow-inner"
                  autoFocus
                />
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isFocused ? 'text-blue-500' : 'text-zinc-600'}`} />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading || input.length < 3}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  Acessar Sistema
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Recent Logins */}
          {recentLogins.length > 0 && (
            <div className="mt-8 pt-6 border-t border-zinc-800/50 animate-slide-up">
              <div className="flex items-center gap-2 mb-3 text-zinc-500">
                <History size={14} />
                <span className="text-xs font-medium uppercase tracking-wider">Contas Recentes</span>
              </div>
              <div className="space-y-2">
                {recentLogins.map(id => (
                  <div 
                    key={id} 
                    onClick={() => { setInput(id); onLogin(id); }}
                    className="group flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 group-hover:text-blue-400 transition-colors font-bold text-xs">
                        {id.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-zinc-300 font-medium text-sm">{id}</span>
                    </div>
                    <button 
                      onClick={(e) => removeRecent(id, e)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <p className="text-center text-zinc-600 text-xs mt-6">
          &copy; {new Date().getFullYear()} Escala Mídia Pro. Conectado ao Supabase.
        </p>
      </div>
    </div>
  );
};
