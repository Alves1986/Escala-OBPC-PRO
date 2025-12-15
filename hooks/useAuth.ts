
import { useState, useEffect } from 'react';
import { User } from '../types';
import * as Supabase from '../services/supabaseService';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const sb = Supabase.getSupabase();
    
    // Se não houver cliente Supabase configurado, encerra o loading
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
            // Busca segura do perfil
            let { data: profile, error: fetchError } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
            
            // LÓGICA DE AUTO-CORREÇÃO (SELF-HEALING)
            // Se o usuário autenticou mas não tem perfil (ex: erro na criação), tenta criar um básico.
            if (!profile || fetchError) {
                const defaultMinistry = 'midia';
                const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
                const emailName = user.email?.split('@')[0];
                const displayName = metaName || emailName || 'Membro';

                const newProfile = {
                    id: user.id,
                    email: user.email,
                    name: displayName,
                    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
                    ministry_id: defaultMinistry,
                    allowed_ministries: [defaultMinistry],
                    role: 'member',
                };

                const { data: insertedProfile, error: insertError } = await sb
                    .from('profiles')
                    .upsert(newProfile)
                    .select()
                    .single();
                
                if (insertError) {
                    console.error("Falha crítica ao criar perfil automático:", insertError.message);
                    profile = { ...newProfile, is_admin: false }; 
                } else {
                    profile = insertedProfile;
                }
            }

            if (profile) {
                const userMinistry = profile.ministry_id || 'midia';
                const safeAllowed = Array.isArray(profile.allowed_ministries) ? profile.allowed_ministries : [userMinistry];
                const safeFunctions = Array.isArray(profile.functions) ? profile.functions : [];

                setCurrentUser({
                    id: profile.id,
                    name: profile.name || 'Usuário',
                    email: profile.email || user.email,
                    role: profile.is_admin ? 'admin' : 'member',
                    ministryId: userMinistry,
                    allowedMinistries: safeAllowed,
                    avatar_url: profile.avatar_url,
                    whatsapp: profile.whatsapp,
                    birthDate: profile.birth_date,
                    functions: safeFunctions
                });
            }
        } catch (e) {
            console.error("Erro na autenticação:", e);
            await sb.auth.signOut();
            setCurrentUser(null);
        } finally {
            setLoadingAuth(false);
        }
    };

    // 1. Check Session directly
    sb.auth.getSession().then(({ data: { session } }) => {
        handleUserSession(session);
    });

    // 2. Listen for changes
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (event === 'SIGNED_IN') setLoadingAuth(true);
            handleUserSession(session);
        } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setLoadingAuth(false);
        }
    });

    return () => {
        subscription.unsubscribe();
    };
  }, []);

  return { currentUser, setCurrentUser, loadingAuth };
}
