
import { useState, useEffect, useCallback } from 'react';
import * as Supabase from '../services/supabaseService';
import { 
  User, ScheduleMap, AttendanceMap, AvailabilityMap, 
  AppNotification, Announcement, SwapRequest, RepertoireItem, 
  TeamMemberProfile, MemberMap, Role, GlobalConflictMap, AvailabilityNotesMap,
  DEFAULT_ROLES 
} from '../types';
import { useToast } from '../components/Toast';
import { saveOfflineData, loadOfflineData } from '../services/offlineService';

export function useMinistryData(ministryId: string | null, currentMonth: string, currentUser: User | null) {
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

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
  const [availabilityWindow, setAvailabilityWindow] = useState<{ start?: string, end?: string }>({});

  const refreshData = useCallback(async (useCache = true) => {
    if (!currentUser || !ministryId) {
        setIsLoading(false);
        return;
    }

    // CORREÇÃO: Cache versionado para evitar erros de estrutura antiga
    const CACHE_KEY = `offline_data_${ministryId}_${currentMonth}_v2`;

    let hasCache = false;
    if (useCache) {
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
                hasCache = true;
                setIsLoading(false); 
            }
        } catch (e) {
            console.error("Erro leitura cache:", e);
        }
    }

    try {
        const [
            settingsResult, schedResult, membersResult, availResult,
            notifsResult, annResult, swapsResult, repResult, conflictsResult
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

        const getValue = <T>(result: PromiseSettledResult<T>, fallback: T, label: string): T => {
            if (result.status === 'fulfilled') return result.value;
            else { console.warn(`Sync Warn (${label}):`, result.reason); return fallback; }
        };

        const settings = getValue(settingsResult, { displayName: '', roles: [] }, 'Configurações');
        const schedData = getValue(schedResult, { events: [], schedule: {}, attendance: {} }, 'Escala');
        const membersData = getValue(membersResult, { memberMap: {}, publicList: [] }, 'Membros');
        const availData = getValue(availResult, { availability: {}, notes: {} }, 'Disponibilidade');
        const notifs = getValue(notifsResult, [], 'Notificações');
        const ann = getValue(annResult, [], 'Avisos');
        const swaps = getValue(swapsResult, [], 'Trocas');
        const rep = getValue(repResult, [], 'Repertório');
        const conflicts = getValue(conflictsResult, {}, 'Conflitos Globais');

        const anyFailure = [settingsResult, schedResult, membersResult].some(r => r.status === 'rejected');
        if (anyFailure && !hasCache) {
            addToast("Conexão instável. Alguns dados podem não carregar.", 'warning');
        }

        // --- LOGIC: Handle Roles Fallback ---
        let finalRoles = settings.roles;
        if (!finalRoles || finalRoles.length === 0) {
            const cleanId = ministryId.trim().toLowerCase();
            finalRoles = DEFAULT_ROLES[cleanId] || DEFAULT_ROLES['default'] || [];
        }
        setRoles(finalRoles);

        if (settings.displayName) {
            setMinistryTitle(settings.displayName);
        } else if (!ministryTitle && ministryId) {
            setMinistryTitle(ministryId.charAt(0).toUpperCase() + ministryId.slice(1));
        }

        setAvailabilityWindow({
            start: settings.availabilityStart,
            end: settings.availabilityEnd
        });

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

        saveOfflineData(CACHE_KEY, {
            timestamp: Date.now(),
            settings: { ...settings, roles: finalRoles },
            schedData, membersData, availData, notifs, ann, swaps, rep, conflicts
        });

    } catch (error) {
        console.error("Erro Crítico Global ao carregar dados:", error);
        if (!hasCache) addToast("Erro de conexão e sem dados locais.", "error");
    } finally {
        setIsLoading(false);
    }

  }, [currentUser, ministryId, currentMonth, addToast]);

  useEffect(() => {
     setIsLoading(true);
     refreshData(true);
  }, [refreshData]);

  return {
    events, setEvents, schedule, setSchedule, attendance, setAttendance,
    membersMap, setMembersMap, publicMembers, setPublicMembers,
    availability, setAvailability, availabilityNotes, setAvailabilityNotes,
    notifications, setNotifications, announcements, setAnnouncements,
    repertoire, setRepertoire, swapRequests, setSwapRequests,
    globalConflicts, setGlobalConflicts, roles, setRoles,
    ministryTitle, setMinistryTitle, availabilityWindow, setAvailabilityWindow, 
    isLoading, refreshData
  };
}
