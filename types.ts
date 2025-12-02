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
  [memberName: string]: string[]; // Array of YYYY-MM-DD
}

export interface AuditLogEntry {
  date: string;
  action: string;
  details: string;
}

export interface AppState {
  ministryId: string | null;
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
export const SUPABASE_URL = "https://phlfpaojiiplnzihsgee.supabase.co"; 
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobGZwYW9qaWlwbG56aWhzZ2VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MTkxNDEsImV4cCI6MjA4MDA5NTE0MX0.-72lH-LHmobWqqSzBuIKusGTDao_iaiu9q8lJnClUBk";
