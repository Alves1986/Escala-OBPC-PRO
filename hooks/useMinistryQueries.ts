
import { useQuery } from '@tanstack/react-query';
import * as Supabase from '../services/supabaseService';

// Configurações globais de tempo para consistência
// Stale Time: 5 min (Evita requests desnecessários ao navegar entre abas)
// GC Time: 24h (Permite que o app funcione offline com dados do dia anterior)
const STALE_TIME = 1000 * 60 * 5; 
const GC_TIME = 1000 * 60 * 60 * 24; 

export const useMinistrySettings = (ministryId: string | null) => {
  return useQuery({
    queryKey: ['settings', ministryId],
    queryFn: () => ministryId ? Supabase.fetchMinistrySettings(ministryId) : Promise.resolve({ displayName: '', roles: [] }),
    enabled: !!ministryId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
};

export const useMinistrySchedule = (ministryId: string | null, monthIso: string) => {
  return useQuery({
    queryKey: ['schedule', ministryId, monthIso],
    queryFn: () => ministryId ? Supabase.fetchMinistrySchedule(ministryId, monthIso) : Promise.resolve({ schedule: {}, events: [], attendance: {} }),
    enabled: !!ministryId && !!monthIso,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
};

export const useMinistryMembers = (ministryId: string | null) => {
  return useQuery({
    queryKey: ['members', ministryId],
    queryFn: () => ministryId ? Supabase.fetchMinistryMembers(ministryId) : Promise.resolve({ memberMap: {}, publicList: [] }),
    enabled: !!ministryId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
};

export const useMinistryAvailability = (ministryId: string | null) => {
  return useQuery({
    queryKey: ['availability', ministryId],
    queryFn: () => ministryId ? Supabase.fetchMinistryAvailability(ministryId) : Promise.resolve({}),
    enabled: !!ministryId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
};

// Notificações: StaleTime menor pois é crítico receber atualizações rápidas
export const useMinistryNotifications = (ministryId: string | null, userId: string | undefined) => {
  return useQuery({
    queryKey: ['notifications', ministryId, userId],
    queryFn: () => (ministryId && userId) ? Supabase.fetchNotificationsSQL(ministryId, userId) : Promise.resolve([]),
    enabled: !!ministryId && !!userId,
    staleTime: 1000 * 60 * 1, // 1 minuto
    gcTime: GC_TIME,
  });
};

export const useMinistryAnnouncements = (ministryId: string | null) => {
  return useQuery({
    queryKey: ['announcements', ministryId],
    queryFn: () => ministryId ? Supabase.fetchAnnouncementsSQL(ministryId) : Promise.resolve([]),
    enabled: !!ministryId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
};

export const useMinistryRepertoire = (ministryId: string | null) => {
  return useQuery({
    queryKey: ['repertoire', ministryId],
    queryFn: () => ministryId ? Supabase.fetchRepertoire(ministryId) : Promise.resolve([]),
    enabled: !!ministryId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
};

// Swaps: Dados altamente voláteis
export const useSwapRequests = (ministryId: string | null) => {
  return useQuery({
    queryKey: ['swaps', ministryId],
    queryFn: () => ministryId ? Supabase.fetchSwapRequests(ministryId) : Promise.resolve([]),
    enabled: !!ministryId,
    staleTime: 1000 * 30, // 30 segundos
    gcTime: GC_TIME,
  });
};

export const useGlobalConflicts = (currentMonth: string, ministryId: string | null) => {
  return useQuery({
    queryKey: ['conflicts', ministryId, currentMonth],
    queryFn: () => ministryId ? Supabase.fetchGlobalSchedules(currentMonth, ministryId) : Promise.resolve({}),
    enabled: !!ministryId && !!currentMonth,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
};
