
import { useState, useEffect } from 'react';
import { User } from '../types';
import * as Supabase from '../services/supabaseService';
import { SUPABASE_URL } from '../types';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    // Caso o Supabase não esteja configurado, não tenta autenticar para evitar erro de inicialização
    if (!SUPABASE_URL || SUPABASE_URL === "" || SUPABASE_URL.includes("SUA_URL")) {
      setLoadingAuth(false);
      return;
    }

    const sb = Supabase.getSupabase();
    if (!sb) {
      setLoadingAuth(false);
      return;
    }

    const handleUserSession = async (session: any) => {
      const user = session?.user;

      if (!user) {
        setCurrentUser(null);
        setLoadingAuth(false);
        return;
      }

      try {
        const { data: profile, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
        
        if (profile) {
          setCurrentUser({
            id: profile.id,
            name: profile.name,
            email: profile.email || user.email,
            role: profile.is_admin ? 'admin' : 'member',
            ministryId: profile.ministry_id || 'midia',
            allowedMinistries: profile.allowed_ministries || [],
            avatar_url: profile.avatar_url,
            whatsapp: profile.whatsapp,
            functions: profile.functions || []
          });
        }
      } catch (e) {
        console.error("Auth hook error:", e);
      } finally {
        setLoadingAuth(false);
      }
    };

    sb.auth.getSession().then(({ data: { session } }) => handleUserSession(session));

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      handleUserSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { currentUser, setCurrentUser, loadingAuth };
}
