
import React, { useState } from 'react';
import { Save, Database, Key, AlertCircle } from 'lucide-react';

export const SetupScreen = () => {
  const [url, setUrl] = useState(localStorage.getItem('VITE_SUPABASE_URL') || '');
  const [key, setKey] = useState(localStorage.getItem('VITE_SUPABASE_KEY') || '');
  const [error, setError] = useState('');

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
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white p-4 font-sans">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl animate-fade-in">
        <div className="flex justify-center mb-6">
           <div className="p-4 bg-teal-900/30 rounded-full text-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.2)]">
             <Database size={32} />
           </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-2">Configuração do Sistema</h1>
        <p className="text-zinc-400 text-center text-sm mb-8 leading-relaxed">
          Para iniciar, conecte-se ao seu projeto Supabase.<br/>
          Insira as credenciais da API abaixo.
        </p>

        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Supabase Project URL</label>
            <div className="relative group">
                <Database size={16} className="absolute left-3 top-3.5 text-zinc-600 group-focus-within:text-teal-500 transition-colors"/>
                <input 
                  value={url}
                  onChange={e => { setUrl(e.target.value); setError(''); }}
                  placeholder="https://seu-projeto.supabase.co"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-3 text-sm focus:ring-2 focus:ring-teal-600/50 focus:border-teal-600 outline-none transition-all text-zinc-200 placeholder:text-zinc-700"
                />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Supabase Anon Key</label>
            <div className="relative group">
                <Key size={16} className="absolute left-3 top-3.5 text-zinc-600 group-focus-within:text-teal-500 transition-colors"/>
                <input 
                  value={key}
                  onChange={e => { setKey(e.target.value); setError(''); }}
                  placeholder="eyJxhbGciOiJIUzI1NiIsInR5cCI..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-3 text-sm focus:ring-2 focus:ring-teal-600/50 focus:border-teal-600 outline-none transition-all text-zinc-200 placeholder:text-zinc-700"
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
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all mt-2 flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20 active:scale-95"
          >
            <Save size={18}/> Salvar e Conectar
          </button>
          
          <p className="text-center text-[10px] text-zinc-600 mt-4">
              Esses dados serão salvos localmente no seu navegador.
          </p>
        </div>
      </div>
    </div>
  );
};
