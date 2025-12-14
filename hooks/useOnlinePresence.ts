
import { useState, useEffect, useRef } from 'react';
import { getSupabase } from '../services/supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useOnlinePresence(userId?: string, userName?: string, onStatusChange?: (name: string, status: 'online' | 'offline') => void) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Ref para controlar se é a primeira sincronização (carga da página)
  // Isso impede notificar "Fulano entrou" para quem já estava lá quando você deu F5
  const isFirstSync = useRef(true);

  useEffect(() => {
    if (!userId || !userName) return;

    const supabase = getSupabase();
    if (!supabase) return;

    if (channelRef.current) return;

    // Resetamos a flag ao montar o componente/conectar
    isFirstSync.current = true;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const onlineIds = Object.keys(newState);
        setOnlineUsers(onlineIds);
        
        // Após receber a lista completa pela primeira vez, liberamos as notificações
        // Pequeno delay para garantir que eventos de 'join' simultâneos sejam ignorados
        setTimeout(() => {
            isFirstSync.current = false;
        }, 500);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Se ainda estamos na carga inicial, NÃO notifique
        if (isFirstSync.current) return;

        if (onStatusChange) {
          newPresences.forEach((p: any) => {
            // Ignora a notificação do próprio usuário
            if (p.user_id !== userId && p.name) {
              onStatusChange(p.name, 'online');
            }
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        // Saídas sempre devem ser notificadas (exceto se for eu mesmo)
        if (onStatusChange) {
          leftPresences.forEach((p: any) => {
            if (p.user_id !== userId && p.name) {
              onStatusChange(p.name, 'offline');
            }
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: userId,
            name: userName,
          });
        }
      });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [userId, userName]); 

  return onlineUsers;
}
