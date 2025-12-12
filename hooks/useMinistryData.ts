
import { useState, useEffect, useCallback } from 'react';
import * as Supabase from '../services/supabaseService';
import { 
  User, ScheduleMap, AttendanceMap, AvailabilityMap, 
  AppNotification, Announcement, SwapRequest, RepertoireItem, 
  TeamMemberProfile, MemberMap, Role, GlobalConflictMap 
} from '../types';
import { useToast } from '../components/Toast';
import { saveOfflineData, loadOfflineData } from '../services/offlineService';

export function useMinistryData(ministryId: string | null, currentMonth: string, currentUser: User | null) {
  const { addToast } = useToast();

  // Data States
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
  // Availability Window State
  const [availabilityWindow, setAvailabilityWindow] = useState<{ start?: string, end?: string }>({});

  const refreshData = useCallback(async () => {
    if (!currentUser || !ministryId) return;

    // Chave única para o cache baseada no ministério e mês atual
    const CACHE_KEY = `offline_data_${ministryId}_${currentMonth}`;

    try {
        // Carregamento paralelo de dados otimizado com Promise.all
        const [
            settings,
            schedData,
            membersData,
            availData,
            notifs,
            ann,
            swaps,
            rep,
            conflicts
        ] = await Promise.all([
            Supabase.fetchMinistrySettings(ministryId),
            Supabase.fetchMinistrySchedule(ministryId, currentMonth),
            Supabase.fetchMinistryMembers(ministryId),
            Supabase.fetchMinistryAvailability(ministryId),
            Supabase.fetchNotificationsSQL(ministryId, currentUser.id!),
            Supabase.fetchAnnouncementsSQL(ministryId),
            Supabase.fetchSwapRequests(ministryId),
            Supabase.fetchRepertoire(ministryId),
            Supabase.fetchGlobalSchedules(currentMonth, ministryId)
        ]);

        // 1. Atualização de estado em lote (Dados da Nuvem)
        setMinistryTitle(settings.displayName || ministryId.charAt(0).toUpperCase() + ministryId.slice(1));
        setRoles(settings.roles);
        setAvailabilityWindow({
            start: settings.availabilityStart,
            end: settings.availabilityEnd
        });

        setEvents(schedData.events);
        setSchedule(schedData.schedule);
        setAttendance(schedData.attendance);

        setMembersMap(membersData.memberMap);
        setPublicMembers(membersData.publicList);

        setAvailability(availData);

        setNotifications(notifs);
        setAnnouncements(ann);

        setSwapRequests(swaps);
        setRepertoire(rep);
        
        setGlobalConflicts(conflicts);

        // 2. Salvar no Cache Local Assíncrono (IndexedDB)
        // Fire-and-forget: não esperamos salvar para liberar a UI, mas tratamos erros internamente no service
        saveOfflineData(CACHE_KEY, {
            timestamp: Date.now(),
            settings,
            schedData,
            membersData,
            availData,
            notifs,
            ann,
            swaps,
            rep,
            conflicts
        });

    } catch (error) {
        console.error("Erro ao carregar dados online:", error);

        // 3. Fallback: Tentar carregar do IndexedDB
        try {
            // Nota: JSON.parse removido pois IndexedDB armazena objetos nativamente
            const cached: any = await loadOfflineData(CACHE_KEY);
            
            if (cached) {
                setMinistryTitle(cached.settings.displayName || ministryId.charAt(0).toUpperCase() + ministryId.slice(1));
                setRoles(cached.settings.roles);
                setAvailabilityWindow({
                    start: cached.settings.availabilityStart,
                    end: cached.settings.availabilityEnd
                });

                setEvents(cached.schedData.events);
                setSchedule(cached.schedData.schedule);
                setAttendance(cached.schedData.attendance);

                setMembersMap(cached.membersData.memberMap);
                setPublicMembers(cached.membersData.publicList);

                setAvailability(cached.availData);

                setNotifications(cached.notifs);
                setAnnouncements(cached.ann);

                setSwapRequests(cached.swaps);
                setRepertoire(cached.rep);
                
                setGlobalConflicts(cached.conflicts);

                addToast("Modo Offline: Dados carregados do cache.", "warning");
                return; 
            }
        } catch (e) {
            console.error("Erro ao acessar cache offline:", e);
        }

        addToast("Erro de conexão e sem dados locais.", "error");
    }

  }, [currentUser, ministryId, currentMonth, addToast]);

  useEffect(() => {
     refreshData();
  }, [refreshData]);

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
    availabilityWindow,
    refreshData
  };
}
