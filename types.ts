

export type Role = string;

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
}

export interface AvailabilityMap {
  [memberName: string]: string[]; // Array of YYYY-MM-DD (prefix '+' for preferred)
}

export interface AuditLogEntry {
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
  actionLink?: string; // Opcional: link para redirecionar
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  timestamp: string;
  author: string;
  readBy: { userId: string; name: string; timestamp: string }[];
  likedBy: { userId: string; name: string; timestamp: string }[]; // Nova propriedade
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

// Lista Oficial de Ministérios Disponíveis para Seleção
export const MINISTRIES = [
  { id: 'midia', label: 'Mídia / Comunicação' },
  { id: 'louvor', label: 'Louvor / Adoração' },
  { id: 'infantil', label: 'Ministério Infantil' },
  { id: 'recepcao', label: 'Recepção / Diaconia' }
];

export interface GlobalConflict {
    ministryId: string; // Onde ele está escalado (ex: 'louvor')
    eventIso: string;   // YYYY-MM-DDTHH:mm
    role: string;       // Qual função ele vai exercer lá
}

export interface GlobalConflictMap {
    [normalizedMemberName: string]: GlobalConflict[];
}
// -----------------------------

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

// Push Notification Types
export interface PushSubscriptionRecord {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  device_id: string; // Unique ID stored in localStorage to identify this device
  last_updated: string;
}

export interface User {
  id?: string;        // UUID do Supabase Auth
  email?: string;     // Email de login
  username?: string;  // ID legado ou Display Name
  name: string;       // Nome de exibição
  avatar_url?: string; // Foto de perfil (Base64)
  role: 'admin' | 'member';
  ministryId?: string; // Vínculo com o ministério atual
  allowedMinistries?: string[]; // Lista de ministérios que o usuário pode acessar
  whatsapp?: string;
  birthDate?: string; // YYYY-MM-DD
  functions?: string[];
  createdAt?: string;
}

export interface TeamMemberProfile {
    id: string;
    name: string;
    email?: string;
    whatsapp?: string;
    birthDate?: string; // YYYY-MM-DD
    avatar_url?: string;
    roles?: string[];
    createdAt?: string;
}

export interface AppState {
  ministryId: string | null;
  currentUser: User | null;
  currentMonth: string; // YYYY-MM
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

// Supabase Credentials
export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "https://phlfpaojiiplnzihsgee.supabase.co"; 
export const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobGZwYW9qaWlwbG56aWhzZ2VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MTkxNDEsImV4cCI6MjA4MDA5NTE0MX0.-72lH-LHmobWqqSzBuIKusGTDao_iaiu9q8lJnClUBk";