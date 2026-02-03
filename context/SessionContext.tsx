import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { 
    getSupabase, 
    setServiceOrgContext, 
    clearServiceOrgContext,
    fetchUserAllowedMinistries, 
    fetchUserFunctions 
} from '../services/supabaseService';
import { User } from '../types';

type SessionStatus = 
    | 'idle' 
    | 'authenticating' 
    | 'contextualizing' 
    | 'ready' 
    | 'unauthenticated' 
    | 'error';

interface SessionContextValue {
    status: SessionStatus;
    user: User | null;
    error: Error | null;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};

interface SessionProviderProps {
    children: ReactNode;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
    const [status, setStatus] = useState<SessionStatus>('idle');
    const [user, setUser] = useState<User | null>(null);
    const [error, setError] = useState<Error | null>(null);
    
    // Guard de execução única para evitar múltiplos bootstraps
    const bootstrappedRef = useRef(false);
    
    // Ref para rastrear usuário atual dentro do closure do useEffect
    const userRef = useRef<User | null>(null);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        // 2. Guard: Impede execução duplicada (React 18 Strict Mode)
        if (bootstrappedRef.current) return;
        bootstrappedRef.current = true;

        let mounted = true;
        const sb = getSupabase();

        if (!sb) {
            if (mounted) {
                console.warn("[SessionProvider] Supabase client missing. Showing Setup.");
                // Definir erro específico para que o App.tsx exiba a SetupScreen
                setError(new Error("Supabase client missing"));
                setStatus('error');
            }
            return;
        }

        const processSession = async (sessionUser: any) => {
            if (!mounted) return;
            
            // Se já estiver em erro, não tentamos processar novamente automaticamente
            if (status === 'error') return;

            // 4. Não permitir múltiplos fetchProfile concorrentes (Checagem de estado)
            if (status === 'contextualizing') return;

            const isSameUser = userRef.current?.id === sessionUser.id;
            if (!isSameUser) {
                setStatus('contextualizing');
            }

            try {
                const fetchProfile = sb
                    .from('profiles')
                    .select('*')
                    .eq('id', sessionUser.id)
                    .maybeSingle();
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('TIMEOUT_PROFILE_FETCH')), 7000)
                );

                const { data: profile, error: profileError } = await Promise.race([
                    fetchProfile, 
                    timeoutPromise
                ]) as any;

                if (profileError) throw profileError;

                if (!profile) {
                    console.warn("[SessionProvider] No profile found for user.");
                    if (mounted) {
                        setUser(null);
                        setStatus('unauthenticated');
                    }
                    return;
                }

                const orgId = profile.organization_id || '';
                if (orgId) {
                    setServiceOrgContext(orgId);
                }

                let allowedMinistries: string[] = [];
                let functions: string[] = [];
                let activeMinistry = '';

                if (orgId) {
                    try {
                        allowedMinistries = await fetchUserAllowedMinistries(profile.id, orgId);

                        const localStored = localStorage.getItem('ministry_id');
                        if (localStored && UUID_REGEX.test(localStored) && allowedMinistries.includes(localStored)) {
                            activeMinistry = localStored;
                        } else if (profile.ministry_id && UUID_REGEX.test(profile.ministry_id) && allowedMinistries.includes(profile.ministry_id)) {
                            activeMinistry = profile.ministry_id;
                        } else if (allowedMinistries.length > 0) {
                            activeMinistry = allowedMinistries[0];
                        }

                        if (activeMinistry) {
                            functions = await fetchUserFunctions(profile.id, activeMinistry, orgId);
                        }
                    } catch (e) {
                        console.error("[SessionProvider] Error fetching details (non-critical):", e);
                    }
                }

                const authenticatedUser: User = {
                    id: profile.id,
                    name: profile.name || 'Usuário',
                    email: profile.email || sessionUser.email,
                    role: profile.is_admin ? 'admin' : 'member',
                    ministryId: activeMinistry,
                    allowedMinistries,
                    organizationId: orgId,
                    isSuperAdmin: !!profile.is_super_admin,
                    avatar_url: profile.avatar_url,
                    whatsapp: profile.whatsapp,
                    birthDate: profile.birth_date,
                    functions
                };

                if (mounted) {
                    setUser(authenticatedUser);
                    setStatus('ready');
                }

            } catch (err: any) {
                console.error("[SessionProvider] Critical Error:", err);
                if (mounted) {
                    if (isSameUser) {
                        setStatus('ready');
                    } else {
                        setError(err);
                        setStatus('error');
                    }
                }
            }
        };

        const init = async () => {
            if (!mounted) return;
            
            if (!userRef.current) {
                setStatus('authenticating');
            }
            
            const { data: { session }, error: sessionError } = await sb.auth.getSession();
            
            if (sessionError) {
                if (mounted) {
                    setError(sessionError);
                    setStatus('error'); // 3. Garantir fluxo de erro
                }
                return;
            }

            if (session?.user) {
                await processSession(session.user);
            } else {
                if (mounted) {
                    setUser(null);
                    setStatus('unauthenticated');
                }
            }

            const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, currentSession) => {
                if (!mounted) return;

                if (event === 'SIGNED_IN' && currentSession?.user) {
                    await processSession(currentSession.user);
                } else if (event === 'TOKEN_REFRESHED' && currentSession?.user) {
                    await processSession(currentSession.user);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setStatus('unauthenticated');
                    clearServiceOrgContext();
                }
            });

            return subscription;
        };

        let authSubscription: any = null;
        init().then(sub => authSubscription = sub);

        return () => {
            mounted = false;
            if (authSubscription) authSubscription.unsubscribe();
        };
    }, []);

    const contextValue: SessionContextValue = { status, user, error };

    // Alteração: Renderiza children sempre para evitar duplo loading visual.
    // O controle de estado de carregamento visual fica a cargo do App.tsx.
    return (
        <SessionContext.Provider value={contextValue}>
            {children}
        </SessionContext.Provider>
    );
};