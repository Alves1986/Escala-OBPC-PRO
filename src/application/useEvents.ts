
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchEventRules } from '../infra/supabase/fetchEventRules';
import { generateEvents } from '../domain/events/generateEvents';
import { CalendarEvent } from '../domain/events/types';

interface UseEventsProps {
  ministryId: string;
  organizationId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export function useEvents({ ministryId, organizationId, startDate, endDate }: UseEventsProps) {
  // 1. Busca Regras (Cacheado pelo React Query)
  const { data: rules, isLoading, error } = useQuery({
    queryKey: ['event_rules', ministryId, organizationId],
    queryFn: () => fetchEventRules(ministryId, organizationId),
    enabled: !!ministryId && !!organizationId
  });

  // 2. Projeção em Memória (Memoizado)
  // Só recalcula se as regras ou o intervalo de datas mudarem
  const events: CalendarEvent[] = useMemo(() => {
    if (!rules || rules.length === 0) return [];
    return generateEvents(rules, startDate, endDate);
  }, [rules, startDate, endDate]);

  return {
    events,
    rules,
    isLoading,
    error
  };
}
