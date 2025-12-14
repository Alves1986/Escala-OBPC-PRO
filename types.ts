
export const SUPABASE_URL = (() => {
    if (typeof __SUPABASE_URL__ !== 'undefined') return __SUPABASE_URL__;
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            return import.meta.env.VITE_SUPABASE_URL || '';
        }
    } catch (e) {}
    return '';
})();

export const SUPABASE_KEY = (() => {
    if (typeof __SUPABASE_KEY__ !== 'undefined') return __SUPABASE_KEY__;
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            return import.meta.env.VITE_SUPABASE_KEY || '';
        }
    } catch (e) {}
    return '';
})();

export type Role = string;
export type ThemeMode = 'light' | 'dark' | 'system';

export interface User {
    id: string;
    name: string;
    email?: string;
    role: 'admin' | 'member';
    ministryId: string;
    allowedMinistries: string[];
    avatar_url?: string;
    whatsapp?: string;
    birthDate?: string;
    functions?: string[];
}

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'alert';
    timestamp: string;
    read: boolean;
    ministryId?: string;
    actionLink?: string;
}

export interface TeamMemberProfile {
    id: string;
    name: string;
    email?: string;
    whatsapp?: string;
    avatar_url?: string;
    roles?: string[];
    isAdmin?: boolean;
    birthDate?: string;
    functions?: string[];
}

export interface AvailabilityMap {
    [memberName: string]: string[];
}

export interface AvailabilityNotesMap {
    [key: string]: string;
}

export interface SwapRequest {
    id: string;
    ministryId: string;
    requesterName: string;
    requesterId: string;
    role: string;
    eventIso: string;
    eventTitle: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
}

export interface ScheduleMap {
    [key: string]: string;
}

export interface RepertoireItem {
    id: string;
    title: string;
    link: string;
    date: string;
    addedBy: string;
}

export interface Announcement {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'alert';
    timestamp: string;
    expirationDate?: string;
    author: string;
    readBy: { userId: string, name: string, timestamp: string }[];
    likedBy?: { userId: string, name: string }[];
    ministryId: string;
}

export interface GlobalConflict {
    ministryId: string;
    eventIso: string;
    role: string;
}

export interface GlobalConflictMap {
    [memberName: string]: GlobalConflict[];
}

export interface ScheduleAnalysis {
    // Define properties if needed for schedule analysis
}

export interface AttendanceMap {
    [key: string]: boolean;
}

export interface AuditLogEntry {
    date: string;
    action: string;
    details: string;
}

export interface MinistrySettings {
    displayName: string;
    roles: string[];
    availabilityStart?: string;
    availabilityEnd?: string;
}

export interface RankingEntry {
    memberId: string;
    name: string;
    avatar_url?: string;
    points: number;
    stats: {
        confirmedEvents: number;
        announcementsRead: number;
    };
}

export interface CustomEvent {
    id: string;
    date: string;
    time: string;
    title: string;
    iso?: string;
}

export interface MemberMonthlyStat {
    memberId: string;
    name: string;
    avatar_url?: string;
    totalScheduled: number;
    totalConfirmed: number;
    swapsRequested: number;
    attendanceRate: number; // 0 to 100
    engagementScore: 'High' | 'Medium' | 'Low';
    mainRole: string;
}

export interface MemberMap {
  [role: string]: string[];
}

export interface PushSubscriptionRecord {
    endpoint: string;
    p256dh: string;
    auth: string;
}

export const MINISTRIES = [
    { id: 'midia', label: 'Mídia' },
    { id: 'louvor', label: 'Louvor' },
    { id: 'infantil', label: 'Infantil' },
    { id: 'recepcao', label: 'Recepção' }
];

export const DEFAULT_ROLES: Record<string, string[]> = {
    midia: ['Projeção', 'Som', 'Transmissão', 'Corte', 'Fotografia'],
    louvor: ['Vocal', 'Teclado', 'Violão', 'Guitarra', 'Baixo', 'Bateria'],
    infantil: ['Professor', 'Auxiliar'],
    recepcao: ['Porta', 'Interior', 'Estacionamento'],
    default: ['Membro']
};