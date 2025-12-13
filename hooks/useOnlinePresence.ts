
import { useState, useEffect } from 'react';
import { getSupabase } from '../services/supabaseService';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useOnlinePresence(userId?: string, userName?: string) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!userId || !userName) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const channel: RealtimeChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const onlineIds = Object.keys(newState);
        setOnlineUsers(onlineIds);
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
      channel.unsubscribe();
    };
  }, [userId, userName]);

  return onlineUsers;
}
