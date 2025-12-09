
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    KNOWN_MINISTRIES, GlobalConflict, DatabaseProfile, DatabaseEvent, DatabaseAssignment, DEFAULT_ROLES, AttendanceMap 
} from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getStorageKey = (ministryId: string, suffix: string) => `${ministryId}_${suffix}`;

export const getSupabase = () => supabase;

// --- LEGACY KEY-VALUE HELPERS (For configs, logs, announcements) ---
export const loadData = async <T>(ministryId: string, keySuffix: string, fallback: T): Promise<T> => {
  if (!supabase || !ministryId) return fallback;
  try {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { data, error } = await supabase
      .from('app_storage')
      .select('value')
      .eq('key', getStorageKey(cleanMid, keySuffix))
      .single();

    if (error || !data) return fallback;
    return data.value as T;
  } catch (e) {
    console.error(`Error loading ${keySuffix}`, e);
    return fallback;
  }
};

export const saveData = async <T>(ministryId: string, keySuffix: string, value: T): Promise<boolean> => {
  if (!supabase || !ministryId) return false;
  try {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase
      .from('app_storage')
      .upsert(
        { key: getStorageKey(cleanMid, keySuffix), value },
        { onConflict: 'key' }
      );
    return !error;
  } catch (e) {
    console.error(`Error saving ${keySuffix}`, e);
    return false;
  }
};

// ============================================================================
// MAINTENANCE TOOLS
// ============================================================================

export const removeDuplicateProfiles = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão." };

    try {
        const { data: profiles, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        if (!profiles || profiles.length === 0) return { success: false, message: "Nenhum perfil encontrado." };

        const emailMap = new Map<string, any[]>();
        profiles.forEach(p => {
            if (p.email) {
                const normalized = p.email.trim().toLowerCase();
                if (!emailMap.has(normalized)) {
                    emailMap.set(normalized, []);
                }
                emailMap.get(normalized)?.push(p);
            }
        });

        let mergedCount = 0;

        for (const [email, duplicates] of emailMap.entries()) {
            if (duplicates.length > 1) {
                const sorted = duplicates.sort((a, b) => {
                    if (a.avatar_url && !b.avatar_url) return -1;
                    if (!a.avatar_url && b.avatar_url) return 1;
                    return 0;
                });

                const master = sorted[0];
                const slaves = sorted.slice(1);

                for (const slave of slaves) {
                    await supabase.from('availability').update({ member_id: master.id }).eq('member_id', slave.id);
                    await supabase.from('schedule_assignments').update({ member_id: master.id }).eq('member_id', slave.id);
                    
                    const masterAllowed = master.allowed_ministries || [];
                    const slaveAllowed = slave.allowed_ministries || [];
                    const mergedAllowed = [...new Set([...masterAllowed, ...slaveAllowed])];

                    const masterFuncs = master.functions || [];
                    const slaveFuncs = slave.functions || [];
                    const mergedFuncs = [...new Set([...masterFuncs, ...slaveFuncs])];

                    await supabase.from('profiles').update({
                        allowed_ministries: mergedAllowed,
                        functions: mergedFuncs,
                        whatsapp: master.whatsapp || slave.whatsapp, 
                        birth_date: master.birth_date || slave.birth_date
                    }).eq('id', master.id);

                    await supabase.from('profiles').delete().eq('id', slave.id);
                    mergedCount++;
                }
            }
        }

        return { success: true, message: `Processo concluído. ${mergedCount} perfis duplicados foram mesclados e removidos.` };

    } catch (e: any) {
        console.error("Erro ao remover duplicatas:", e);
        return { success: false, message: "Erro: " + e.message };
    }
};

export const migrateLegacyData = async (currentMinistryId: string): Promise<{ success: boolean; message: string }> => {
  if (!supabase) return { success: false, message: "Erro de conexão." };

  try {
    const ALL_PREFIXES = ['midia', 'louvor', 'infantil', 'recepcao', 'teatro', 'diaconia', 'unigente', 'adolescentes'];
    const normalize = (s: string) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";

    interface LegacyMemberInfo {
        originalName: string;
        functions: Set<string>;
        availability: Set<string>;
        allowedMinistries: Set<string>;
        email?: string;
        whatsapp?: string;
        avatar_url?: string;
        birthDate?: string;
        legacyId?: string;
    }
    const mergedData: Record<string, LegacyMemberInfo> = {};
    const keysToDelete: string[] = [];

    const addData = (ministrySource: string, name: string, role?: string, dates?: string[], details?: Partial<LegacyMemberInfo>) => {
        if (!name) return;
        const key = normalize(name);
        if (!key) return;

        if (!mergedData[key]) {
            mergedData[key] = { 
                originalName: name, 
                functions: new Set(), 
                availability: new Set(),
                allowedMinistries: new Set()
            };
        }
        
        mergedData[key].allowedMinistries.add(ministrySource);

        if (name.length > mergedData[key].originalName.length) {
            mergedData[key].originalName = name;
        }

        if (role) mergedData[key].functions.add(role);
        if (dates) dates.forEach(d => mergedData[key].availability.add(d));

        if (details) {
            if (details.email && !mergedData[key].email) mergedData[key].email = details.email;
            if (details.whatsapp && !mergedData[key].whatsapp) mergedData[key].whatsapp = details.whatsapp;
            if (details.avatar_url && !mergedData[key].avatar_url) mergedData[key].avatar_url = details.avatar_url;
            if (details.birthDate && !mergedData[key].birthDate) mergedData[key].birthDate = details.birthDate;
            if (details.legacyId && !mergedData[key].legacyId) mergedData[key].legacyId = details.legacyId;
        }
    };

    // 1. Coleta Dados Legados (Perfis)
    for (const prefix of ALL_PREFIXES) {
        const cleanPrefix = prefix.trim().toLowerCase().replace(/\s+/g, '-');
        
        keysToDelete.push(getStorageKey(cleanPrefix, 'availability'));
        keysToDelete.push(getStorageKey(cleanPrefix, 'availability_v1'));
        keysToDelete.push(getStorageKey(cleanPrefix, 'members_v7'));
        keysToDelete.push(getStorageKey(cleanPrefix, 'public_members_list'));

        const avail1 = await loadData<AvailabilityMap>(cleanPrefix, 'availability', {});
        const avail2 = await loadData<AvailabilityMap>(cleanPrefix, 'availability_v1', {});
        const legacyMemberMap = await loadData<MemberMap>(cleanPrefix, 'members_v7', {});
        const legacyMembersList = await loadData<any[]>(cleanPrefix, 'public_members_list', []);

        const legacyAvail = { ...avail1, ...avail2 };
        if (legacyAvail) {
            Object.entries(legacyAvail).forEach(([name, dates]) => {
                if (Array.isArray(dates)) addData(cleanPrefix, name, undefined, dates);
            });
        }

        if (legacyMemberMap) {
            Object.entries(legacyMemberMap).forEach(([role, members]) => {
                if (Array.isArray(members)) members.forEach(name => addData(cleanPrefix, name, role));
            });
        }

        if (legacyMembersList) {
            legacyMembersList.forEach(m => {
                const name = typeof m === 'string' ? m : m.name;
                const roles = (typeof m !== 'string' && m.roles) ? m.roles : [];
                
                const details: Partial<LegacyMemberInfo> = {};
                if (typeof m !== 'string') {
                    if (m.email) details.email = m.email;
                    if (m.whatsapp) details.whatsapp = m.whatsapp;
                    if (m.avatar_url) details.avatar_url = m.avatar_url;
                    if (m.birthDate) details.birthDate = m.birthDate;
                    if (m.id) details.legacyId = m.id;
                }

                addData(cleanPrefix, name, undefined, undefined, details);
                roles.forEach((r: string) => addData(cleanPrefix, name, r));
            });
        }
    }

    // 2. Prepara Mapa de Perfis Existentes (SQL)
    const { data: existingProfiles } = await supabase.from('profiles').select('*');
    
    const emailMap = new Map<string, any>();
    const phoneMap = new Map<string, any>();
    const nameMap = new Map<string, any>(); // Normalizado

    existingProfiles?.forEach(p => {
        if (p.email) emailMap.set(p.email.trim().toLowerCase(), p);
        if (p.whatsapp) phoneMap.set(p.whatsapp.replace(/\D/g, ''), p);
        if (p.name) nameMap.set(normalize(p.name), p);
    });

    let profilesCreated = 0;
    let profilesUpdated = 0;
    let availRecords = 0;
    let eventsMigrated = 0;
    let scheduleRecords = 0;

    // 3. Processa Migração Perfis (Upsert)
    for (const [nameKey, info] of Object.entries(mergedData)) {
        let existing = null;

        if (info.email && emailMap.has(info.email.trim().toLowerCase())) {
            existing = emailMap.get(info.email.trim().toLowerCase());
        } 
        else if (info.whatsapp && phoneMap.has(info.whatsapp.replace(/\D/g, ''))) {
            existing = phoneMap.get(info.whatsapp.replace(/\D/g, ''));
        }
        else if (nameMap.has(nameKey)) {
            existing = nameMap.get(nameKey);
        }

        let profileId = null;
        const funcsArray = Array.from(info.functions);
        const allowedArray = Array.from(info.allowedMinistries);

        if (existing) {
            profileId = existing.id;
            const currentAllowed = existing.allowed_ministries || [];
            const currentFunctions = existing.functions || [];
            
            const mergedAllowed = [...new Set([...currentAllowed, ...allowedArray])];
            const mergedFunctions = [...new Set([...currentFunctions, ...funcsArray])];

            const updates: any = {
                allowed_ministries: mergedAllowed,
                functions: mergedFunctions
            };

            if (info.email && !existing.email) updates.email = info.email;
            if (info.whatsapp && !existing.whatsapp) updates.whatsapp = info.whatsapp;
            if (info.avatar_url && !existing.avatar_url) updates.avatar_url = info.avatar_url;
            if (info.birthDate && !existing.birth_date) updates.birth_date = info.birthDate;

            if (!existing.ministry_id && allowedArray.length > 0) {
                updates.ministry_id = allowedArray[0];
            }

            await supabase.from('profiles').update(updates).eq('id', profileId);
            profilesUpdated++;
            nameMap.set(nameKey, { ...existing, ...updates });
        } else {
            const mainMinistry = allowedArray.length > 0 ? allowedArray[0] : 'midia';
            const newId = info.legacyId || crypto.randomUUID();

            const newProfile = {
                id: newId,
                name: info.originalName,
                ministry_id: mainMinistry,
                role: 'member',
                allowed_ministries: allowedArray,
                functions: funcsArray,
                email: info.email,
                whatsapp: info.whatsapp,
                avatar_url: info.avatar_url,
                birth_date: info.birthDate
            };

            const { error } = await supabase.from('profiles').insert(newProfile);
            
            if (!error) {
                profileId = newId;
                profilesCreated++;
                nameMap.set(nameKey, newProfile);
            }
        }

        if (profileId && info.availability.size > 0) {
            await supabase.from('availability').delete().eq('member_id', profileId);

            const rows = Array.from(info.availability).map(d => {
                let date = d;
                let status = 'BOTH';
                if (d.endsWith('_M')) { date = d.replace('_M', ''); status = 'M'; }
                else if (d.endsWith('_N')) { date = d.replace('_N', ''); status = 'N'; }
                
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

                return { member_id: profileId, date, status };
            }).filter(r => r !== null);

            if (rows.length > 0) {
                const { error } = await supabase.from('availability').insert(rows);
                if (!error) availRecords += rows.length;
            }
        }
    }

    // 5. MIGRAR EVENTOS E ESCALAS (Novidade)
    const today = new Date();
    const monthsToCheck = [];
    for (let i = -2; i < 7; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const mStr = d.toISOString().slice(0, 7); // YYYY-MM
        monthsToCheck.push(mStr);
    }

    for (const prefix of ALL_PREFIXES) {
        const cleanPrefix = prefix.trim().toLowerCase().replace(/\s+/g, '-');
        
        for (const month of monthsToCheck) {
            const eventKey = getStorageKey(cleanPrefix, `events_${month}`);
            const scheduleKey = getStorageKey(cleanPrefix, `schedule_${month}`);
            const attendanceKey = getStorageKey(cleanPrefix, `attendance_${month}`);
            
            const { data: eventData } = await supabase.from('app_storage').select('value').eq('key', eventKey).single();
            const { data: scheduleData } = await supabase.from('app_storage').select('value').eq('key', scheduleKey).single();
            const { data: attendanceData } = await supabase.from('app_storage').select('value').eq('key', attendanceKey).single();

            let legacyEvents: any[] = [];
            if (eventData?.value) {
                if (typeof eventData.value === 'string') {
                    try { legacyEvents = JSON.parse(eventData.value); } catch {}
                } else {
                    legacyEvents = eventData.value;
                }
            }

            let legacySchedule: Record<string, string> = {};
            if (scheduleData?.value) {
                if (typeof scheduleData.value === 'string') {
                    try { legacySchedule = JSON.parse(scheduleData.value); } catch {}
                } else {
                    legacySchedule = scheduleData.value;
                }
            }

            let legacyAttendance: Record<string, boolean> = {};
            if (attendanceData?.value) {
                if (typeof attendanceData.value === 'string') {
                    try { legacyAttendance = JSON.parse(attendanceData.value); } catch {}
                } else {
                    legacyAttendance = attendanceData.value;
                }
            }

            if (Array.isArray(legacyEvents) && legacyEvents.length > 0) {
                keysToDelete.push(eventKey);
                
                for (const evt of legacyEvents) {
                    if (!evt.date || !evt.time) continue;
                    
                    const dateTime = `${evt.date}T${evt.time}:00`;
                    
                    const { data: existingEvent } = await supabase
                        .from('events')
                        .select('id')
                        .eq('ministry_id', cleanPrefix)
                        .eq('date_time', dateTime)
                        .maybeSingle();

                    let eventId = existingEvent?.id;

                    if (!eventId) {
                        const { data: newEvent, error } = await supabase
                            .from('events')
                            .insert({
                                ministry_id: cleanPrefix,
                                title: evt.title || 'Evento',
                                date_time: dateTime,
                                description: evt.description
                            })
                            .select('id')
                            .single();
                        
                        if (!error && newEvent) {
                            eventId = newEvent.id;
                            eventsMigrated++;
                        }
                    }

                    if (eventId && legacySchedule && Object.keys(legacySchedule).length > 0) {
                        const prefixKey = `${evt.date}T${evt.time}`; 
                        const assignments = Object.entries(legacySchedule).filter(([k]) => k.startsWith(prefixKey));
                        
                        for (const [sKey, memberName] of assignments) {
                            if (!memberName) continue;
                            const role = sKey.split('_').pop() || 'Membro';
                            const normalizedMemberName = normalize(memberName as string);
                            const memberProfile = nameMap.get(normalizedMemberName);
                            const isConfirmed = legacyAttendance[sKey] || false;

                            if (memberProfile) {
                                await supabase
                                    .from('schedule_assignments')
                                    .delete()
                                    .match({ event_id: eventId, role: role });

                                const { error: assignError } = await supabase
                                    .from('schedule_assignments')
                                    .insert({
                                        event_id: eventId,
                                        member_id: memberProfile.id,
                                        role: role,
                                        confirmed: isConfirmed
                                    });
                                
                                if (!assignError) scheduleRecords++;
                            }
                        }
                    }
                }
            }

            if (Object.keys(legacySchedule).length > 0) keysToDelete.push(scheduleKey);
            if (Object.keys(legacyAttendance).length > 0) keysToDelete.push(attendanceKey);
        }
    }

    if (keysToDelete.length > 0) {
        const chunkSize = 20;
        for (let i = 0; i < keysToDelete.length; i += chunkSize) {
            const chunk = keysToDelete.slice(i, i + chunkSize);
            await supabase.from('app_storage').delete().in('key', chunk);
        }
    }

    return { 
        success: true, 
        message: `Migração Completa: ${profilesCreated} perfis criados, ${eventsMigrated} eventos e ${scheduleRecords} escalas migradas.` 
    };

  } catch (e: any) {
    console.error("Erro fatal na migração:", e);
    return { success: false, message: "Erro interno: " + e.message };
  }
};

// ============================================================================
// NEW RELATIONAL DATABASE ADAPTERS
// ============================================================================

export const createMinistryEvent = async (ministryId: string, event: { title: string, date: string, time: string }): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const dateTime = `${event.date}T${event.time}:00`;

    try {
        const { error } = await supabase.from('events').insert({
            ministry_id: cleanMid,
            title: event.title,
            date_time: dateTime
        });
        return !error;
    } catch (e) {
        console.error("Error creating event:", e);
        return false;
    }
};

export const fetchMinistryMembers = async (ministryId: string): Promise<{
    memberMap: MemberMap,
    publicList: TeamMemberProfile[]
}> => {
    if (!supabase || !ministryId) return { memberMap: {}, publicList: [] };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const validRoles = await loadData<string[]>(cleanMid, 'functions_config', DEFAULT_ROLES[cleanMid] || []);

        const { data: ministryProfiles, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);

        if (error) throw error;

        const publicList: TeamMemberProfile[] = (ministryProfiles || []).map((p: any) => ({
            id: p.id,
            name: p.name || 'Membro sem nome', 
            email: p.email || undefined,
            whatsapp: p.whatsapp,
            avatar_url: p.avatar_url,
            birthDate: p.birth_date,
            roles: p.functions || [],
            createdAt: new Date().toISOString()
        })).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

        const memberMap: MemberMap = {};
        ministryProfiles?.forEach((p: any) => {
            const funcs = p.functions || [];
            const name = p.name || 'Membro sem nome';
            funcs.forEach((role: string) => {
                if (validRoles.includes(role)) { 
                    if (!memberMap[role]) memberMap[role] = [];
                    if (!memberMap[role].includes(name)) {
                        memberMap[role].push(name);
                    }
                }
            });
        });

        return { memberMap, publicList };

    } catch (e) {
        console.error("Erro ao buscar membros (SQL):", e);
        return { memberMap: {}, publicList: [] };
    }
};

export const fetchMinistrySchedule = async (ministryId: string, monthIso: string): Promise<{ schedule: ScheduleMap, events: any[], attendance: AttendanceMap }> => {
    if (!supabase || !ministryId) return { schedule: {}, events: [], attendance: {} };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const startOfMonth = `${monthIso}-01T00:00:00`;
        const [y, m] = monthIso.split('-').map(Number);
        const nextMonth = new Date(y, m, 1).toISOString().split('T')[0];

        const { data: events, error: eventError } = await supabase
            .from('events')
            .select('id, title, date_time')
            .eq('ministry_id', cleanMid)
            .gte('date_time', startOfMonth)
            .lt('date_time', `${nextMonth}T00:00:00`)
            .order('date_time', { ascending: true });

        if (eventError) throw eventError;
        if (!events || events.length === 0) return { schedule: {}, events: [], attendance: {} };

        const eventIds = events.map(e => e.id);

        const { data: assignments, error: assignError } = await supabase
            .from('schedule_assignments')
            .select(`
                event_id,
                role,
                member_id,
                confirmed,
                profiles ( name )
            `)
            .in('event_id', eventIds);

        if (assignError) throw assignError;

        const schedule: ScheduleMap = {};
        const attendance: AttendanceMap = {};
        
        assignments?.forEach((assign: any) => {
            const event = events.find(e => e.id === assign.event_id);
            if (event && assign.profiles) {
                const isoKey = event.date_time.slice(0, 16); 
                const scheduleKey = `${isoKey}_${assign.role}`;
                schedule[scheduleKey] = assign.profiles.name;
                if (assign.confirmed) {
                    attendance[scheduleKey] = true;
                }
            }
        });

        const uiEvents = events.map(e => ({
            id: e.id,
            title: e.title,
            date: e.date_time.split('T')[0],
            time: e.date_time.split('T')[1].slice(0, 5),
            iso: e.date_time.slice(0, 16)
        }));

        return { schedule, events: uiEvents, attendance };

    } catch (e) {
        console.error("Erro ao buscar escala (SQL):", e);
        return { schedule: {}, events: [], attendance: {} };
    }
};

export const clearScheduleForMonth = async (ministryId: string, monthIso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
        const start = `${monthIso}-01T00:00:00`;
        const [y, m] = monthIso.split('-').map(Number);
        const nextMonth = new Date(y, m, 1).toISOString().split('T')[0] + 'T00:00:00';

        const { data: events } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .gte('date_time', start)
            .lt('date_time', nextMonth);

        if (!events || events.length === 0) return true;

        const ids = events.map(e => e.id);

        const { error } = await supabase
            .from('schedule_assignments')
            .delete()
            .in('event_id', ids);

        return !error;
    } catch (e) {
        console.error("Erro ao limpar escala do mês:", e);
        return false;
    }
};

export const resetToDefaultEvents = async (ministryId: string, monthIso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    try {
        const [y, m] = monthIso.split('-').map(Number);
        const startDate = `${monthIso}-01T00:00:00`;
        const nextMonthDate = new Date(y, m, 1);
        const nextMonth = nextMonthDate.toISOString().split('T')[0] + 'T00:00:00';

        const { data: eventsToDelete } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .gte('date_time', startDate)
            .lt('date_time', nextMonth);
            
        if (eventsToDelete && eventsToDelete.length > 0) {
            const ids = eventsToDelete.map(e => e.id);
            await supabase.from('schedule_assignments').delete().in('event_id', ids);
            await supabase.from('events').delete().in('id', ids);
        }

        await supabase
            .from('app_storage')
            .delete()
            .eq('key', getStorageKey(cleanMid, `ignored_events_${monthIso}`));

        const daysInMonth = new Date(y, m, 0).getDate();
        const eventsToCreate = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(y, m - 1, d);
            const dayOfWeek = date.getDay(); // 0 = Sun, 3 = Wed
            const dateStr = date.toISOString().split('T')[0];

            if (dayOfWeek === 3) {
                eventsToCreate.push({
                    ministry_id: cleanMid,
                    title: "Culto (Quarta)",
                    date_time: `${dateStr}T19:30:00`
                });
            } else if (dayOfWeek === 0) {
                eventsToCreate.push({
                    ministry_id: cleanMid,
                    title: "Culto (Domingo - Manhã)",
                    date_time: `${dateStr}T09:00:00`
                });
                eventsToCreate.push({
                    ministry_id: cleanMid,
                    title: "Culto (Domingo - Noite)",
                    date_time: `${dateStr}T18:00:00`
                });
            }
        }

        if (eventsToCreate.length > 0) {
            await supabase.from('events').insert(eventsToCreate);
        }

        return true;
    } catch (e) {
        console.error("Erro ao resetar eventos:", e);
        return false;
    }
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const formatTimestamp = (iso: string) => `${iso}:00`; 

    try {
        const { data: existingEvents } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', formatTimestamp(oldIso))
            .limit(1); 

        if (existingEvents && existingEvents.length > 0) {
            const { error } = await supabase
                .from('events')
                .update({ 
                    title: newTitle,
                    date_time: formatTimestamp(newIso)
                })
                .eq('id', existingEvents[0].id);
            return !error;
        } else {
            const { error } = await supabase
                .from('events')
                .insert({
                    ministry_id: cleanMid,
                    title: newTitle,
                    date_time: formatTimestamp(newIso)
                });
            return !error;
        }
    } catch (e) {
        console.error("Erro ao atualizar evento:", e);
        return false;
    }
};

export const deleteMinistryEvent = async (ministryId: string, iso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const dateTime = `${iso}:00`; 

    try {
        const { data: events } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', dateTime);

        if (!events || events.length === 0) return true; 

        const ids = events.map(e => e.id);

        await supabase.from('schedule_assignments').delete().in('event_id', ids);
        const { error } = await supabase.from('events').delete().in('id', ids);

        return !error;
    } catch (e) {
        console.error("Erro ao excluir evento:", e);
        return false;
    }
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const lastUnderscore = key.lastIndexOf('_');
        const isoDate = key.substring(0, lastUnderscore); 
        const role = key.substring(lastUnderscore + 1);
        const dateTime = `${isoDate}:00`; 

        let eventId = null;
        const { data: eventData } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', dateTime)
            .limit(1); 

        if (eventData && eventData.length > 0) {
            eventId = eventData[0].id;
        } else {
            if (!memberName) return true;

            const dateObj = new Date(isoDate);
            const dayOfWeek = dateObj.getDay(); 
            const hour = dateObj.getHours();
            
            let title = "Evento Extra";
            if (dayOfWeek === 3) title = "Culto (Quarta)";
            else if (dayOfWeek === 0) {
                if (hour < 13) title = "Culto (Domingo - Manhã)";
                else title = "Culto (Domingo - Noite)";
            }

            const { data: newEvent, error: createError } = await supabase
                .from('events')
                .insert({
                    ministry_id: cleanMid,
                    title: title,
                    date_time: dateTime
                })
                .select()
                .single();
            
            if (createError) throw createError;
            eventId = newEvent.id;
        }

        if (!memberName) {
            if (eventId) {
                await supabase
                    .from('schedule_assignments')
                    .delete()
                    .eq('event_id', eventId)
                    .eq('role', role);
            }
            return true;
        }

        const { data: memberData } = await supabase
            .from('profiles')
            .select('id')
            .ilike('name', memberName)
            .limit(1)
            .single();

        if (!memberData) return false; 

        await supabase
            .from('schedule_assignments')
            .delete()
            .eq('event_id', eventId)
            .eq('role', role);

        const { error: insertError } = await supabase
            .from('schedule_assignments')
            .insert({
                event_id: eventId,
                role: role,
                member_id: memberData.id
            });

        return !insertError;

    } catch (e) {
        console.error("Erro ao salvar escala:", e);
        return false;
    }
};

export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    if (Object.keys(schedule).length === 0) return true;

    try {
        const { data: allMembers } = await supabase
            .from('profiles')
            .select('id, name')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
            
        const memberMap = new Map<string, string>(); 
        if (allMembers) {
            allMembers.forEach(m => {
                if (m.name) memberMap.set(m.name.toLowerCase().trim(), m.id);
            });
        }

        const neededTimestamps = new Set<string>();
        Object.keys(schedule).forEach(key => {
            const lastUnderscore = key.lastIndexOf('_');
            const isoDate = key.substring(0, lastUnderscore); 
            neededTimestamps.add(`${isoDate}:00`); 
        });

        const { data: existingEvents } = await supabase
            .from('events')
            .select('id, date_time')
            .eq('ministry_id', cleanMid)
            .in('date_time', Array.from(neededTimestamps));

        const eventIdMap = new Map<string, string>();
        if (existingEvents) {
            existingEvents.forEach(e => eventIdMap.set(e.date_time, e.id));
        }

        const eventsToCreate = [];
        for (const ts of neededTimestamps) {
            if (!eventIdMap.has(ts)) {
                const dateObj = new Date(ts);
                const dayOfWeek = dateObj.getDay();
                const hour = dateObj.getHours();
                
                let title = "Evento Extra";
                if (dayOfWeek === 3) title = "Culto (Quarta)";
                else if (dayOfWeek === 0) {
                    if (hour < 13) title = "Culto (Domingo - Manhã)";
                    else title = "Culto (Domingo - Noite)";
                }

                eventsToCreate.push({
                    ministry_id: cleanMid,
                    title: title,
                    date_time: ts
                });
            }
        }

        if (eventsToCreate.length > 0) {
            const { data: newEvents, error: createError } = await supabase
                .from('events')
                .insert(eventsToCreate)
                .select('id, date_time');
            
            if (createError) throw createError;
            
            newEvents?.forEach(e => eventIdMap.set(e.date_time, e.id));
        }

        const assignmentsToUpsert = [];
        
        for (const [key, memberName] of Object.entries(schedule)) {
            if (!memberName) continue;
            
            const lastUnderscore = key.lastIndexOf('_');
            const isoDate = key.substring(0, lastUnderscore);
            const role = key.substring(lastUnderscore + 1);
            const ts = `${isoDate}:00`;
            
            const eventId = eventIdMap.get(ts);
            const memberId = memberMap.get(memberName.toLowerCase().trim());
            
            if (eventId && memberId) {
                assignmentsToUpsert.push({
                    event_id: eventId,
                    role: role,
                    member_id: memberId
                });
            }
        }

        if (assignmentsToUpsert.length > 0) {
            const { error: upsertError } = await supabase
                .from('schedule_assignments')
                .upsert(assignmentsToUpsert, { onConflict: 'event_id,role' }); 
            
            if (upsertError) {
                console.warn("Upsert failed, trying Delete+Insert strategy...", upsertError);
                for (const item of assignmentsToUpsert) {
                     await supabase.from('schedule_assignments').delete().match({ event_id: item.event_id, role: item.role });
                }
                await supabase.from('schedule_assignments').insert(assignmentsToUpsert);
            }
        }
        
        return true;

    } catch (e) {
        console.error("Erro no salvamento em lote:", e);
        return false;
    }
}

export const toggleAssignmentConfirmation = async (ministryId: string, key: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const lastUnderscore = key.lastIndexOf('_');
        const isoDate = key.substring(0, lastUnderscore); 
        const role = key.substring(lastUnderscore + 1);
        const dateTime = `${isoDate}:00`;

        const { data: eventData } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', dateTime)
            .limit(1);

        if (!eventData || eventData.length === 0) return false;
        const eventId = eventData[0].id;

        const { data: assignment } = await supabase
            .from('schedule_assignments')
            .select('id, confirmed')
            .eq('event_id', eventId)
            .eq('role', role)
            .single();

        if (!assignment) return false;

        const { error } = await supabase
            .from('schedule_assignments')
            .update({ confirmed: !assignment.confirmed })
            .eq('id', assignment.id);

        return !error;

    } catch (e) {
        console.error("Erro ao confirmar presença:", e);
        return false;
    }
};

export const fetchMinistryAvailability = async (ministryId: string): Promise<AvailabilityMap> => {
    if (!supabase || !ministryId) return {};
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: availData, error } = await supabase
            .from('availability')
            .select(`
                date,
                status,
                member_id,
                profiles!inner ( id, name, ministry_id, allowed_ministries )
            `);

        const relevantData = availData?.filter((row: any) => {
            const p = row.profiles;
            return p.ministry_id === cleanMid || (p.allowed_ministries && p.allowed_ministries.includes(cleanMid));
        });

        const availability: AvailabilityMap = {};

        relevantData?.forEach((row: any) => {
            const name = row.profiles.name || 'Membro sem nome';
            if (!availability[name]) availability[name] = [];
            
            let dateStr = row.date;
            if (row.status === 'M') dateStr += '_M';
            else if (row.status === 'N') dateStr += '_N';
            
            availability[name].push(dateStr);
        });

        return availability;

    } catch (e) {
        console.error("Erro ao buscar disponibilidade (SQL):", e);
        return {};
    }
};

export const saveMemberAvailability = async (userId: string, memberName: string, dates: string[]) => {
    if (!supabase) return false;

    try {
        const { data: member } = await supabase
            .from('profiles')
            .select('id')
            .ilike('name', memberName)
            .single();

        if (!member) return false;

        const rows = dates.map(d => {
            let date = d;
            let status = 'BOTH';
            if (d.endsWith('_M')) { date = d.replace('_M', ''); status = 'M'; }
            else if (d.endsWith('_N')) { date = d.replace('_N', ''); status = 'N'; }
            
            return { member_id: member.id, date, status };
        });

        await supabase.from('availability').delete().eq('member_id', member.id);
        
        if (rows.length > 0) {
            await supabase.from('availability').insert(rows);
        }

        return true;
    } catch (e) {
        console.error("Erro ao salvar disponibilidade:", e);
        return false;
    }
};

export const fetchGlobalSchedules = async (currentMonth: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase) return {};
    
    const start = `${currentMonth}-01T00:00:00`;
    const [y, m] = currentMonth.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString().split('T')[0] + 'T00:00:00';

    try {
        const { data, error } = await supabase
            .from('schedule_assignments')
            .select(`
                role,
                events!inner (
                    date_time,
                    ministry_id
                ),
                profiles!inner (
                    name
                )
            `)
            .gte('events.date_time', start)
            .lt('events.date_time', nextMonth)
            .neq('events.ministry_id', currentMinistryId); 

        if (error) throw error;

        const conflicts: GlobalConflictMap = {};

        data?.forEach((row: any) => {
            const name = row.profiles.name;
            if (!name) return;
            
            const normalized = name.trim().toLowerCase();
            if (!conflicts[normalized]) conflicts[normalized] = [];
            
            const conflict: GlobalConflict = {
                ministryId: row.events.ministry_id,
                eventIso: row.events.date_time.slice(0, 16),
                role: row.role
            };
            
            conflicts[normalized].push(conflict);
        });

        return conflicts;

    } catch (e) {
        console.error("Erro ao buscar conflitos globais:", e);
        return {};
    }
};

export const logout = async () => {
    if (supabase) await supabase.auth.signOut();
};

export const loginWithEmail = async (email: string, pass: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    return { success: !error, message: error?.message || "" };
};

export const loginWithGoogle = async () => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    return { success: !error, message: error?.message || "" };
};

export const syncMemberProfile = async (ministryId: string, user: User) => {
    if (!supabase || !user.id) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: existing, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        const allowed = user.allowedMinistries || [cleanMid];
        if (!allowed.includes(cleanMid)) allowed.push(cleanMid);
        
        let newAllowed = [...allowed];
        let newFunctions = user.functions || [];

        if (existing) {
            const existingAllowed = existing.allowed_ministries || [];
            const existingFunctions = existing.functions || [];
            
            newAllowed = [...new Set([...existingAllowed, ...allowed])];
            newFunctions = [...new Set([...existingFunctions, ...newFunctions])];
            
            await supabase.from('profiles').update({
                allowed_ministries: newAllowed,
                functions: newFunctions,
                avatar_url: user.avatar_url || existing.avatar_url,
                whatsapp: existing.whatsapp || user.whatsapp,
                birth_date: existing.birth_date || user.birthDate
            }).eq('id', user.id);
        } else {
            await supabase.from('profiles').insert({
                id: user.id,
                name: user.name || 'Novo Usuário',
                email: user.email,
                ministry_id: cleanMid,
                allowed_ministries: newAllowed,
                functions: newFunctions,
                role: 'member',
                avatar_url: user.avatar_url,
                whatsapp: user.whatsapp
            });
        }
    } catch (e) {
        console.error("Sync profile error:", e);
    }
};

export const registerWithEmail = async (email: string, pass: string, name: string, ministries: string[], whatsapp?: string, roles?: string[]) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
            data: {
                name,
                ministryId: ministries[0] || 'midia',
                allowedMinistries: ministries,
                whatsapp,
                functions: roles
            }
        }
    });

    if (error) return { success: false, message: error.message };

    if (data.user) {
        await syncMemberProfile(ministries[0] || 'midia', {
            id: data.user.id,
            email,
            name,
            role: 'member',
            ministryId: ministries[0],
            allowedMinistries: ministries,
            whatsapp,
            functions: roles
        });
    }

    return { success: true, message: "Conta criada com sucesso!" };
};

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '?reset=true',
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Link de recuperação enviado para o e-mail." };
};

export const updateUserProfile = async (name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, ministryId?: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado" };

    try {
        const updates: any = {
            name,
            whatsapp,
            avatar_url,
            functions,
            birth_date: birthDate
        };
        
        await supabase.auth.updateUser({
            data: updates
        });

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (error) throw error;
        
        return { success: true, message: "Perfil atualizado!" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const joinMinistry = async (newMinistryId: string, roles: string[]): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão." };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Usuário não logado." };

    try {
        const cleanMid = newMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('allowed_ministries, functions')
            .eq('id', user.id)
            .single();
            
        if (!profile) return { success: false, message: "Perfil não encontrado." };

        const currentAllowed = profile.allowed_ministries || [];
        const currentFunctions = profile.functions || [];

        if (currentAllowed.includes(cleanMid)) {
             return { success: false, message: "Você já faz parte deste ministério." };
        }

        const newAllowed = [...currentAllowed, cleanMid];
        const newFunctions = [...new Set([...currentFunctions, ...roles])];

        await supabase
            .from('profiles')
            .update({ 
                allowed_ministries: newAllowed,
                functions: newFunctions
            })
            .eq('id', user.id);
            
        await supabase.auth.updateUser({
            data: { allowedMinistries: newAllowed, functions: newFunctions }
        });

        return { success: true, message: "Bem-vindo ao novo ministério!" };

    } catch (e: any) {
        console.error(e);
        return { success: false, message: "Erro ao entrar no ministério." };
    }
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    if (!supabase) return;
    try {
        await supabase.from('availability').delete().eq('member_id', memberId);
        await supabase.from('schedule_assignments').delete().eq('member_id', memberId);
        await supabase.from('profiles').delete().eq('id', memberId);
    } catch (e) {
        console.error("Erro ao deletar membro:", e);
    }
};

export const toggleAdmin = async (ministryId: string, email: string) => {
    if (!supabase || !ministryId) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const admins = await loadData<string[]>(cleanMid, 'admins_list', []);
    let newAdmins;
    if (admins.includes(email)) {
        newAdmins = admins.filter(e => e !== email);
    } else {
        newAdmins = [...admins, email];
    }
    await saveData(cleanMid, 'admins_list', newAdmins);
};

export const saveSubscription = async (ministryId: string, sub: PushSubscription) => {
    if (!supabase || !ministryId) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const currentSubs = await loadData<PushSubscriptionRecord[]>(cleanMid, 'push_subscriptions_v1', []);
    
    const subJSON = sub.toJSON();
    const newRecord: PushSubscriptionRecord = {
        endpoint: sub.endpoint,
        keys: {
            p256dh: subJSON.keys?.p256dh || '',
            auth: subJSON.keys?.auth || ''
        },
        device_id: getDeviceId(),
        last_updated: new Date().toISOString()
    };

    const filtered = currentSubs.filter(s => s.device_id !== newRecord.device_id);
    filtered.push(newRecord);

    await saveData(cleanMid, 'push_subscriptions_v1', filtered);
};

const getDeviceId = () => {
    let id = localStorage.getItem('device_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('device_id', id);
    }
    return id;
};

export const sendNotification = async (ministryId: string, payload: { title: string; message: string; type?: string; actionLink?: string }) => {
    if (!supabase) return;
    
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const currentNotifs = await loadData<AppNotification[]>(cleanMid, 'notifications_v1', []);
    const newNotif: AppNotification = {
        id: Date.now().toString(),
        type: (payload.type as any) || 'info',
        title: payload.title,
        message: payload.message,
        timestamp: new Date().toISOString(),
        read: false,
        actionLink: payload.actionLink
    };
    await saveData(cleanMid, 'notifications_v1', [newNotif, ...currentNotifs].slice(0, 50));

    try {
        await supabase.functions.invoke('push-notification', {
            body: {
                ministryId: cleanMid,
                title: payload.title,
                message: payload.message,
                type: payload.type,
                actionLink: payload.actionLink
            }
        });
    } catch (e) {
        console.error("Erro ao chamar Edge Function:", e);
    }
};

export const markNotificationsRead = async (ministryId: string, ids: string[]) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const notifs = await loadData<AppNotification[]>(cleanMid, 'notifications_v1', []);
    const updated = notifs.map(n => ids.includes(n.id) ? { ...n, read: true } : n);
    await saveData(cleanMid, 'notifications_v1', updated);
    return updated;
};

export const clearAllNotifications = async (ministryId: string) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    await saveData(cleanMid, 'notifications_v1', []);
};

export const createSwapRequest = async (ministryId: string, request: SwapRequest) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const requests = await loadData<SwapRequest[]>(cleanMid, 'swap_requests_v1', []);
    requests.unshift(request);
    return await saveData(cleanMid, 'swap_requests_v1', requests);
};

export const performSwap = async (ministryId: string, requestId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    const requests = await loadData<SwapRequest[]>(cleanMid, 'swap_requests_v1', []);
    const reqIndex = requests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) return { success: false, message: "Solicitação não encontrada." };
    
    const req = requests[reqIndex];
    if (req.status !== 'pending') return { success: false, message: "Solicitação já processada." };
    
    req.status = 'completed';
    req.takenByName = takerName;
    requests[reqIndex] = req;
    await saveData(cleanMid, 'swap_requests_v1', requests);

    const eventIso = req.eventIso; 
    const role = req.role;
    const dateTime = `${eventIso}:00`;
    
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).eq('date_time', dateTime).single();
    if (!event) return { success: false, message: "Evento não encontrado no banco." };

    await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
    await supabase.from('schedule_assignments').insert({
        event_id: event.id,
        role: role,
        member_id: takerId
    });

    await sendNotification(ministryId, {
        type: 'success',
        title: 'Troca Realizada',
        message: `${takerName} assumiu a escala de ${req.requesterName} em ${req.eventTitle}.`
    });

    return { success: true, message: "Troca realizada com sucesso!" };
};

export const createAnnouncement = async (ministryId: string, data: Omit<Announcement, 'id' | 'timestamp' | 'readBy' | 'likedBy' | 'author'>, authorName: string) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const announcements = await loadData<Announcement[]>(cleanMid, 'announcements_v1', []);
    const newAnn: Announcement = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        readBy: [],
        likedBy: [],
        author: authorName,
        ...data
    };
    announcements.unshift(newAnn);
    return await saveData(cleanMid, 'announcements_v1', announcements);
};

export const markAnnouncementRead = async (ministryId: string, id: string, user: User) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const list = await loadData<Announcement[]>(cleanMid, 'announcements_v1', []);
    const updated = list.map(a => {
        if (a.id === id && !a.readBy.some(r => r.userId === user.id)) {
            return { 
                ...a, 
                readBy: [...a.readBy, { userId: user.id || 'anon', name: user.name, timestamp: new Date().toISOString() }] 
            };
        }
        return a;
    });
    await saveData(cleanMid, 'announcements_v1', updated);
    return updated;
};

export const toggleAnnouncementLike = async (ministryId: string, id: string, user: User) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const list = await loadData<Announcement[]>(cleanMid, 'announcements_v1', []);
    const updated = list.map(a => {
        if (a.id === id) {
            const hasLiked = a.likedBy?.some(l => l.userId === user.id);
            let newLikes = a.likedBy || [];
            if (hasLiked) {
                newLikes = newLikes.filter(l => l.userId !== user.id);
            } else {
                newLikes = [...newLikes, { userId: user.id || 'anon', name: user.name, timestamp: new Date().toISOString() }];
            }
            return { ...a, likedBy: newLikes };
        }
        return a;
    });
    await saveData(cleanMid, 'announcements_v1', updated);
    return updated;
};
