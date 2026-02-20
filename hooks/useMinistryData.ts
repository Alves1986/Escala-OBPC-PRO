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

  // Manual fetching/syncing for Availability V2 to integrate it
  useEffect(() => {
      if (mid && orgId) {
          fetchMemberAvailabilityV2(mid, orgId).then(data => setAvailabilityV2(data)).catch(console.error);
      }
  }, [mid, orgId]);



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

  // ADAPTADOR CORRIGIDO (PARTE 2)
  const events = useMemo(() => {
      const assignments = assignmentsQuery.data?.schedule || {};
      
      const assignmentBasedEvents: any[] = [];
      const processedEventKeys = new Set<string>();

      Object.keys(assignments).forEach(key => {
          const parts = key.split('_');
          if (parts.length >= 3) {
              const ruleId = parts[0];
              const date = parts[1];
              const uniqueEventKey = `${ruleId}_${date}`; // CORREÇÃO: Chave única utilizando RuleID e Data

              if (!processedEventKeys.has(uniqueEventKey)) {
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
                          title: 'Evento (Regra Removida)',
                          dateDisplay: date.split('-').reverse().slice(0, 2).join('/')
                      });
                  }
                  processedEventKeys.add(uniqueEventKey);
              }
          }
      });

      const finalEvents = [...assignmentBasedEvents];
      
      generatedEvents.forEach(gen => {
          if (!processedEventKeys.has(gen.id)) {
              finalEvents.push({
                  id: gen.id,
                  iso: gen.iso,
                  title: gen.title,
                  dateDisplay: gen.date.split('-').reverse().slice(0, 2).join('/')
              });
          }
      });

      return finalEvents.sort((a, b) => a.iso.localeCompare(b.iso));
  }, [generatedEvents, assignmentsQuery.data]);

  const eventRules = useMemo(() => {
      return (rulesQuery.data || []).filter(r => r.type === 'weekly');
  }, [rulesQuery.data]);

  return {
    events,
    schedule: assignmentsQuery.data?.schedule || {}, 
    attendance: assignmentsQuery.data?.attendance || {}, 
    membersMap: membersQuery.data?.memberMap || {},
    publicMembers: membersQuery.data?.publicList || [],
    availability: availabilityV2.availability, // ID-Based
    availabilityNotes: availabilityV2.notes, // ID-Based
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
    isLoading: isLoadingQueries || isLoadingEvents,
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