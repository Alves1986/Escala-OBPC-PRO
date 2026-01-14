
export type Role = string;

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  active?: boolean;
  createdAt?: string;
  userCount?: number;
  ministryCount?: number;
  ministries?: MinistryDef[];
}

export interface MinistryDef {
  id: string;   
  code: string; 
  label: string; 
  enabledTabs?: string[]; 
  organizationId?: string; 
}

export interface MemberMap {
  [role: string]: string[];
}

export interface ScheduleMap {
  [key: string]: string; 
}

export interface AttendanceMap {
  [key: string]: boolean;
}

export interface CustomEvent {
  id: string;
  title: string;
  date: string; 
  time: string; 
  iso: string; 
  organizationId?: string; 
}

export interface AvailabilityMap {
  [memberName: string]: string[]; 
}

export interface AvailabilityNotesMap {
  [key: string]: string; 
}

export interface MinistrySettings {
    id?: string;
    organizationMinistryId?: string;
    displayName: string;
    roles: string[];
    availabilityStart?: string;
    availabilityEnd?: string;
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    organizationId?: string;
}

export interface AuditLogEntry {
  id?: string;
  date: string;
  action: string;
  details: string;
  author: string;
  organizationId?: string;
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
  organizationId?: string;
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
  organizationId?: string;
}

export interface ScheduleIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestedReplacement?: string;
}

export interface ScheduleAnalysis {
  [key: string]: ScheduleIssue;
}

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
  'super-admin'
];

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
  eventIso: string; 
  eventTitle: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  takenByName?: string;
  organizationId?: string;
}

export interface RepertoireItem {
  id: string;
  title: string;
  link: string;
  date: string; 
  observation?: string;
  addedBy: string;
  createdAt: string;
  content?: string; 
  key?: string; 
  organizationId?: string;
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
  organizationId?: string; 
  isSuperAdmin?: boolean; 
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
    roles?: string[]; // Cargos vindos de organization_memberships.functions
    createdAt?: string;
    isAdmin?: boolean;
    organizationId?: string;
}

export interface AppState {
  organizationId: string | null;
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
