
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
            // Tenta buscar o perfil existente
            let { data: profile, error: fetchError } = await sb.from('profiles').select('*').eq('id', user.id).single();
            
            // LÓGICA DE AUTO-CORREÇÃO (SELF-HEALING)
            // Se o usuário logou (Auth), mas não tem perfil (Profile) devido a erro anterior ou falta de trigger:
            if (!profile || fetchError) {
                console.log("Perfil não encontrado no banco público. Tentando criar automaticamente...", user.email);
                
                const defaultMinistry = 'midia';
                // Extrai metadados ou usa fallbacks seguros
                const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
                const emailName = user.email?.split('@')[0];
                const displayName = metaName || emailName || 'Novo Membro';

                const newProfile = {
                    id: user.id,
                    email: user.email,
                    name: displayName,
                    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
                    ministry_id: defaultMinistry,
                    allowed_ministries: [defaultMinistry],
                    role: 'member',
                    created_at: new Date().toISOString()
                };

                // Tenta inserir na tabela profiles manualmente
                const { data: insertedProfile, error: insertError } = await sb
                    .from('profiles')
                    .upsert(newProfile)
                    .select()
                    .single();
                
                if (insertError) {
                    console.error("Falha crítica ao criar perfil automático:", insertError.message);
                    // Em último caso, usa o objeto em memória para não travar o app do usuário
                    profile = newProfile; 
                } else {
                    console.log("Perfil criado com sucesso via Self-Healing!");
                    profile = insertedProfile;
                }
            }

            // Define o usuário no estado da aplicação
            if (profile) {
                const userMinistry = profile.ministry_id || 'midia';
                
                setCurrentUser({
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    role: profile.is_admin ? 'admin' : 'member',
                    ministryId: userMinistry,
                    allowedMinistries: profile.allowed_ministries || [userMinistry],
                    avatar_url: profile.avatar_url,
                    whatsapp: profile.whatsapp,
                    birthDate: profile.birth_date,
                    functions: profile.functions || []
                });
            }
        } catch (e) {
            console.error("Erro geral na autenticação:", e);
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
