
export type Role = string;

export type ThemeMode = 'light' | 'dark' | 'system';

// --- NEW ORGANIZATION TYPE ---
export interface Organization {
  id: string;
  name: string;
  slug?: string;
  active?: boolean;
  createdAt?: string;
  // Stats (populated by RPC)
  userCount?: number;
  ministryCount?: number;
  ministries?: MinistryDef[]; // Lista de ministérios da org
}

// --- DYNAMIC MINISTRY TYPE ---
export interface MinistryDef {
  id: string;   // UUID do banco (organization_ministries.id)
  code: string; // Identificador de URL/Legado (ex: 'midia', 'louvor')
  label: string; // Nome de exibição (ex: 'Comunicação / Mídia')
  enabledTabs?: string[]; 
  organizationId?: string; 
}

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
  organizationId?: string; // New
}

export interface AvailabilityMap {
  [memberName: string]: string[]; // Array of YYYY-MM-DD (prefix '+' for preferred)
}

export interface AvailabilityNotesMap {
  [key: string]: string; // Key: "MemberName_YYYY-MM-DD" -> Note content
}

export interface MinistrySettings {
    id?: string;
    organizationMinistryId?: string; // FK para tabela relacional
    displayName: string;
    roles: string[];
    availabilityStart?: string; // ISO String
    availabilityEnd?: string;   // ISO String
    spotifyClientId?: string;   // New
    spotifyClientSecret?: string; // New
    organizationId?: string;    // Link to parent organization
}

// --- NEW AUDIT TYPES ---
export interface AuditLogEntry {
  id?: string;
  date: string; // ISO String
  action: string; // "Edited Schedule", "Removed Member", etc.
  details: string; // "Joao changed Drummer from Pedro to Lucas"
  author: string; // Who did it
  organizationId?: string; // New
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionLink?: string;
  ministryId?: string; 
  organizationId?: string; // New
}

export interface Announcement {
  id: string;
  title: string;
  message: string; // Now supports HTML/Rich Text
  type: 'info' | 'success' | 'warning' | 'alert';
  timestamp: string;
  expirationDate?: string; 
  author: string;
  readBy: { userId: string; name: string; timestamp: string }[];
  likedBy: { userId: string; name: string; timestamp: string }[]; 
  organizationId?: string; // New
}

export interface ScheduleIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestedReplacement?: string;
}

export interface ScheduleAnalysis {
  [key: string]: ScheduleIssue;
}

// --- ORGANIZATION & MINISTRIES CONFIGURATION (SOURCE OF TRUTH) ---

// 1. Definição de todas as abas possíveis no sistema
export const ALL_TABS = [
  'dashboard', 
  'announcements', 
  'calendar', 
  'availability', 
  'swaps', 
  'repertoire', 
  'ranking', 
  'social', 
  'settings',
  'schedule-editor',
  'monthly-report',
  'repertoire-manager',
  'report',
  'events',
  'send-announcements',
  'members',
  'super-admin' // New Tab
];

// 2. Pacote Padrão (Full) - Novos ministérios herdam isso
export const DEFAULT_TABS = [...ALL_TABS];

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
  organizationId?: string; // New
}

export interface RepertoireItem {
  id: string;
  title: string;
  link: string;
  date: string; // YYYY-MM-DD (Data do culto/evento)
  observation?: string;
  addedBy: string;
  createdAt: string;
  content?: string; // Chords/Lyrics content
  key?: string; // Musical Key (e.g., "G")
  organizationId?: string; // New
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
  organizationId?: string; // New: SaaS Tenant ID
  isSuperAdmin?: boolean; // New: Super Admin Flag
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
    organizationId?: string; // New
}

export interface AppState {
  organizationId: string | null; // New state
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

export interface RankingHistoryItem {
    id: string;
    date: string;
    description: string;
    points: number;
    type: 'assignment' | 'swap_penalty' | 'announcement_read' | 'announcement_like';
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
    history: RankingHistoryItem[];
}

export const DEFAULT_ROLES: Record<string, string[]> = {
  'midia': ["Projeção", "Transmissão", "Fotografia", "Storys"],
  'louvor': ['Ministro', 'Vocal', 'Guitarra', 'Baixo', 'Teclado', 'Bateria', 'Mesa de Som'],
  'default': ["Membro"]
};
