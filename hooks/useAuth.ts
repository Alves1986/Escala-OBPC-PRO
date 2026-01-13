
import { useState, useEffect } from 'react';
import { User } from '../types';
import * as Supabase from '../services/supabaseService';
import { useAppStore } from '../store/appStore';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { setMinistryId, ministryId: currentStoreId } = useAppStore();

  useEffect(() => {
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
            // Limpa cache de org para forçar revalidação no boot
            localStorage.removeItem(`org_id_${user.id}`);
            
            // Clean legacy Ministry ID cache if it is not a UUID
            const cachedMid = localStorage.getItem('ministry_id');
            if (cachedMid && !UUID_REGEX.test(cachedMid)) {
                localStorage.removeItem('ministry_id');
            }

            let { data: profile, error: fetchError } = await sb
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            
            if (fetchError) {
                 console.error("[AUTH] Error fetching profile:", fetchError.message || fetchError);
                 setLoadingAuth(false);
                 return;
            }

            if (!profile) {
                 console.warn("[AUTH] Profile missing for authenticated user.");
                 // Não podemos prosseguir sem organization_id validado no banco
                 setLoadingAuth(false);
                 return;
            }

            // FIX: ERRO 1 - organization_id NUNCA PODE SER STRING VAZIA OU NULL
            if (!profile.organization_id) {
                console.error("[AUTH] ORGANIZATION_ID_MISSING for user:", user.id);
                throw new Error('ORGANIZATION_ID_MISSING: O perfil do usuário não possui uma organização vinculada.');
            }

            const orgId = profile.organization_id;

            // 1. Obter Ministérios Permitidos (Retorna UUIDs)
            // Agora passamos o orgId garantido
            let allowedMinistries: string[] = [];
            try {
                allowedMinistries = await Supabase.fetchUserAllowedMinistries(profile.id, orgId);
            } catch (err: any) {
                console.error("[AUTH] Failed to fetch allowed ministries:", err.message || err);
                allowedMinistries = [];
            }
            
            // 2. Resolve Active Ministry ID
            let activeMinistry = '';
            
            // Priority A: Local Storage (if valid and allowed)
            const localStored = localStorage.getItem('ministry_id');
            if (localStored && UUID_REGEX.test(localStored) && allowedMinistries.includes(localStored)) {
                activeMinistry = localStored;
            }
            // Priority B: Profile Default (if valid and allowed)
            else if (profile.ministry_id && UUID_REGEX.test(profile.ministry_id) && allowedMinistries.includes(profile.ministry_id)) {
                activeMinistry = profile.ministry_id;
            }
            // Priority C: First Allowed Ministry
            else if (allowedMinistries.length > 0) {
                activeMinistry = allowedMinistries[0];
            }
            
            // Sincroniza Store
            if (currentStoreId !== activeMinistry && activeMinistry) {
                setMinistryId(activeMinistry);
            }

            // 3. BUSCA FUNÇÕES ESTRITAMENTE VIA MEMBERSHIP (SaaS)
            // Só busca se houver um ministério ativo definido
            let userFunctions: string[] = [];
            if (activeMinistry) {
                try {
                    // Aqui garantimos que as funções retornadas são APENAS deste ministério
                    userFunctions = await Supabase.fetchUserFunctions(profile.id, activeMinistry, orgId);
                } catch (err) {
                    console.warn("[AUTH] Failed to fetch user functions, defaulting to empty.");
                }
            }

            setCurrentUser({
                id: profile.id,
                name: profile.name || 'Usuário',
                email: profile.email || user.email,
                role: profile.is_admin ? 'admin' : 'member',
                ministryId: activeMinistry, 
                allowedMinistries: allowedMinistries, 
                organizationId: orgId, // FIX: Setado explicitamente da variável validada
                isSuperAdmin: !!profile.is_super_admin, 
                avatar_url: profile.avatar_url,
                whatsapp: profile.whatsapp,
                birthDate: profile.birth_date,
                functions: userFunctions // Populado corretamente e isolado
            });

        } catch (e: any) {
            console.error("[AUTH] Fatal Error:", e.message || JSON.stringify(e));
            // Em caso de erro crítico de dados (sem orgId), desloga para evitar estado inconsistente
            // Apenas se o erro for persistente ou crítico
            if (e.message && e.message.includes('ORGANIZATION_ID_MISSING')) {
                 await (sb.auth as any).signOut();
            }
            setCurrentUser(null);
        } finally {
            setLoadingAuth(false);
        }
    };

    (sb.auth as any).getSession().then(({ data: { session } }: any) => {
        handleUserSession(session);
    });

    const { data: { subscription } } = (sb.auth as any).onAuthStateChange((event: any, session: any) => {
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
