
import { useState, useEffect } from 'react';
import { User } from '../types';
import * as Supabase from '../services/supabaseService';
import { SUPABASE_URL } from '../services/supabaseService';
import { useAppStore } from '../store/appStore';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { setMinistryId, ministryId: currentStoreId } = useAppStore();

  useEffect(() => {
    // Modo Preview: Loga automaticamente com usuário fictício
    if (SUPABASE_URL === 'https://preview.mode') {
        const demoUser = {
            id: 'demo-user-123',
            name: 'Usuário Demo',
            email: 'demo@teste.com',
            role: 'admin' as const,
            ministryId: 'midia',
            allowedMinistries: ['midia'],
            organizationId: '00000000-0000-0000-0000-000000000000',
            isSuperAdmin: true, 
            avatar_url: '',
            whatsapp: '11999999999',
            functions: ['Projeção']
        };
        setCurrentUser(demoUser);
        if (!currentStoreId) setMinistryId('midia');
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
            // Busca segura do perfil com organization_id obrigatório
            let { data: profile, error: fetchError } = await sb
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            
            if (!profile || fetchError) {
                 console.warn("Profile incomplete or missing, using safe defaults.", fetchError);
                 profile = {
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || 'Membro',
                    ministry_id: 'midia',
                    allowed_ministries: ['midia'],
                    organization_id: '00000000-0000-0000-0000-000000000000', // Default Org ID
                    role: 'member',
                    is_super_admin: false
                 };
            }

            if (profile) {
                // Ensure Org ID is present
                const safeOrgId = profile.organization_id || '00000000-0000-0000-0000-000000000000';
                
                const allowedMinistries = await Supabase.fetchUserAllowedMinistries(profile.id, safeOrgId);
                
                let activeMinistry = '';

                // 1. LocalStorage
                const localStored = localStorage.getItem('ministry_id');
                if (localStored && allowedMinistries.includes(localStored)) {
                    activeMinistry = localStored;
                }

                // 2. Profile DB Preference
                if (!activeMinistry && profile.ministry_id && allowedMinistries.includes(profile.ministry_id)) {
                    activeMinistry = profile.ministry_id;
                }

                // 3. Fallback
                if (!activeMinistry && allowedMinistries.length > 0) {
                    activeMinistry = allowedMinistries[0];
                }

                if (!activeMinistry) {
                    activeMinistry = 'midia'; 
                }

                if (currentStoreId !== activeMinistry) {
                    setMinistryId(activeMinistry);
                }

                setCurrentUser({
                    id: profile.id,
                    name: profile.name || 'Usuário',
                    email: profile.email || user.email,
                    role: profile.is_admin ? 'admin' : 'member',
                    ministryId: activeMinistry,
                    allowedMinistries: allowedMinistries, 
                    organizationId: safeOrgId, // Critical for RLS
                    isSuperAdmin: !!profile.is_super_admin, 
                    avatar_url: profile.avatar_url,
                    whatsapp: profile.whatsapp,
                    birthDate: profile.birth_date,
                    functions: Array.isArray(profile.functions) ? profile.functions : []
                });
            }
        } catch (e) {
            console.error("Erro auth fatal:", e);
            await sb.auth.signOut();
            setCurrentUser(null);
        } finally {
            setLoadingAuth(false);
        }
    };

    sb.auth.getSession().then(({ data: { session } }) => {
        handleUserSession(session);
    });

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
