import { useState, useEffect, useMemo } from 'react';
import { User, Role, DEFAULT_ROLES } from '../types';
import { useMinistryQueries, keys } from './useMinistryQueries';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '../services/supabaseService';
import { useAppStore } from '../store/appStore';
import { useEvents } from '../application/useEvents';

export function useMinistryData(ministryId: string | null, currentMonth: string, currentUser: User | null) {
  const mid = ministryId || ''; 
  const orgId = currentUser?.organizationId || '';
  
  const {
    settingsQuery,
    assignmentsQuery,
    membersQuery,
    availabilityQuery,
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

  const queryClient = useQueryClient();
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
      await queryClient.invalidateQueries({ predicate: (query) => 
          query.queryKey[0] === 'event_rules' || 
          query.queryKey[0] === 'settings' || 
          query.queryKey[0] === 'members' ||
          query.queryKey[0] === 'audit' ||
          query.queryKey[0] === 'conflicts' ||
          query.queryKey[0] === 'assignments' ||
          query.queryKey[0] === 'rules' ||
          query.queryKey[0] === 'availability' ||
          query.queryKey[0] === 'nextEvent'
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
  // O Calendário deve refletir APENAS o que está em schedule_assignments para renderizar blocos distintos.
  // Combina generatedEvents (regras) com assignments reais para preencher lacunas, mas usa assignments como autoridade de tempo/ID.
  const events = useMemo(() => {
      // 1. Extrair Assignments únicos (EventKey + Date)
      const assignmentKeys = new Set<string>();
      const assignments = assignmentsQuery.data?.schedule || {};
      
      // Reconstrói lista de eventos baseada nas assignments existentes
      // keys em assignments são: ruleId_date_role
      const assignmentBasedEvents: any[] = [];
      const processedEventKeys = new Set<string>();

      Object.keys(assignments).forEach(key => {
          const parts = key.split('_');
          if (parts.length >= 3) {
              const ruleId = parts[0];
              const date = parts[1];
              const uniqueEventKey = `${ruleId}_${date}`;

              if (!processedEventKeys.has(uniqueEventKey)) {
                  // Precisamos achar a regra para saber o título e horário
                  // Tenta achar em generatedEvents primeiro
                  const ruleEvent = generatedEvents.find(e => e.id === uniqueEventKey);
                  
                  if (ruleEvent) {
                      assignmentBasedEvents.push({
                          id: ruleEvent.id,
                          iso: ruleEvent.iso,
                          title: ruleEvent.title,
                          dateDisplay: ruleEvent.date.split('-').reverse().slice(0, 2).join('/')
                      });
                  } else {
                      // Se não achou na projeção (talvez regra deletada mas escala existe),
                      // cria um placeholder. Idealmente deveria buscar o título da regra no DB, 
                      // mas aqui assumimos que generatedEvents cobre as regras ativas.
                      // Fallback visual simples.
                      assignmentBasedEvents.push({
                          id: uniqueEventKey,
                          iso: `${date}T00:00`, // Horário desconhecido se regra sumiu
                          title: 'Evento (Regra Removida)',
                          dateDisplay: date.split('-').reverse().slice(0, 2).join('/')
                      });
                  }
                  processedEventKeys.add(uniqueEventKey);
              }
          }
      });

      // 2. Merge com Generated Events (para mostrar slots vazios de regras ativas)
      // Se já processamos via assignment, não duplica.
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

      // Ordena por data/hora
      return finalEvents.sort((a, b) => a.iso.localeCompare(b.iso));
  }, [generatedEvents, assignmentsQuery.data]);

  // Filtra regras semanais para a UI de "Eventos Padrão"
  const eventRules = useMemo(() => {
      return (rulesQuery.data || []).filter(r => r.type === 'weekly');
  }, [rulesQuery.data]);

  return {
    events,
    schedule: assignmentsQuery.data?.schedule || {}, 
    attendance: assignmentsQuery.data?.attendance || {}, 
    membersMap: membersQuery.data?.memberMap || {},
    publicMembers: membersQuery.data?.publicList || [],
    availability: availabilityQuery.data?.availability || {},
    availabilityNotes: availabilityQuery.data?.notes || {},
    notifications: notificationsQuery.data || [],
    announcements: announcementsQuery.data || [],
    repertoire: repertoireQuery.data || [],
    swapRequests: swapsQuery.data || [],
    globalConflicts: conflictsQuery.data || {}, 
    auditLogs: auditLogsQuery.data || [], 
    eventRules, 
    nextEvent: nextEventQuery.data || null, // NEW
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