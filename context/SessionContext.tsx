import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
    getSupabase, 
    setServiceOrgContext, 
    fetchUserAllowedMinistries, 
    fetchUserFunctions 
} from '../services/supabaseService';
import { User } from '../types';

type SessionStatus = 
    | 'idle' 
    | 'checking_local' 
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
        const initializeSession = async () => {
            const sb = getSupabase();
            
            // 1. Check Supabase Client
            if (!sb) {
                console.error("[SessionProvider] Supabase client not initialized");
                setStatus('error');
                setError(new Error("Supabase client missing"));
                return;
            }

            try {
                setStatus('authenticating');
                
                // 2. Get Session
                const { data: { session }, error: sessionError } = await sb.auth.getSession();

                if (sessionError) throw sessionError;
                
                if (!session?.user) {
                    setStatus('unauthenticated');
                    return;
                }

                // 3. Fetch Profile
                const { data: profile, error: profileError } = await sb
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (profileError) throw profileError;
                
                if (!profile) {
                    console.warn("[SessionProvider] User authenticated but no profile found.");
                    setStatus('unauthenticated'); // Treat as unauthenticated if no profile
                    return;
                }

                // 4. Validate Organization ID
                if (!profile.organization_id) {
                    const err = new Error('ORGANIZATION_ID_MISSING: User profile has no organization linked.');
                    console.error("[SessionProvider]", err);
                    throw err;
                }

                setStatus('contextualizing');

                // 5. Inject Context (CRITICAL STEP)
                // This makes supabaseService functions safe to use without passing orgId manually
                setServiceOrgContext(profile.organization_id);

                // 6. Build Authenticated User Object
                const orgId = profile.organization_id;
                
                // Fetch allowed ministries
                const allowedMinistries = await fetchUserAllowedMinistries(profile.id, orgId);

                // Resolve Active Ministry (Logic mirrored from legacy useAuth for consistency)
                let activeMinistry = '';
                const localStored = localStorage.getItem('ministry_id');

                if (localStored && UUID_REGEX.test(localStored) && allowedMinistries.includes(localStored)) {
                    activeMinistry = localStored;
                } else if (profile.ministry_id && UUID_REGEX.test(profile.ministry_id) && allowedMinistries.includes(profile.ministry_id)) {
                    activeMinistry = profile.ministry_id;
                } else if (allowedMinistries.length > 0) {
                    activeMinistry = allowedMinistries[0];
                }

                // Fetch Functions for the active ministry
                let functions: string[] = [];
                if (activeMinistry) {
                    functions = await fetchUserFunctions(profile.id, activeMinistry, orgId);
                }

                const authenticatedUser: User = {
                    id: profile.id,
                    name: profile.name || 'Usuário',
                    email: profile.email || session.user.email,
                    role: profile.is_admin ? 'admin' : 'member',
                    ministryId: activeMinistry,
                    allowedMinistries: allowedMinistries,
                    organizationId: orgId,
                    isSuperAdmin: !!profile.is_super_admin,
                    avatar_url: profile.avatar_url,
                    whatsapp: profile.whatsapp,
                    birthDate: profile.birth_date,
                    functions: functions
                };

                setUser(authenticatedUser);
                setStatus('ready');

            } catch (err: any) {
                console.error("[SessionProvider] Initialization Error:", err);
                setError(err);
                setStatus('error');
            }
        };

        initializeSession();
    }, []);

    // Render logic: Only render children when ready
    if (status === 'ready') {
        return (
            <SessionContext.Provider value={{ status, user, error }}>
                {children}
            </SessionContext.Provider>
        );
    }

    // Optional: Render placeholders for other states if this provider controlled the whole app view
    // For now, adhering strictly to "Only render children when ready" implies
    // returning null or a specific fallback for non-ready states.
    if (status === 'unauthenticated') {
        // In a real scenario, this might render the LoginScreen directly or redirect
        // Since we are building this in isolation, we return null or a simple indicator
        return null; 
    }

    if (status === 'error') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>
                System Error: {error?.message}
            </div>
        );
    }

    // Loading / Authenticating / Contextualizing
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            {/* Simple fallback loader */}
            <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full"></div>
        </div>
    );
};
