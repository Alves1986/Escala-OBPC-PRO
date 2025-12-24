
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

export interface AvailabilityNotesMap {
  [key: string]: string; // Key: "MemberName_YYYY-MM-DD" -> Note content
}

export interface MinistrySettings {
    displayName: string;
    roles: string[];
    availabilityStart?: string; // ISO String
    availabilityEnd?: string;   // ISO String
    spotifyClientId?: string;   // New
    spotifyClientSecret?: string; // New
}

// --- NEW AUDIT TYPES ---
export interface AuditLogEntry {
  id?: string;
  date: string; // ISO String
  action: string; // "Edited Schedule", "Removed Member", etc.
  details: string; // "Joao changed Drummer from Pedro to Lucas"
  author: string; // Who did it
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionLink?: string;
  ministryId?: string; // Added for cross-ministry support
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
}

export interface ScheduleIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestedReplacement?: string;
}

export interface ScheduleAnalysis {
  [key: string]: ScheduleIssue;
}

// --- ORGANIZATION & MINISTRIES CONFIGURATION ---

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
  'members'
];

// 2. Pacote Padrão (Full) - Novos ministérios herdam isso
export const DEFAULT_TABS = [...ALL_TABS];

// 3. Interface de Configuração do Ministério
export interface MinistryDef {
  id: string;
  label: string;
  enabledTabs: string[]; // Lista de abas ativas para este ministério
}

// 4. Tabela de Configuração dos Ministérios
export const MINISTRIES: MinistryDef[] = [
  { 
    id: 'midia', 
    label: 'Mídia / Comunicação', 
    enabledTabs: DEFAULT_TABS 
  },
  { 
    id: 'louvor', 
    label: 'Louvor / Adoração', 
    enabledTabs: DEFAULT_TABS 
  },
  { 
    id: 'infantil', 
    label: 'Ministério Infantil', 
    // REGRA DE NEGÓCIO: Remove abas de repertório para o Infantil
    enabledTabs: DEFAULT_TABS.filter(t => !['repertoire', 'repertoire-manager'].includes(t)) 
  },
  { 
    id: 'recepcao', 
    label: 'Recepção / Diaconia', 
    enabledTabs: DEFAULT_TABS 
  },
  {
    id: 'teatro',
    label: 'Teatro / Artes',
    enabledTabs: DEFAULT_TABS
  }
];

export const KNOWN_MINISTRIES = MINISTRIES.map(m => m.id);

// Helper para obter configuração (com fallback para padrão se o ID for novo)
export const getMinistryConfig = (id: string): MinistryDef => {
  const found = MINISTRIES.find(m => m.id === id);
  if (found) return found;
  
  // Auto-estrutura para novos ministérios desconhecidos
  return {
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    enabledTabs: DEFAULT_TABS // Habilita tudo por padrão
  };
};

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
  content?: string; // Chords/Lyrics content
  key?: string; // Musical Key (e.g., "G")
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