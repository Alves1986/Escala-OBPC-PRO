
import React, { useState } from 'react';
import { Save, Database, Key, AlertCircle, RefreshCw, Power, Eye, Layout } from 'lucide-react';

export const SetupScreen = () => {
  const [url, setUrl] = useState(localStorage.getItem('VITE_SUPABASE_URL') || '');
  const [key, setKey] = useState(localStorage.getItem('VITE_SUPABASE_KEY') || '');
  const [error, setError] = useState('');
  const [isReloading, setIsReloading] = useState(false);

  const handleSave = () => {
    if (!url.startsWith('https://')) {
        setError('A URL deve começar com https://');
        return;
    }
    if (key.length < 20) {
        setError('A chave parece inválida (muito curta).');
        return;
    }

    localStorage.setItem('VITE_SUPABASE_URL', url.trim());
    localStorage.setItem('VITE_SUPABASE_KEY', key.trim());
    handleReload();
  };

  const handlePreviewMode = () => {
      // Define credenciais especiais que ativam o mock no service
      localStorage.setItem('VITE_SUPABASE_URL', 'https://preview.mode');
      localStorage.setItem('VITE_SUPABASE_KEY', 'demo-mode-key-1234567890');
      handleReload();
  };

  const handleReload = () => {
      setIsReloading(true);
      setTimeout(() => {
          window.location.reload();
      }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4 font-sans">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl animate-fade-in relative overflow-hidden">
        
        {/* Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-teal-500/50 blur-[20px]"></div>

        <div className="flex justify-center mb-6">
           <div className="p-4 bg-zinc-800 rounded-2xl border border-zinc-700 shadow-inner">
             <Power size={32} className={isReloading ? "text-teal-500 animate-pulse" : "text-zinc-500"} />
           </div>
        </div>
        
        <h1 className="text-xl font-bold text-center mb-2 text-white">Inicialização do Sistema</h1>
        <p className="text-zinc-500 text-center text-xs mb-6 px-4">
            Aguardando configuração de ambiente para conectar ao banco de dados.
        </p>
        
        <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-xl mb-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wide">
                <Database size={12}/> Status do Ambiente (.env)
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed">
                As variáveis <code>VITE_SUPABASE_URL</code> e <code>KEY</code> não foram detectadas. Se você já criou o arquivo <strong>.env</strong>, clique em recarregar abaixo.
            </p>
            <button 
                onClick={handleReload}
                className="mt-2 w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border border-blue-500/20"
            >
                <RefreshCw size={12} className={isReloading ? "animate-spin" : ""}/> 
                {isReloading ? 'Reiniciando...' : 'Recarregar Sistema'}
            </button>
        </div>

        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="flex-shrink-0 mx-4 text-zinc-600 text-[10px] font-bold uppercase">Ou configure manualmente</span>
            <div className="flex-grow border-t border-zinc-800"></div>
        </div>

        <div className="space-y-4 mt-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Project URL</label>
            <div className="relative group">
                <Database size={16} className="absolute left-3 top-3.5 text-zinc-600 group-focus-within:text-teal-500 transition-colors"/>
                <input 
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError(''); }}
                  placeholder="https://seu-projeto.supabase.co"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-3 text-sm focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none transition-all text-zinc-300 placeholder:text-zinc-700"
                />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Anon Key</label>
            <div className="relative group">
                <Key size={16} className="absolute left-3 top-3.5 text-zinc-600 group-focus-within:text-teal-500 transition-colors"/>
                <input 
                  value={key}
                  onChange={e => { setKey(e.target.value); setError(''); }}
                  placeholder="eyJxhbGciOiJIUzI1NiIsInR5cCI..."
                  type="password"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-3 text-sm focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none transition-all text-zinc-300 placeholder:text-zinc-700"
                />
            </div>
          </div>

          {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/10 p-3 rounded-lg border border-red-900/30">
                  <AlertCircle size={14} /> {error}
              </div>
          )}

          <button 
            onClick={handleSave}
            disabled={!url || !key}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all mt-2 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/10 active:scale-95"
          >
            <Save size={18}/> Salvar e Conectar
          </button>

          <div className="pt-2 border-t border-zinc-800 mt-2">
             <button 
                onClick={handlePreviewMode}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs border border-zinc-700"
             >
                <Eye size={16}/> Entrar em Modo Visualização (Demo)
             </button>
             <p className="text-[10px] text-zinc-600 text-center mt-2">
                 Permite testar a interface com dados fictícios sem conexão com banco.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
