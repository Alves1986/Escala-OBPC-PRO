
import { useState, useEffect, useRef } from 'react';
import { getSupabase } from '../services/supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useOnlinePresence(userId?: string, userName?: string, onStatusChange?: (name: string, status: 'online' | 'offline') => void) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId || !userName) return;

    const supabase = getSupabase();
    if (!supabase) return;

    // Evita recriar o canal se os dados não mudaram
    if (channelRef.current) return;

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
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
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
      // Cleanup limpo
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [userId, userName]); // Removi onStatusChange das dependências para evitar re-subscriptions desnecessários

  return onlineUsers;
}
