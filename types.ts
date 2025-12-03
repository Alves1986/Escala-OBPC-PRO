
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

export interface ScheduleIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestedReplacement?: string;
}

export interface ScheduleAnalysis {
  [key: string]: ScheduleIssue;
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
  role: 'admin' | 'member';
  ministryId?: string; // Vínculo com os dados antigos
  whatsapp?: string;
  functions?: string[];
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

export const DEFAULT_ROLES = ["Projeção", "Transmissão", "Fotografia", "Storys"];

// Supabase Credentials
export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "https://phlfpaojiiplnzihsgee.supabase.co"; 
export const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobGZwYW9qaWlwbG56aWhzZ2VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MTkxNDEsImV4cCI6MjA4MDA5NTE0MX0.-72lH-LHmobWqqSzBuIKusGTDao_iaiu9q8lJnClUBk";
