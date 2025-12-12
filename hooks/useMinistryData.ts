
import { useState, useEffect, useCallback } from 'react';
import * as Supabase from '../services/supabaseService';
import { 
  User, ScheduleMap, AttendanceMap, AvailabilityMap, 
  AppNotification, Announcement, SwapRequest, RepertoireItem, 
  TeamMemberProfile, MemberMap, Role, GlobalConflictMap, AvailabilityNotesMap 
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
  const [availabilityNotes, setAvailabilityNotes] = useState<AvailabilityNotesMap>({});
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
        // Carregamento paralelo RESILIENTE (Partial Failure Tolerance)
        // Se uma requisição falhar (ex: notificações), as outras continuam.
        // Isso impede a Tela Branca da Morte se uma tabela do Supabase travar.
        const [
            settingsResult,
            schedResult,
            membersResult,
            availResult,
            notifsResult,
            annResult,
            swapsResult,
            repResult,
            conflictsResult
        ] = await Promise.allSettled([
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

        // Helper para extrair valor seguro de Promise.allSettled
        const getValue = <T>(result: PromiseSettledResult<T>, fallback: T): T => {
            return result.status === 'fulfilled' ? result.value : fallback;
        };

        const settings = getValue(settingsResult, { displayName: '', roles: [] });
        const schedData = getValue(schedResult, { events: [], schedule: {}, attendance: {} });
        const membersData = getValue(membersResult, { memberMap: {}, publicList: [] });
        const availData = getValue(availResult, { availability: {}, notes: {} }); // Updated to receive notes
        const notifs = getValue(notifsResult, []);
        const ann = getValue(annResult, []);
        const swaps = getValue(swapsResult, []);
        const rep = getValue(repResult, []);
        const conflicts = getValue(conflictsResult, {});

        // 1. Atualização de estado em lote (Dados da Nuvem)
        if (settings.displayName) {
            setMinistryTitle(settings.displayName || ministryId.charAt(0).toUpperCase() + ministryId.slice(1));
            setRoles(settings.roles);
            setAvailabilityWindow({
                start: settings.availabilityStart,
                end: settings.availabilityEnd
            });
        }

        setEvents(schedData.events);
        setSchedule(schedData.schedule);
        setAttendance(schedData.attendance);

        setMembersMap(membersData.memberMap);
        setPublicMembers(membersData.publicList);

        setAvailability(availData.availability);
        setAvailabilityNotes(availData.notes);

        setNotifications(notifs);
        setAnnouncements(ann);

        setSwapRequests(swaps);
        setRepertoire(rep);
        
        setGlobalConflicts(conflicts);

        // 2. Salvar no Cache Local Assíncrono (IndexedDB)
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
        console.error("Erro Crítico Global ao carregar dados:", error);

        // 3. Fallback: Tentar carregar do IndexedDB
        try {
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

                setAvailability(cached.availData.availability);
                setAvailabilityNotes(cached.availData.notes || {});

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
    availabilityNotes, setAvailabilityNotes,
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
