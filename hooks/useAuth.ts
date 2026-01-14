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

            // TENTA buscar perfil, mas aceita falha (Modo Permissivo)
            let profile = null;
            try {
                const { data, error } = await sb
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();
                
                if (!error && data) {
                    profile = data;
                } else if (error) {
                    console.warn("[AUTH] Erro não-fatal ao buscar perfil:", error.message);
                }
            } catch (err) {
                console.warn("[AUTH] Exceção ao buscar perfil. Usando dados da sessão.");
            }

            // Define Org ID (pode ser undefined/null nesta fase)
            const orgId = profile?.organization_id;

            if (!profile) {
                 console.warn("[AUTH] Perfil não encontrado. Logando com dados da sessão (Modo Bootstrap).");
            } else if (!orgId) {
                 console.warn("[AUTH] Usuário sem organização. Logando em modo restrito.");
            }

            // 1. Obter Ministérios Permitidos (Apenas se tiver Org e Perfil válidos)
            let allowedMinistries: string[] = [];
            if (profile && orgId) {
                try {
                    allowedMinistries = await Supabase.fetchUserAllowedMinistries(profile.id, orgId);
                } catch (err: any) {
                    console.error("[AUTH] Failed to fetch allowed ministries:", err.message || err);
                    allowedMinistries = [];
                }
            }
            
            // 2. Resolve Active Ministry ID
            let activeMinistry = '';
            
            if (allowedMinistries.length > 0) {
                // Priority A: Local Storage (if valid and allowed)
                const localStored = localStorage.getItem('ministry_id');
                if (localStored && UUID_REGEX.test(localStored) && allowedMinistries.includes(localStored)) {
                    activeMinistry = localStored;
                }
                // Priority B: Profile Default (if valid and allowed)
                else if (profile?.ministry_id && UUID_REGEX.test(profile.ministry_id) && allowedMinistries.includes(profile.ministry_id)) {
                    activeMinistry = profile.ministry_id;
                }
                // Priority C: First Allowed Ministry
                else {
                    activeMinistry = allowedMinistries[0];
                }
            }
            
            // Sincroniza Store (evita setar string vazia se store aceita null)
            if (currentStoreId !== activeMinistry) {
                setMinistryId(activeMinistry || null);
            }

            // 3. BUSCA FUNÇÕES ESTRITAMENTE VIA MEMBERSHIP (SaaS)
            let userFunctions: string[] = [];
            if (activeMinistry && profile && orgId) {
                try {
                    userFunctions = await Supabase.fetchUserFunctions(profile.id, activeMinistry, orgId);
                } catch (err) {
                    console.warn("[AUTH] Failed to fetch user functions, defaulting to empty.");
                }
            }

            // Monta o usuário com Fallbacks para garantir que o login ocorra
            // Se profile não existir, usa metadados do Auth
            const fallbackName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário';

            setCurrentUser({
                id: user.id,
                name: profile?.name || fallbackName,
                email: profile?.email || user.email,
                role: profile?.is_admin ? 'admin' : 'member',
                ministryId: activeMinistry, 
                allowedMinistries: allowedMinistries, 
                organizationId: orgId, // Permite undefined/null
                isSuperAdmin: !!profile?.is_super_admin, 
                avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url,
                whatsapp: profile?.whatsapp,
                birthDate: profile?.birth_date,
                functions: userFunctions
            });

        } catch (e: any) {
            console.error("[AUTH] Erro inesperado no processamento da sessão:", e);
            // Mesmo com erro grave, tentamos não deslogar imediatamente para evitar loops
            // Apenas setamos null se for impossível recuperar o ID do usuário
            if (!session?.user) {
                setCurrentUser(null);
            }
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