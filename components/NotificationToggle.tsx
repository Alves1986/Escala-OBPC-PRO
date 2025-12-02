
import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from '../utils/pushUtils';
import { saveSubscription } from '../services/supabaseService';
import { useToast } from './Toast';

interface Props {
  ministryId: string | null;
}

export const NotificationToggle: React.FC<Props> = ({ ministryId }) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const { addToast } = useToast();

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, [ministryId]);

  const checkSubscription = async () => {
    if ('serviceWorker' in navigator) {
      // Check if there is an active controller. If registration failed (e.g. preview env), this will be null.
      if (!navigator.serviceWorker.controller) return;

      try {
        const readySw = await navigator.serviceWorker.ready;
        const sub = await readySw.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch (e) {
        console.warn('Cannot check subscription status:', e);
      }
    }
  };

  const subscribeUser = async () => {
    if (!ministryId) return;
    setLoading(true);
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers não suportados.');
      }
      
      if (!navigator.serviceWorker.controller) {
        throw new Error('O Service Worker não está ativo. Recarregue a página ou verifique se o ambiente suporta PWA.');
      }

      const readySw = await navigator.serviceWorker.ready;
      
      // Request permission if not granted
      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== 'granted') {
          throw new Error('Permissão negada.');
        }
      }

      const subscription = await readySw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Save to backend
      const saved = await saveSubscription(ministryId, subscription);
      if (saved) {
        setIsSubscribed(true);
        addToast("Notificações ativadas!", "success");
        
        // Send a test notification immediately (Local Simulation)
        new Notification("Notificações Ativas", {
          body: "Você receberá alertas sobre a escala.",
          icon: "https://img.icons8.com/fluency/192/calendar.png"
        });
      } else {
        throw new Error("Falha ao salvar inscrição.");
      }

    } catch (error: any) {
      console.error(error);
      addToast(error.message || "Erro ao ativar notificações", "error");
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeUser = async () => {
    setLoading(true);
    try {
      if (!navigator.serviceWorker.controller) return;
      const readySw = await navigator.serviceWorker.ready;
      const sub = await readySw.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        setIsSubscribed(false);
        addToast("Notificações desativadas.", "info");
      }
    } catch (e) {
      console.error(e);
      addToast("Erro ao desativar.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!('Notification' in window)) return null;

  return (
    <button
      onClick={isSubscribed ? unsubscribeUser : subscribeUser}
      disabled={loading || permission === 'denied'}
      className={`p-2 rounded-full transition-colors relative ${
        isSubscribed 
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 hover:bg-zinc-200'
      } ${permission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={isSubscribed ? "Desativar notificações" : "Ativar notificações de escala"}
    >
      {loading ? (
        <Loader2 size={20} className="animate-spin" />
      ) : isSubscribed ? (
        <Bell size={20} />
      ) : (
        <BellOff size={20} />
      )}
      
      {/* Status Dot */}
      {isSubscribed && (
        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-zinc-800 rounded-full"></span>
      )}
    </button>
  );
};
