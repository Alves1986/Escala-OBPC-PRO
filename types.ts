
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

export interface MinistrySettings {
    displayName: string;
    roles: string[];
    availabilityStart?: string; // ISO String
    availabilityEnd?: string;   // ISO String
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

export interface RankingEntry {
    memberId: string;
    name: string;
    avatar_url?: string;
    points: number;
    stats: {
        confirmedEvents: number;
        missedEvents: number;
        swapsRequested: number;
        announcementsRead: number;
        announcementsLiked: number;
    };
}

export const DEFAULT_ROLES: Record<string, string[]> = {
  'midia': ["Projeção", "Transmissão", "Fotografia", "Storys"],
  'louvor': ['Ministro', 'Vocal', 'Guitarra', 'Baixo', 'Teclado', 'Bateria', 'Mesa de Som'],
  'default': ["Membro"]
};

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

// Globals injected by Vite via define
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

const getLocal = (key: string) => {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

// 1. Try Injected Globals (Build-time env vars - MOST ROBUST)
let injectedUrl = '';
let injectedKey = '';
try {
    // @ts-ignore
    if (typeof __SUPABASE_URL__ !== 'undefined') injectedUrl = __SUPABASE_URL__;
    // @ts-ignore
    if (typeof __SUPABASE_KEY__ !== 'undefined') injectedKey = __SUPABASE_KEY__;
} catch(e) {}

// 2. Try import.meta.env (Vite Standard)
let metaUrl = '';
let metaKey = '';
try {
  // @ts-ignore
  const meta = import.meta;
  if (meta && meta.env) {
    metaUrl = meta.env.VITE_SUPABASE_URL;
    metaKey = meta.env.VITE_SUPABASE_KEY;
  }
} catch (e) {}

// 3. Try LocalStorage (User entered manually in Setup Screen)
const localUrl = getLocal('VITE_SUPABASE_URL');
const localKey = getLocal('VITE_SUPABASE_KEY');

// Priority: LocalStorage (Manual Override) > Injected Globals > Import Meta
// If Injected Globals exist, they usually mean the .env is correct, so we prefer them over empty values.
export const SUPABASE_URL = localUrl || injectedUrl || metaUrl || "";
export const SUPABASE_KEY = localKey || injectedKey || metaKey || "";

// Debug Log (Optional - remove in production)
// Only warns if absolutely nothing is found
if ((!SUPABASE_URL || !SUPABASE_KEY) && typeof window !== 'undefined' && window.location.pathname !== '/setup') {
  console.warn("⚠️ Sistema aguardando credenciais. Verifique o arquivo .env na raiz ou configure manualmente.");
}
