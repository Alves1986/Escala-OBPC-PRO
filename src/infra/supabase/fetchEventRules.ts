
import { getSupabase } from '../../services/supabaseService';
import { EventRule } from '../../domain/events/types';

export async function fetchEventRules(
  ministryId: string,
  orgId: string
): Promise<EventRule[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await supabase
    .from('event_rules')
    .select('*')
    .eq('ministry_id', ministryId)
    .eq('organization_id', orgId)
    .eq('active', true);

  if (error) {
    console.error('Error fetching event rules:', error);
    throw error;
  }

  return (data || []) as EventRule[];
}
