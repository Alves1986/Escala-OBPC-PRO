
import { useState, useEffect } from 'react';
import { User } from '../types';
import * as Supabase from '../services/supabaseService';
import { SUPABASE_URL } from '../types';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    // Modo Preview: Loga automaticamente com usuário fictício
    if (SUPABASE_URL === 'https://preview.mode') {
        setCurrentUser({
            id: 'demo-user-123',
            name: 'Usuário Demo',
            email: 'demo@teste.com',
            role: 'admin',
            ministryId: 'midia',
            allowedMinistries: ['midia'],
            avatar_url: '',
            whatsapp: '11999999999',
            functions: ['Projeção']
        });
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
            // Tenta buscar o perfil
            let { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
            
            // Se o perfil não existir (ex: primeiro login Google), cria um na hora.
            if (!profile) {
                console.log("Perfil não encontrado, criando novo para:", user.email);
                
                const defaultMinistry = 'midia';
                const newProfile = {
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Novo Membro',
                    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
                    ministry_id: defaultMinistry,
                    allowed_ministries: [defaultMinistry],
                    role: 'member',
                    created_at: new Date().toISOString()
                };

                const { error: insertError } = await sb.from('profiles').insert(newProfile);
                
                if (!insertError) {
                    profile = newProfile;
                } else {
                    console.error("Falha ao criar perfil automático:", insertError);
                    profile = newProfile; // Fallback visual
                }
            }

            if (profile) {
                const userMinistry = profile.ministry_id || 'midia';
                
                let isUserAdmin = profile.is_admin;
                // Hardcode admin check (mantendo lógica original)
                if (user.email === 'cassia.andinho@gmail.com') {
                    isUserAdmin = true;
                    if (!profile.is_admin) {
                         Supabase.toggleAdminSQL(user.email, true).catch(console.error);
                    }
                }

                setCurrentUser({
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    role: isUserAdmin ? 'admin' : 'member',
                    ministryId: userMinistry,
                    allowedMinistries: profile.allowed_ministries || [userMinistry],
                    avatar_url: profile.avatar_url,
                    whatsapp: profile.whatsapp,
                    birthDate: profile.birth_date,
                    functions: profile.functions || []
                });
            }
        } catch (e) {
            console.error("Erro ao carregar perfil:", e);
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
            setLoadingAuth(true); 
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
