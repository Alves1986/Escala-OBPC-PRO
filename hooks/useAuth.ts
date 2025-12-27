
import { useState, useEffect } from 'react';
import { User } from '../types';
import * as Supabase from '../services/supabaseService';
import { SUPABASE_URL } from '../services/supabaseService';

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
            organizationId: 'demo-org-001',
            isSuperAdmin: true, // Demo Super Admin
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
            // Busca segura do perfil INCLUINDO organization_id e is_super_admin
            let { data: profile, error: fetchError } = await sb
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            
            // LÓGICA DE AUTO-CORREÇÃO (SELF-HEALING) ROBUSTA
            if (!profile || fetchError) {
                console.warn("Perfil ausente ou erro de schema. Tentando recriar perfil básico.", user.email);
                
                const defaultMinistry = 'midia';
                // Fallback para organização padrão se não existir no banco
                const defaultOrgId = '00000000-0000-0000-0000-000000000000';
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
                    organization_id: defaultOrgId, // Atribui organização padrão
                    role: 'member',
                    is_super_admin: false,
                };

                // Tenta inserir na tabela profiles manualmente
                const { data: insertedProfile, error: insertError } = await sb
                    .from('profiles')
                    .upsert(newProfile)
                    .select()
                    .single();
                
                if (insertError) {
                    console.error("Falha crítica ao criar perfil automático:", insertError.message);
                    // Fallback de emergência: Objeto em memória para não travar o app
                    profile = { ...newProfile, is_admin: false }; 
                } else {
                    console.log("Perfil restaurado com sucesso.");
                    profile = insertedProfile;
                }
            }

            // Normalização de dados para evitar undefined
            if (profile) {
                const userMinistry = profile.ministry_id || 'midia';
                const safeAllowed = Array.isArray(profile.allowed_ministries) ? profile.allowed_ministries : [userMinistry];
                const safeFunctions = Array.isArray(profile.functions) ? profile.functions : [];
                // Se organization_id vier nulo do banco (antes da migração), usa fallback
                const safeOrgId = profile.organization_id || '00000000-0000-0000-0000-000000000000';

                setCurrentUser({
                    id: profile.id,
                    name: profile.name || 'Usuário',
                    email: profile.email || user.email,
                    role: profile.is_admin ? 'admin' : 'member',
                    ministryId: userMinistry,
                    allowedMinistries: safeAllowed,
                    organizationId: safeOrgId,
                    isSuperAdmin: !!profile.is_super_admin, // New mapping
                    avatar_url: profile.avatar_url,
                    whatsapp: profile.whatsapp,
                    birthDate: profile.birth_date,
                    functions: safeFunctions
                });
            }
        } catch (e) {
            console.error("Erro geral na autenticação:", e);
            // Em caso de erro catastrófico, desloga para tentar limpar o estado
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
