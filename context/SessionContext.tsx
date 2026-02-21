import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { 
    getSupabase, 
    setServiceOrgContext, 
    clearServiceOrgContext,
    fetchUserAllowedMinistries, 
    fetchUserFunctions,
    fetchOrganizationDetails
} from '../services/supabaseService';
import { User, Organization } from '../types';

type SessionStatus = 
    | 'idle' 
    | 'authenticating' 
    | 'contextualizing' 
    | 'ready' 
    | 'unauthenticated' 
    | 'error'
    | 'locked_inactive'
    | 'locked_billing';

interface SessionContextValue {
    status: SessionStatus;
    user: User | null;
    error: Error | null;
    organization: Organization | null;
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
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [error, setError] = useState<Error | null>(null);
    
    const bootstrappedRef = useRef(false);
    const userRef = useRef<User | null>(null);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        if (bootstrappedRef.current) return;
        bootstrappedRef.current = true;

        let mounted = true;
        const sb = getSupabase();

        if (!sb) {
            if (mounted) {
                console.warn("[SessionProvider] Supabase client missing. Defaulting to unauthenticated to show Login.");
                setStatus('unauthenticated');
            }
            return;
        }

        const processSession = async (sessionUser: any) => {
            if (!mounted) return;
            if (status === 'error') return;
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
                if (!orgId) {
                    setUser(null);
                    setStatus('unauthenticated');
                    return;
                }

                setServiceOrgContext(orgId);

                // --- ORGANIZATION GUARD CHECK ---
                const orgDetails = await fetchOrganizationDetails(orgId);
                setOrganization(orgDetails);

                if (orgDetails) {
                    // 1. Inactive Check
                    if (orgDetails.active === false) {
                        if (mounted) {
                            setUser({
                                id: profile.id,
                                name: profile.name,
                                email: profile.email,
                                role: 'member',
                                organizationId: orgId
                            } as User);
                            setStatus('locked_inactive');
                        }
                        return;
                    }

                    // 2. Billing Check
                    // Super Admins bypass locks to fix billing
                    if (!profile.is_super_admin) {
                        const isTrial = orgDetails.plan_type === 'trial';
                        const trialExpired = isTrial && orgDetails.trial_ends_at && new Date() > new Date(orgDetails.trial_ends_at);
                        const isLocked = orgDetails.access_locked;
                        const badStatus = orgDetails.billing_status && !['active', 'trial'].includes(orgDetails.billing_status);

                        if (isLocked || trialExpired || badStatus) {
                            if (mounted) {
                                setUser({
                                    id: profile.id,
                                    name: profile.name,
                                    email: profile.email,
                                    role: 'member',
                                    organizationId: orgId
                                } as User);
                                setStatus('locked_billing');
                            }
                            return;
                        }
                    }
                }
                // --- END GUARD ---

                let allowedMinistries: string[] = [];
                let functions: string[] = [];
                let activeMinistry = '';

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

    const contextValue: SessionContextValue = { status, user, error, organization };

    return (
        <SessionContext.Provider value={contextValue}>
            {children}
        </SessionContext.Provider>
    );
};