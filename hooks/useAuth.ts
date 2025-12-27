
import { useState, useEffect } from 'react';
import { User } from '../types';
import * as Supabase from '../services/supabaseService';
import { SUPABASE_URL } from '../services/supabaseService';
import { useAppStore } from '../store/appStore';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { setMinistryId } = useAppStore();

  useEffect(() => {
    // Modo Preview: Loga automaticamente com usuário fictício
    if (SUPABASE_URL === 'https://preview.mode') {
        // ... (código existente de preview)
        setCurrentUser({
            id: 'demo-user-123',
            name: 'Usuário Demo',
            email: 'demo@teste.com',
            role: 'admin',
            ministryId: 'midia',
            allowedMinistries: ['midia'],
            organizationId: 'demo-org-001',
            isSuperAdmin: true,
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
            // Busca segura do perfil INCLUINDO last_ministry_id
            let { data: profile, error: fetchError } = await sb
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();
            
            // ... (código existente de auto-correção de perfil) ...
            if (!profile || fetchError) {
                 // ... fallback code ...
                 const defaultMinistry = 'midia';
                 const defaultOrgId = '00000000-0000-0000-0000-000000000000';
                 profile = {
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || 'Membro',
                    ministry_id: defaultMinistry,
                    allowed_ministries: [defaultMinistry],
                    organization_id: defaultOrgId,
                    role: 'member',
                    is_super_admin: false
                 };
            }

            if (profile) {
                // BUSCA AVANÇADA DE PERMISSÕES (Memberships)
                const safeOrgId = profile.organization_id || '00000000-0000-0000-0000-000000000000';
                const allowedMinistries = await Supabase.fetchUserAllowedMinistries(profile.id, safeOrgId);
                const safeFunctions = Array.isArray(profile.functions) ? profile.functions : [];

                // --- LÓGICA DE PERSISTÊNCIA DE MINISTÉRIO ---
                let activeMinistry = '';

                // 1. Tenta recuperar do Banco (último acesso salvo)
                if (profile.last_ministry_id && allowedMinistries.includes(profile.last_ministry_id)) {
                    activeMinistry = profile.last_ministry_id;
                }
                
                // 2. Tenta recuperar do LocalStorage (fallback de dispositivo)
                if (!activeMinistry) {
                    const localSaved = localStorage.getItem('last_ministry_id');
                    if (localSaved && allowedMinistries.includes(localSaved)) {
                        activeMinistry = localSaved;
                    }
                }

                // 3. Fallback para o primeiro ministério permitido
                if (!activeMinistry && allowedMinistries.length > 0) {
                    activeMinistry = allowedMinistries[0];
                }

                // 4. Último caso (nunca deve acontecer se allowedMinistries estiver ok)
                if (!activeMinistry) {
                    activeMinistry = 'midia'; 
                }

                // Atualiza Store Global
                setMinistryId(activeMinistry);

                setCurrentUser({
                    id: profile.id,
                    name: profile.name || 'Usuário',
                    email: profile.email || user.email,
                    role: profile.is_admin ? 'admin' : 'member',
                    ministryId: activeMinistry, // Define o ativo correto
                    lastMinistryId: profile.last_ministry_id,
                    allowedMinistries: allowedMinistries,
                    organizationId: safeOrgId,
                    isSuperAdmin: !!profile.is_super_admin,
                    avatar_url: profile.avatar_url,
                    whatsapp: profile.whatsapp,
                    birthDate: profile.birth_date,
                    functions: safeFunctions
                });
            }
        } catch (e) {
            console.error("Erro geral na autenticação:", e);
            await sb.auth.signOut();
            setCurrentUser(null);
        } finally {
            setLoadingAuth(false);
        }
    };

    // ... (restante do código de session check) ...
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
