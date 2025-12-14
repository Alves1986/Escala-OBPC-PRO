
import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  ministryId: string | null;
}

export const NotificationToggle: React.FC<Props> = ({ ministryId }) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { addToast } = useToast();

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
        addToast("Seu navegador não suporta notificações.", "error");
        return;
    }

    try {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            addToast("Notificações permitidas!", "success");
            new Notification("Notificações Ativas", {
                body: "Você receberá alertas no navegador.",
                icon: "https://i.ibb.co/nsFR8zNG/icon1.png"
            });
        } else {
            addToast("Permissão negada.", "warning");
        }
    } catch (e) {
        console.error(e);
        addToast("Erro ao solicitar permissão.", "error");
    }
  };

  if (!('Notification' in window)) return null;

  const isGranted = permission === 'granted';

  return (
    <button
      onClick={requestPermission}
      disabled={isGranted || permission === 'denied'}
      className={`p-2 rounded-full transition-colors relative ${
        isGranted 
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 cursor-default' 
          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 hover:bg-zinc-200'
      } ${permission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isGranted ? "Notificações ativas" : "Ativar notificações de navegador"}
    >
      {isGranted ? (
        <Bell size={20} />
      ) : (
        <BellOff size={20} />
      )}
      
      {/* Status Dot */}
      {isGranted && (
        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-zinc-800 rounded-full"></span>
      )}
    </button>
  );
};
