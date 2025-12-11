
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  User, ScheduleMap, AttendanceMap, AvailabilityMap, 
  AppNotification, Announcement, SwapRequest, RepertoireItem, 
  TeamMemberProfile, MemberMap, Role, GlobalConflictMap 
} from '../types';
import { useToast } from '../components/Toast';
import { 
  useMinistrySettings, 
  useMinistrySchedule, 
  useMinistryMembers, 
  useMinistryAvailability, 
  useMinistryNotifications, 
  useMinistryAnnouncements, 
  useMinistryRepertoire, 
  useSwapRequests, 
  useGlobalConflicts 
} from './useMinistryQueries';

export function useMinistryData(ministryId: string | null, currentMonth: string, currentUser: User | null) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // Estados Locais (Mantidos para compatibilidade com o resto do app que faz atualizações otimistas locais)
  const [events, setEvents] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [membersMap, setMembersMap] = useState<MemberMap>({});
  const [publicMembers, setPublicMembers] = useState<TeamMemberProfile[]>([]);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [repertoire, setRepertoire] = useState<RepertoireItem[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [globalConflicts, setGlobalConflicts] = useState<GlobalConflictMap>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [ministryTitle, setMinistryTitle] = useState("");

  // --- REACT QUERY HOOKS ---
  const settingsQ = useMinistrySettings(ministryId);
  const scheduleQ = useMinistrySchedule(ministryId, currentMonth);
  const membersQ = useMinistryMembers(ministryId);
  const availabilityQ = useMinistryAvailability(ministryId);
  const notificationsQ = useMinistryNotifications(ministryId, currentUser?.id);
  const announcementsQ = useMinistryAnnouncements(ministryId);
  const repertoireQ = useMinistryRepertoire(ministryId);
  const swapsQ = useSwapRequests(ministryId);
  const conflictsQ = useGlobalConflicts(currentMonth, ministryId);

  // --- SYNC EFFECTS (Query -> Local State) ---
  // Isso permite que o app continue usando setSchedule/setEvents para feedback imediato
  // enquanto o React Query gerencia o fetch e cache em background.

  useEffect(() => {
    if (settingsQ.data) {
        setMinistryTitle(settingsQ.data.displayName || (ministryId ? ministryId.charAt(0).toUpperCase() + ministryId.slice(1) : ''));
        setRoles(settingsQ.data.roles || []);
    }
  }, [settingsQ.data, ministryId]);

  useEffect(() => {
    if (scheduleQ.data) {
        setEvents(scheduleQ.data.events);
        setSchedule(scheduleQ.data.schedule);
        setAttendance(scheduleQ.data.attendance);
    }
  }, [scheduleQ.data]);

  useEffect(() => {
    if (membersQ.data) {
        setMembersMap(membersQ.data.memberMap);
        setPublicMembers(membersQ.data.publicList);
    }
  }, [membersQ.data]);

  useEffect(() => {
    if (availabilityQ.data) setAvailability(availabilityQ.data);
  }, [availabilityQ.data]);

  useEffect(() => {
    if (notificationsQ.data) setNotifications(notificationsQ.data);
  }, [notificationsQ.data]);

  useEffect(() => {
    if (announcementsQ.data) setAnnouncements(announcementsQ.data);
  }, [announcementsQ.data]);

  useEffect(() => {
    if (repertoireQ.data) setRepertoire(repertoireQ.data);
  }, [repertoireQ.data]);

  useEffect(() => {
    if (swapsQ.data) setSwapRequests(swapsQ.data);
  }, [swapsQ.data]);

  useEffect(() => {
    if (conflictsQ.data) setGlobalConflicts(conflictsQ.data);
  }, [conflictsQ.data]);

  // Handle Errors Globalmente
  useEffect(() => {
      const errors = [settingsQ, scheduleQ, membersQ].filter(q => q.isError);
      if (errors.length > 0) {
          console.error("Erro ao carregar dados:", errors[0].error);
          addToast("Falha ao sincronizar alguns dados.", "error");
      }
  }, [settingsQ.isError, scheduleQ.isError, membersQ.isError]);

  // --- REFRESH ACTION ---
  const refreshData = useCallback(async () => {
    // Invalida todas as queries relacionadas ao ministério atual
    // Isso forçará um refetch em background e atualizará os estados via useEffects acima
    await queryClient.invalidateQueries({ 
        predicate: (query: any) => {
            const key = query.queryKey[0] as string;
            // Invalida chaves que começam com estes prefixos e contêm o ministryId
            return [
                'settings', 'schedule', 'members', 'availability', 
                'notifications', 'announcements', 'repertoire', 'swaps', 'conflicts'
            ].includes(key) && query.queryKey.includes(ministryId);
        }
    });
  }, [queryClient, ministryId]);

  return {
    events, setEvents,
    schedule, setSchedule,
    attendance, setAttendance,
    membersMap, setMembersMap,
    publicMembers, setPublicMembers,
    availability, setAvailability,
    notifications, setNotifications,
    announcements, setAnnouncements,
    repertoire, setRepertoire,
    swapRequests, setSwapRequests,
    globalConflicts, setGlobalConflicts,
    roles, setRoles,
    ministryTitle, setMinistryTitle,
    refreshData
  };
}
