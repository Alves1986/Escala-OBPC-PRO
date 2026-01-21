import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
    getSupabase, 
    setServiceOrgContext, 
    clearServiceOrgContext,
    fetchUserAllowedMinistries, 
    fetchUserFunctions 
} from '../services/supabaseService';
import { User } from '../types';
import { LoginScreen } from '../components/LoginScreen';

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

    useEffect(() => {
        let mounted = true;
        const sb = getSupabase();

        if (!sb) {
            console.error("[SessionProvider] Supabase client missing");
            if (mounted) {
                setError(new Error("Supabase client missing"));
                setStatus('error');
            }
            return;
        }

        const processSession = async (sessionUser: any) => {
            if (!mounted) return;
            
            // Se já estiver em erro, não tentamos processar novamente automaticamente sem reload
            if (status === 'error') return;

            setStatus('contextualizing');

            try {
                const { data: profile, error: profileError } = await sb
                    .from('profiles')
                    .select('*')
                    .eq('id', sessionUser.id)
                    .maybeSingle();

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
                } else {
                    console.warn("[SessionProvider] User has no organization_id.");
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
                    setError(err);
                    setStatus('error');
                }
            }
        };

        const init = async () => {
            if (!mounted) return;
            setStatus('authenticating');
            
            const { data: { session }, error: sessionError } = await sb.auth.getSession();
            
            if (sessionError) {
                if (mounted) {
                    setError(sessionError);
                    setStatus('error');
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
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setStatus('unauthenticated');
                    clearServiceOrgContext(); // Correção: Usa função dedicada
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

    // Preparação do valor do contexto
    const contextValue: SessionContextValue = { status, user, error };

    // Lógica de Renderização Estrita
    let content: ReactNode = null;

    if (status === 'idle' || status === 'authenticating' || status === 'contextualizing') {
        // Loading Simples Inline
        content = (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white z-[9999]">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-bold text-zinc-400 animate-pulse uppercase tracking-widest">Carregando...</p>
            </div>
        );
    } else if (status === 'unauthenticated') {
        // Renderiza LoginScreen quando não autenticado
        content = <LoginScreen isLoading={false} />;
    } else if (status === 'error') {
        // CORREÇÃO CRÍTICA: Se o erro for cliente ausente, renderiza children para que o App.tsx exiba o SetupScreen
        if (error?.message === "Supabase client missing") {
            content = children;
        } else {
            // Tela de Erro Simples para outros erros
            content = (
                <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 text-white z-[9999] p-6">
                    <div className="text-center max-w-md bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
                        <h2 className="text-xl font-bold text-red-500 mb-2">Erro de Inicialização</h2>
                        <p className="text-zinc-400 mb-6 text-sm leading-relaxed">{error?.message || "Não foi possível conectar ao servidor."}</p>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-zinc-200 transition-colors"
                        >
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            );
        }
    } else if (status === 'ready') {
        // Aplicação Pronta
        content = children;
    }

    // ÚNICO PONTO DE RETORNO - OBRIGATÓRIO
    return (
        <SessionContext.Provider value={contextValue}>
            {content}
        </SessionContext.Provider>
    );
};