
import React, { useState } from 'react';
import { Megaphone, Send, Info, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import { AppNotification } from '../types';
import { useToast } from './Toast';

interface Props {
  onSend: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert') => Promise<void>;
}

export const AlertsManager: React.FC<Props> = ({ onSend }) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<'info' | 'success' | 'warning' | 'alert'>('info');
  const [isSending, setIsSending] = useState(false);
  const { addToast } = useToast();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      addToast("Preencha o título e a mensagem.", "error");
      return;
    }

    setIsSending(true);
    await onSend(title, message, type);
    setTitle("");
    setMessage("");
    setType('info');
    setIsSending(false);
    addToast("Aviso enviado para toda a equipe!", "success");
  };

  const getIcon = (t: string) => {
      switch(t) {
          case 'success': return <CheckCircle size={20} className="text-green-500"/>;
          case 'warning': return <AlertTriangle size={20} className="text-amber-500"/>;
          case 'alert': return <AlertOctagon size={20} className="text-red-500"/>;
          default: return <Info size={20} className="text-blue-500"/>;
      }
  };

  const getBgColor = (t: string) => {
      switch(t) {
          case 'success': return 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30';
          case 'warning': return 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30';
          case 'alert': return 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30';
          default: return 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30';
      }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
          <Megaphone className="text-orange-500"/> Central de Avisos
        </h2>
        <p className="text-zinc-500 text-sm mt-1">
          Envie notificações importantes para o painel de todos os membros.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Formulário */}
        <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Novo Aviso</h3>
            <form onSubmit={handleSend} className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Título</label>
                    <input 
                        type="text" 
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Ex: Ensaio Cancelado"
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Tipo de Alerta</label>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: 'info', icon: <Info size={18}/>, label: 'Info', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
                            { id: 'success', icon: <CheckCircle size={18}/>, label: 'Bom', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
                            { id: 'warning', icon: <AlertTriangle size={18}/>, label: 'Atenção', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
                            { id: 'alert', icon: <AlertOctagon size={18}/>, label: 'Urgente', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setType(opt.id as any)}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                    type === opt.id 
                                    ? `border-current ${opt.color} ring-1 ring-current` 
                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {opt.icon}
                                <span className="text-[10px] font-bold mt-1">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Mensagem</label>
                    <textarea 
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Digite a mensagem completa aqui..."
                        rows={4}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={isSending}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                >
                    {isSending ? 'Enviando...' : <><Send size={18}/> Enviar Aviso</>}
                </button>
            </form>
        </div>

        {/* Preview */}
        <div>
            <h3 className="text-sm font-bold text-zinc-500 uppercase mb-4">Pré-visualização</h3>
            <div className="bg-zinc-100 dark:bg-zinc-900/50 p-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center min-h-[300px]">
                {title || message ? (
                    <div className={`w-full max-w-sm p-4 rounded-xl border shadow-sm ${getBgColor(type)}`}>
                        <div className="flex gap-3">
                            <div className="mt-1 shrink-0">{getIcon(type)}</div>
                            <div>
                                <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">
                                    {title || "Título do Aviso"}
                                </h4>
                                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                                    {message || "O conteúdo da mensagem aparecerá aqui."}
                                </p>
                                <span className="text-[10px] text-zinc-400 mt-2 block">
                                    Agora
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-zinc-400">
                        <Megaphone size={48} className="mx-auto mb-2 opacity-20"/>
                        <p className="text-sm">Preencha o formulário para ver como ficará o aviso.</p>
                    </div>
                )}
            </div>
            <p className="text-xs text-zinc-500 mt-4 text-center">
                * Este aviso aparecerá no ícone de "Sino" de todos os membros do ministério atual.
            </p>
        </div>
      </div>
    </div>
  );
};
