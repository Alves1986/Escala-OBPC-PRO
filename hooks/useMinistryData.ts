import { useState, useEffect, useMemo } from 'react';
import { User, Role, DEFAULT_ROLES } from '../types';
import { useMinistryQueries, keys } from './useMinistryQueries';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase, fetchMemberAvailabilityV2 } from '../services/supabaseService';
import { useAppStore } from '../store/appStore';
import { useEvents } from '../application/useEvents';

export function useMinistryData(ministryId: string | null, currentMonth: string, currentUser: User | null) {
  const mid = ministryId || ''; 
  const orgId = currentUser?.organizationId || '';
  
  // Custom Availability Query using V2 (ID-Based)
  const queryClient = useQueryClient();
  const availabilityQueryKey = keys.availability(mid, orgId);
  const availabilityQueryData = queryClient.getQueryData(availabilityQueryKey);

  // We explicitly use V2 service here instead of the generic hook to ensure transformation
  const [availabilityV2, setAvailabilityV2] = useState<{ availability: Record<string, string[]>, notes: Record<string, string> }>({ availability: {}, notes: {} });

  const {
    settingsQuery,
    assignmentsQuery,
    membersQuery,
    notificationsQuery,
    announcementsQuery,
    swapsQuery,
    repertoireQuery,
    conflictsQuery,
    auditLogsQuery,
    rulesQuery,
    nextEventQuery,
    isLoading: isLoadingQueries
  } = useMinistryQueries(mid, currentMonth, currentUser);

  const assignmentsMonth = assignmentsQuery.data?.month;
  const schedule = assignmentsQuery.data?.schedule || {};
  const attendance = assignmentsQuery.data?.attendance || {};

  // Manual fetching/syncing for Availability V2 to integrate it
  useEffect(() => {
      if (mid && orgId) {
          fetchMemberAvailabilityV2(mid, orgId).then(data => setAvailabilityV2(data)).catch(console.error);
      }
  }, [mid, orgId]);

  // Transform ID-based availability to Name-based for legacy components
  const availabilityByName = useMemo(() => {
      const map: Record<string, string[]> = {};
      const membersList = membersQuery.data?.publicList || [];
      
      Object.entries(availabilityV2.availability).forEach(([userId, dates]) => {
          const member = membersList.find(m => m.id === userId);
          if (member) {
              map[member.name] = dates;
          }
      });
      return map;
  }, [availabilityV2, membersQuery.data]);

  // Note: availabilityNotes uses "UserID_Month" key. We need to map it to "Name_Month" for legacy if needed, 
  // but AvailabilityScreen now uses IDs, so legacy mapping might only be needed if ScheduleTable uses notes by name.
  // ScheduleTable logic currently uses `getMemberNote` via name.
  const notesByName = useMemo(() => {
      const map: Record<string, string> = {};
      const membersList = membersQuery.data?.publicList || [];
      
      Object.entries(availabilityV2.notes).forEach(([key, value]) => {
          // Key format: UserID_YYYY-MM-00
          const parts = key.split('_');
          const userId = parts[0];
          const datePart = parts.slice(1).join('_');
          
          const member = membersList.find(m => m.id === userId);
          if (member) {
              map[`${member.name}_${datePart}`] = value;
          }
      });
      return map;
  }, [availabilityV2, membersQuery.data]);


  // CÁLCULO DE DATAS PARA O USEEVENTS (Regras de projeção)
  const [yearStr, monthStr] = currentMonth.split('-');
  const year = parseInt(yearStr);
  const monthIndex = parseInt(monthStr) - 1;
  const startDate = `${currentMonth}-01`;
  const endDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0]; // Último dia do mês

  // Projeção baseada em regras (apenas para fallback e editor)
  const { events: generatedEvents, isLoading: isLoadingEvents } = useEvents({
      ministryId: mid,
      organizationId: orgId,
      startDate,
      endDate
  });

  const { setMinistryId, availableMinistries } = useAppStore();

  useEffect(() => {
      if (currentUser && currentUser.allowedMinistries && !currentUser.isSuperAdmin && mid) {
          const hasAccess = currentUser.allowedMinistries.includes(mid);
          if (!hasAccess && currentUser.allowedMinistries.length > 0) {
              console.warn(`Acesso revogado ao ministério ${mid}. Redirecionando...`);
              const fallback = currentUser.allowedMinistries[0];
              setMinistryId(fallback);
          }
      }
  }, [mid, currentUser, setMinistryId]);

  const foundMinistry = availableMinistries.find(m => m.id === mid);
  const ministryTitle = settingsQuery.data?.displayName || foundMinistry?.label || (mid.length === 36 ? 'Carregando...' : (mid ? 'Ministério' : 'Selecione um Ministério'));
  
  const roles: Role[] = useMemo(() => {
      let r = settingsQuery.data?.roles || [];
      if (r.length === 0 && mid) {
          const ministryDef = availableMinistries.find(m => m.id === mid);
          const code = ministryDef?.code || '';
          r = DEFAULT_ROLES[code] || DEFAULT_ROLES['default'] || [];
      }
      return r;
  }, [settingsQuery.data, mid, availableMinistries]);

  const availabilityWindow = useMemo(() => ({
      start: settingsQuery.data?.availabilityStart,
      end: settingsQuery.data?.availabilityEnd
  }), [settingsQuery.data]);

  const refreshData = async () => {
      // Also refresh manual V2 fetch
      if (mid && orgId) {
          fetchMemberAvailabilityV2(mid, orgId).then(data => setAvailabilityV2(data)).catch(console.error);
      }

      await queryClient.invalidateQueries({ predicate: (query) => 
          query.queryKey[0] === 'event_rules' || 
          query.queryKey[0] === 'settings' || 
          query.queryKey[0] === 'members' ||
          query.queryKey[0] === 'audit' ||
          query.queryKey[0] === 'conflicts' ||
          query.queryKey[0] === 'assignments' ||
          query.queryKey[0] === 'rules' ||
          // query.queryKey[0] === 'availability' || // Handled manually above
          query.queryKey[0] === 'nextEvent' ||
          query.queryKey[0] === 'announcements'
      });
  };

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !mid) return;
    if (mid.length !== 36) return;

    const channel = sb.channel(`ministry-live-${mid}`);

    channel
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'event_rules', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: ['event_rules', mid, orgId] });
                queryClient.invalidateQueries({ queryKey: keys.rules(mid, orgId) });
                queryClient.invalidateQueries({ queryKey: keys.nextEvent(mid, orgId) });
            }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'schedule_assignments', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.assignments(mid, currentMonth, orgId) });
                queryClient.invalidateQueries({ queryKey: keys.nextEvent(mid, orgId) });
            }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'member_availability', filter: `ministry_id=eq.${mid}` }, 
            () => {
                // Refresh Availability V2
                if (mid && orgId) {
                    fetchMemberAvailabilityV2(mid, orgId).then(data => setAvailabilityV2(data)).catch(console.error);
                }
            }
        )
        .on(
            'postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
            }
        )
        .on(
            'postgres_changes', 
            { event: '*', schema: 'public', table: 'swap_requests', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.swapRequests(mid, orgId) });
            }
        )
        .on(
            'postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'ministry_settings', filter: `ministry_id=eq.${mid}` }, 
            () => {
                queryClient.invalidateQueries({ queryKey: keys.settings(mid, orgId) });
            }
        )
        .subscribe();

    return () => {
        sb.removeChannel(channel);
    };
  }, [mid, currentMonth, queryClient, orgId]);

  // ADAPTADOR DO EDITOR: usa generatedEvents com fallback de recuperação por assignments
  const events = useMemo(() => {
      const assignments = assignmentsQuery.data?.schedule || {};
      const assignmentBasedEvents: any[] = [];
      const processedEventKeys = new Set<string>();

      Object.keys(assignments).forEach(key => {
          const [ruleId, date] = key.split('_');
          if (!ruleId || !date) return;

          const uniqueEventKey = `${ruleId}_${date}`;

          if (processedEventKeys.has(uniqueEventKey)) return;

          const ruleEvent = generatedEvents.find(e => e.id === uniqueEventKey);

          if (ruleEvent) {
              assignmentBasedEvents.push({
                  id: ruleEvent.id,
                  iso: ruleEvent.iso,
                  title: ruleEvent.title,
                  dateDisplay: ruleEvent.date.split('-').reverse().slice(0, 2).join('/')
              });
          } else {
              assignmentBasedEvents.push({
                  id: uniqueEventKey,
                  iso: `${date}T00:00`,
                  title: 'Evento (Recuperado)',
                  dateDisplay: date.split('-').reverse().slice(0, 2).join('/')
              });
          }

          processedEventKeys.add(uniqueEventKey);
      });

      const finalEvents = [
          ...assignmentBasedEvents,
          ...generatedEvents
              .filter(gen => !processedEventKeys.has(gen.id))
              .map(gen => ({
                  id: gen.id,
                  iso: gen.iso,
                  title: gen.title,
                  dateDisplay: gen.date.split('-').reverse().slice(0, 2).join('/')
              }))
      ];

      const filteredEvents = finalEvents.filter(e => e.iso.startsWith(currentMonth));

      console.log("[EDITOR_EVENTS_FINAL]", {
          month: currentMonth,
          generated: generatedEvents.length,
          recovered: assignmentBasedEvents.length,
          final: filteredEvents.length
      });

      return filteredEvents.sort((a, b) => a.iso.localeCompare(b.iso));
  }, [assignmentsQuery.data?.schedule, generatedEvents, currentMonth]);


  const isMonthSyncPending = assignmentsQuery.isFetching || assignmentsMonth !== currentMonth;

  const eventRules = useMemo(() => {
      return (rulesQuery.data || []).filter(r => r.type === 'weekly');
  }, [rulesQuery.data]);

  return {
    events,
    schedule, 
    attendance, 
    membersMap: membersQuery.data?.memberMap || {},
    publicMembers: membersQuery.data?.publicList || [],
    availability: availabilityV2.availability, // ID-Based
    availabilityNotes: availabilityV2.notes, // ID-Based
    availabilityByName, // LEGACY Support Name-Based
    notesByName, // LEGACY Support Name-Based
    notifications: notificationsQuery.data || [],
    announcements: announcementsQuery.data || [],
    repertoire: repertoireQuery.data || [],
    swapRequests: swapsQuery.data || [],
    globalConflicts: conflictsQuery.data || {}, 
    auditLogs: auditLogsQuery.data || [], 
    eventRules, 
    nextEvent: nextEventQuery.data || null,
    roles,
    ministryTitle,
    availabilityWindow,
    isLoading: isLoadingQueries || isLoadingEvents || isMonthSyncPending,
    refreshData,
    setEvents: () => refreshData(), 
    setSchedule: () => refreshData(),
    setAttendance: () => refreshData(),
    setPublicMembers: () => refreshData(),
    setAvailability: () => refreshData(),
    setNotifications: () => refreshData(),
    setRepertoire: () => refreshData(),
    setMinistryTitle: () => refreshData(),
    setAvailabilityWindow: () => refreshData()
  };
}