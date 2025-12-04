
import React, { useState } from 'react';
import { Bell, Check, Trash2, Info, AlertTriangle, CheckCircle, AlertOctagon } from 'lucide-react';
import { AppNotification } from '../types';
import { markNotificationsRead, clearAllNotifications } from '../services/supabaseService';

interface Props {
  notifications: AppNotification[];
  ministryId: string | null;
  onNotificationsUpdate: (updated: AppNotification[]) => void;
}

export const NotificationCenter: React.FC<Props> = ({ notifications, ministryId, onNotificationsUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!ministryId) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    
    const updated = await markNotificationsRead(ministryId, unreadIds);
    onNotificationsUpdate(updated);
  };

  const handleClearAll = async () => {
      if (!ministryId) return;
      if (confirm("Tem certeza que deseja limpar todas as notificações?")) {
          await clearAllNotifications(ministryId);
          onNotificationsUpdate([]); // Limpa localmente
      }
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'success': return <CheckCircle size={16} className="text-green-500"/>;
          case 'warning': return <AlertTriangle size={16} className="text-amber-500"/>;
          case 'alert': return <AlertOctagon size={16} className="text-red-500"/>;
          default: return <Info size={16} className="text-blue-500"/>;
      }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <Bell size={20} className="text-zinc-600 dark:text-zinc-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full animate-pulse border border-white dark:border-zinc-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden animate-fade-in">
             <div className="p-3 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                 <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Notificações</h3>
                 <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-[10px] text-blue-600 hover:text-blue-500 font-bold flex items-center gap-1" title="Marcar todas como lidas">
                            <Check size={12}/> Ler
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button onClick={handleClearAll} className="text-[10px] text-red-500 hover:text-red-600 font-bold flex items-center gap-1" title="Limpar histórico">
                            <Trash2 size={12}/> Limpar
                        </button>
                    )}
                 </div>
             </div>
             
             <div className="max-h-80 overflow-y-auto custom-scrollbar">
                 {notifications.length === 0 ? (
                     <div className="p-8 text-center text-zinc-400 text-sm">
                         <Bell size={24} className="mx-auto mb-2 opacity-20"/>
                         Nenhuma notificação.
                     </div>
                 ) : (
                     <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                         {notifications.map(n => (
                             <div key={n.id} className={`p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors ${!n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                 <div className="flex gap-3">
                                     <div className="mt-1 shrink-0">{getIcon(n.type)}</div>
                                     <div className="flex-1">
                                         <h4 className={`text-sm ${!n.read ? 'font-bold text-zinc-800 dark:text-zinc-100' : 'font-medium text-zinc-600 dark:text-zinc-400'}`}>
                                             {n.title}
                                         </h4>
                                         <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                             {n.message}
                                         </p>
                                         <span className="text-[10px] text-zinc-400 mt-2 block">
                                             {new Date(n.timestamp).toLocaleString('pt-BR')}
                                         </span>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
             </div>
          </div>
        </>
      )}
    </div>
  );
};
