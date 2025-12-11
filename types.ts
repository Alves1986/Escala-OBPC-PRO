
export type Role = string;

export type ThemeMode = 'light' | 'dark' | 'system';

export interface MemberMap {
  [role: string]: string[];
}

export interface ScheduleMap {
  [key: string]: string; // key format: "YYYY-MM-DDTHH:mm_Role" -> MemberName
}

export interface AttendanceMap {
  [key: string]: boolean;
}

export interface CustomEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  iso: string; // Helper for UI
}

export interface AvailabilityMap {
  [memberName: string]: string[]; // Array of YYYY-MM-DD (prefix '+' for preferred)
}

export interface AuditLogEntry {
  id?: string;
  date: string;
  action: string;
  details: string;
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionLink?: string; 
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  timestamp: string;
  expirationDate?: string; 
  author: string;
  readBy: { userId: string; name: string; timestamp: string }[];
  likedBy: { userId: string; name: string; timestamp: string }[]; 
}

export interface ScheduleIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestedReplacement?: string;
}

export interface ScheduleAnalysis {
  [key: string]: ScheduleIssue;
}

// --- GLOBAL CONFLICT TYPES ---
export const KNOWN_MINISTRIES = ['midia', 'louvor', 'infantil', 'recepcao', 'teatro', 'diaconia'];

export const MINISTRIES = [
  { id: 'midia', label: 'Mídia / Comunicação' },
  { id: 'louvor', label: 'Louvor / Adoração' },
  { id: 'infantil', label: 'Ministério Infantil' },
  { id: 'recepcao', label: 'Recepção / Diaconia' }
];

export interface GlobalConflict {
    ministryId: string; 
    eventIso: string;   
    role: string;       
}

export interface GlobalConflictMap {
    [normalizedMemberName: string]: GlobalConflict[];
}

export interface SwapRequest {
  id: string;
  ministryId: string;
  requesterName: string;
  requesterId?: string;
  role: string;
  eventIso: string; // YYYY-MM-DDTHH:mm
  eventTitle: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  takenByName?: string;
}

export interface RepertoireItem {
  id: string;
  title: string;
  link: string;
  date: string; // YYYY-MM-DD (Data do culto/evento)
  observation?: string;
  addedBy: string;
  createdAt: string;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  device_id: string; 
  last_updated: string;
}

export interface User {
  id?: string;        
  email?: string;     
  username?: string;  
  name: string;       
  avatar_url?: string; 
  role: 'admin' | 'member';
  ministryId?: string; 
  allowedMinistries?: string[]; 
  whatsapp?: string;
  birthDate?: string; 
  functions?: string[];
  createdAt?: string;
}

export interface TeamMemberProfile {
    id: string;
    name: string;
    email?: string;
    whatsapp?: string;
    birthDate?: string; 
    avatar_url?: string;
    roles?: string[];
    createdAt?: string;
    isAdmin?: boolean;
}

export interface AppState {
  ministryId: string | null;
  currentUser: User | null;
  currentMonth: string; 
  members: MemberMap;
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  customEvents: CustomEvent[];
  availability: AvailabilityMap;
  roles: string[];
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
}

export const DEFAULT_ROLES: Record<string, string[]> = {
  'midia': ["Projeção", "Transmissão", "Fotografia", "Storys"],
  'louvor': ['Ministro', 'Vocal', 'Guitarra', 'Baixo', 'Teclado', 'Bateria', 'Mesa de Som'],
  'default': ["Membro"]
};

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

const getLocal = (key: string) => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

// Robust Environment Variable Access
// This prevents crashes if import.meta.env is undefined while allowing Vite replacement.
const getSafeEnv = (key: string, viteReplacement?: string) => {
    // 1. If Vite replaced the variable statically, use it.
    if (viteReplacement && typeof viteReplacement === 'string') {
        return viteReplacement;
    }
    
    // 2. Try to access via import.meta.env safely at runtime
    try {
        const env = (import.meta as any).env || {};
        return env[key] || '';
    } catch (e) {
        return '';
    }
};

// Safe access variables - These try-catches prevent crash if import.meta.env is undefined
// but still allows Vite's string replacement to work inside the try block.
let safeViteUrl = '';
try { safeViteUrl = import.meta.env.VITE_SUPABASE_URL; } catch(e) {}

let safeNextUrl = '';
try { safeNextUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL; } catch(e) {}

let safeViteKey = '';
try { safeViteKey = import.meta.env.VITE_SUPABASE_KEY; } catch(e) {}

let safeNextKey = '';
try { safeNextKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; } catch(e) {}


export const SUPABASE_URL = 
  getSafeEnv('VITE_SUPABASE_URL', safeViteUrl) || 
  getSafeEnv('NEXT_PUBLIC_SUPABASE_URL', safeNextUrl) || 
  getLocal('VITE_SUPABASE_URL') ||
  ""; 

export const SUPABASE_KEY = 
  getSafeEnv('VITE_SUPABASE_KEY', safeViteKey) || 
  getSafeEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', safeNextKey) || 
  getLocal('VITE_SUPABASE_KEY') ||
  "";

// Log discreto para debug profissional apenas se falhar
if ((!SUPABASE_URL || !SUPABASE_KEY) && typeof window !== 'undefined' && window.location.pathname !== '/setup') {
  console.warn("⚠️ Sistema aguardando credenciais. Verifique o arquivo .env na raiz.");
}
