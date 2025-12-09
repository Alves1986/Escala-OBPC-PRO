import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    GlobalConflict, DEFAULT_ROLES 
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
        // 1. Fetch all profiles
        const { data: profiles, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        if (!profiles || profiles.length === 0) return { success: false, message: "Nenhum perfil encontrado." };

        // 2. Group by Normalized Email
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

        // 3. Process duplicates
        for (const [email, duplicates] of emailMap.entries()) {
            if (duplicates.length > 1) {
                console.log(`Duplicata encontrada para ${email}: ${duplicates.length} perfis.`);
                
                // Sort to pick the "Master" (Prefer the one with Google Avatar or most recently created/updated logic)
                const sorted = duplicates.sort((a, b) => {
                    if (a.avatar_url && !b.avatar_url) return -1;
                    if (!a.avatar_url && b.avatar_url) return 1;
                    return 0;
                });

                const master = sorted[0];
                const slaves = sorted.slice(1);

                for (const slave of slaves) {
                    console.log(`Mesclando ${slave.id} em ${master.id}...`);

                    // A. Move Availability
                    await supabase.from('availability').update({ member_id: master.id }).eq('member_id', slave.id);
                    
                    // B. Move Schedule Assignments
                    await supabase.from('schedule_assignments').update({ member_id: master.id }).eq('member_id', slave.id);
                    
                    // C. Merge Arrays (Allowed Ministries & Functions)
                    const masterAllowed = master.allowed_ministries || [];
                    const slaveAllowed = slave.allowed_ministries || [];
                    const mergedAllowed = [...new Set([...masterAllowed, ...slaveAllowed])];

                    const masterFuncs = master.functions || [];
                    const slaveFuncs = slave.functions || [];
                    const mergedFuncs = [...new Set([...masterFuncs, ...slaveFuncs])];

                    // D. Update Master Profile
                    await supabase.from('profiles').update({
                        allowed_ministries: mergedAllowed,
                        functions: mergedFuncs,
                        whatsapp: master.whatsapp || slave.whatsapp, // Keep master phone, fallback to slave
                        birth_date: master.birth_date || slave.birth_date
                    }).eq('id', master.id);

                    // E. Delete Slave Profile
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

// ============================================================================
// MIGRATION TOOL (V1 -> V2) - GLOBAL SCAN VERSION
// ============================================================================

export const migrateLegacyData = async (currentMinistryId: string): Promise<{ success: boolean; message: string }> => {
  if (!supabase) return { success: false, message: "Erro de conexão." };

  try {
    console.log("Iniciando migração GLOBAL de dados legados...");

    // Lista de prefixos para varrer (garante que pega dados de Louvor, Midia, etc, independente de onde o admin está)
    const ALL_PREFIXES = ['midia', 'louvor', 'infantil', 'recepcao', 'teatro', 'diaconia', 'unigente', 'adolescentes'];
    
    // Helper de Normalização (Remove acentos, espaços extras e minúsculas)
    const normalize = (s: string) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";

    // Estrutura para unificar dados antes de gravar
    interface LegacyMemberInfo {
        originalName: string;
        functions: Set<string>;
        availability: Set<string>;
        allowedMinistries: Set<string>; // Novo: Coleta onde o membro existia
        email?: string;
        whatsapp?: string;
        avatar_url?: string;
        birthDate?: string;
        legacyId?: string; // ID antigo se houver
    }
    const mergedData: Record<string, LegacyMemberInfo> = {};

    // Helper para adicionar dados ao mapa unificado
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
        
        // Marca que esse usuário existia nesse ministério
        mergedData[key].allowedMinistries.add(ministrySource);

        // Atualiza nome original se o atual for "mais completo" (ex: tem sobrenome)
        if (name.length > mergedData[key].originalName.length) {
            mergedData[key].originalName = name;
        }

        if (role) mergedData[key].functions.add(role);
        if (dates) dates.forEach(d => mergedData[key].availability.add(d));

        // Incorpora detalhes extras se fornecidos (Prioridade para dados existentes na lista pública)
        if (details) {
            if (details.email && !mergedData[key].email) mergedData[key].email = details.email;
            if (details.whatsapp && !mergedData[key].whatsapp) mergedData[key].whatsapp = details.whatsapp;
            if (details.avatar_url && !mergedData[key].avatar_url) mergedData[key].avatar_url = details.avatar_url;
            if (details.birthDate && !mergedData[key].birthDate) mergedData[key].birthDate = details.birthDate;
            if (details.legacyId && !mergedData[key].legacyId) mergedData[key].legacyId = details.legacyId;
        }
    };

    // --- VARREDURA GLOBAL DOS DADOS LEGADOS ---
    for (const prefix of ALL_PREFIXES) {
        // 1. Carregar Dados deste prefixo
        const avail1 = await loadData<AvailabilityMap>(prefix, 'availability', {});
        const avail2 = await loadData<AvailabilityMap>(prefix, 'availability_v1', {});
        const legacyMemberMap = await loadData<MemberMap>(prefix, 'members_v7', {});
        const legacyMembersList = await loadData<any[]>(prefix, 'public_members_list', []);

        // A. Processar Disponibilidade
        const legacyAvail = { ...avail1, ...avail2 };
        if (legacyAvail) {
            Object.entries(legacyAvail).forEach(([name, dates]) => {
                if (Array.isArray(dates)) addData(prefix, name, undefined, dates);
            });
        }

        // B. Processar Mapa de Funções
        if (legacyMemberMap) {
            Object.entries(legacyMemberMap).forEach(([role, members]) => {
                if (Array.isArray(members)) members.forEach(name => addData(prefix, name, role));
            });
        }

        // C. Processar Lista Pública (Contém Email, Whats, Avatar, etc)
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

                addData(prefix, name, undefined, undefined, details);
                roles.forEach((r: string) => addData(prefix, name, r));
            });
        }
    }

    if (Object.keys(mergedData).length === 0) {
        return { success: false, message: "Nenhum dado antigo encontrado." };
    }

    // --- ETAPA DE DEDUPLICAÇÃO NO SQL ---
    // Verifica se já existem usuários duplicados no banco (ex: mesmo email mas IDs diferentes) e mescla.
    const { data: allProfiles } = await supabase.from('profiles').select('*');
    if (allProfiles && allProfiles.length > 0) {
        const uniqueMap = new Map<string, any>();
        
        for (const p of allProfiles) {
            // Chave única: E-mail ou Telefone (limpo)
            let uniqueKey = null;
            if (p.email) uniqueKey = `email:${p.email.trim().toLowerCase()}`;
            else if (p.whatsapp) uniqueKey = `phone:${p.whatsapp.replace(/\D/g, '')}`;
            
            if (uniqueKey) {
                if (uniqueMap.has(uniqueKey)) {
                    // Duplicata encontrada! Mesclar no perfil "master" (o primeiro encontrado)
                    const master = uniqueMap.get(uniqueKey);
                    console.log(`Mesclando duplicado detectado: ${p.name} -> ${master.name}`);
                    
                    // 1. Atualizar referências
                    await supabase.from('availability').update({ member_id: master.id }).eq('member_id', p.id);
                    await supabase.from('schedule_assignments').update({ member_id: master.id }).eq('member_id', p.id);
                    
                    // 2. Apagar o perfil duplicado
                    await supabase.from('profiles').delete().eq('id', p.id);
                } else {
                    uniqueMap.set(uniqueKey, p);
                }
            }
        }
    }

    // --- ETAPA DE IMPORTAÇÃO/ATUALIZAÇÃO ---
    // Recarrega perfis após a limpeza
    const { data: existingProfiles } = await supabase.from('profiles').select('*');
    
    // Cria mapas de busca para encontrar perfis existentes de forma robusta
    const emailMap = new Map<string, any>();
    const phoneMap = new Map<string, any>();
    const nameMap = new Map<string, any>();

    existingProfiles?.forEach(p => {
        if (p.email) emailMap.set(p.email.trim().toLowerCase(), p);
        if (p.whatsapp) phoneMap.set(p.whatsapp.replace(/\D/g, ''), p);
        if (p.name) nameMap.set(normalize(p.name), p);
    });

    let profilesCreated = 0;
    let profilesUpdated = 0;
    let availRecords = 0;

    for (const [nameKey, info] of Object.entries(mergedData)) {
        let existing = null;

        // Tenta encontrar perfil existente na ordem: Email > Telefone > Nome
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
            // Perfil já existe -> Atualizar (Merge)
            profileId = existing.id;
            const currentAllowed = existing.allowed_ministries || [];
            const currentFunctions = existing.functions || [];
            
            const mergedAllowed = [...new Set([...currentAllowed, ...allowedArray])];
            const mergedFunctions = [...new Set([...currentFunctions, ...funcsArray])];

            const updates: any = {
                allowed_ministries: mergedAllowed,
                functions: mergedFunctions
            };

            // Só sobrescreve se o dado existente for vazio e o legado tiver valor
            if (info.email && !existing.email) updates.email = info.email;
            if (info.whatsapp && !existing.whatsapp) updates.whatsapp = info.whatsapp;
            if (info.avatar_url && !existing.avatar_url) updates.avatar_url = info.avatar_url;
            if (info.birthDate && !existing.birth_date) updates.birth_date = info.birthDate;

            // Se não tiver ministério principal, define um
            if (!existing.ministry_id && allowedArray.length > 0) {
                updates.ministry_id = allowedArray[0];
            }

            await supabase.from('profiles').update(updates).eq('id', profileId);
            profilesUpdated++;
        } else {
            // Perfil não existe -> Criar
            const mainMinistry = allowedArray.length > 0 ? allowedArray[0] : 'midia';
            const newId = info.legacyId || crypto.randomUUID(); // Usa ID antigo se disponível ou gera novo

            const { error } = await supabase
                .from('profiles')
                .insert({
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
                });
            
            if (!error) {
                profileId = newId;
                profilesCreated++;
            } else {
                console.error(`Erro ao criar perfil para ${info.originalName}:`, error);
            }
        }

        // 4. Salvar Disponibilidade Recuperada
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

    return { 
        success: true, 
        message: `Migração Inteligente: ${profilesCreated} novos, ${profilesUpdated} atualizados/mesclados, ${availRecords} dias recuperados.` 
    };

  } catch (e: any) {
    console.error("Erro fatal na migração:", e);
    return { success: false, message: "Erro interno: " + e.message };
  }
};

// ============================================================================
// NEW RELATIONAL DATABASE ADAPTERS
// ============================================================================

// --- MEMBERS (PROFILES) ---

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

// --- SCHEDULE & EVENTS ---

export const fetchMinistrySchedule = async (ministryId: string, monthIso: string): Promise<{ schedule: ScheduleMap, events: any[] }> => {
    if (!supabase || !ministryId) return { schedule: {}, events: [] };
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
            .lt('date_time', `${nextMonth}T00:00:00`);

        if (eventError) throw eventError;
        if (!events || events.length === 0) return { schedule: {}, events: [] };

        const eventIds = events.map(e => e.id);

        const { data: assignments, error: assignError } = await supabase
            .from('schedule_assignments')
            .select(`
                event_id,
                role,
                member_id,
                profiles ( name )
            `)
            .in('event_id', eventIds);

        if (assignError) throw assignError;

        const schedule: ScheduleMap = {};
        
        assignments?.forEach((assign: any) => {
            const event = events.find(e => e.id === assign.event_id);
            if (event && assign.profiles) {
                const isoKey = event.date_time.slice(0, 16); // YYYY-MM-DDTHH:mm
                const scheduleKey = `${isoKey}_${assign.role}`;
                schedule[scheduleKey] = assign.profiles.name;
            }
        });

        // Convert events for UI
        const uiEvents = events.map(e => ({
            id: e.id,
            title: e.title,
            date: e.date_time.split('T')[0],
            time: e.date_time.split('T')[1].slice(0, 5)
        }));

        return { schedule, events: uiEvents };

    } catch (e) {
        console.error("Erro ao buscar escala (SQL):", e);
        return { schedule: {}, events: [] };
    }
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    // Converte ISO local para timestamp with time zone (assumindo UTC ou local)
    const formatTimestamp = (iso: string) => `${iso}:00`; 

    try {
        // Tenta buscar o evento existente pelo horário antigo
        const { data: existingEvent } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', formatTimestamp(oldIso))
            .single();

        if (existingEvent) {
            // Atualiza evento existente
            const { error } = await supabase
                .from('events')
                .update({ 
                    title: newTitle,
                    date_time: formatTimestamp(newIso)
                })
                .eq('id', existingEvent.id);
            return !error;
        } else {
            // Se não existe (era um evento virtual gerado pelo frontend), cria um novo no banco
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

// --- SINGLE ASSIGNMENT SAVE (Legacy/Individual) ---
export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        // key format: "2023-10-01T19:30_Role"
        const lastUnderscore = key.lastIndexOf('_');
        const isoDate = key.substring(0, lastUnderscore); // YYYY-MM-DDTHH:mm
        const role = key.substring(lastUnderscore + 1);
        const dateTime = `${isoDate}:00`;

        // 1. Find or Create Event
        let eventId = null;
        const { data: eventData } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .eq('date_time', dateTime)
            .single();

        if (eventData) {
            eventId = eventData.id;
        } else {
            // Create Event (Heuristic for Title)
            const dateObj = new Date(isoDate);
            const dayOfWeek = dateObj.getDay(); // 0 = Sun, 3 = Wed
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

        // 2. Find Member ID
        if (!memberName) {
            // Delete assignment if memberName is empty
            await supabase
                .from('schedule_assignments')
                .delete()
                .eq('event_id', eventId)
                .eq('role', role);
            return true;
        }

        const { data: memberData } = await supabase
            .from('profiles')
            .select('id')
            .ilike('name', memberName) // Case-insensitive match
            .limit(1)
            .single();

        if (!memberData) {
            console.error("Member not found in DB:", memberName);
            return false; 
        }

        // 3. Upsert Assignment
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

// --- BULK ASSIGNMENT SAVE (For AI/Batch Operations) ---
export const saveScheduleBulk = async (ministryId: string, schedule: ScheduleMap): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    if (Object.keys(schedule).length === 0) return true;

    try {
        console.log("Iniciando salvamento em lote...");
        
        // 1. Cache All Members for Fast Lookup
        const { data: allMembers } = await supabase
            .from('profiles')
            .select('id, name')
            .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`);
            
        const memberMap = new Map<string, string>(); // Name -> ID
        if (allMembers) {
            allMembers.forEach(m => {
                if (m.name) memberMap.set(m.name.toLowerCase().trim(), m.id);
            });
        }

        // 2. Cache Existing Events or Create Necessary Ones
        const neededTimestamps = new Set<string>();
        Object.keys(schedule).forEach(key => {
            const lastUnderscore = key.lastIndexOf('_');
            const isoDate = key.substring(0, lastUnderscore); // YYYY-MM-DDTHH:mm
            neededTimestamps.add(`${isoDate}:00`);
        });

        const { data: existingEvents } = await supabase
            .from('events')
            .select('id, date_time')
            .eq('ministry_id', cleanMid)
            .in('date_time', Array.from(neededTimestamps));

        const eventIdMap = new Map<string, string>(); // DateTime -> ID
        if (existingEvents) {
            existingEvents.forEach(e => eventIdMap.set(e.date_time, e.id));
        }

        // Create missing events
        const eventsToCreate = [];
        for (const ts of neededTimestamps) {
            if (!eventIdMap.has(ts)) {
                // Heuristic for Title
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

        // 3. Prepare Batch Upserts for Assignments
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
        
        console.log(`Salvo em lote: ${assignmentsToUpsert.length} escalas.`);
        return true;

    } catch (e) {
        console.error("Erro no salvamento em lote:", e);
        return false;
    }
}

// --- AVAILABILITY ---

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
        // 1. Resolve Member ID
        const { data: member } = await supabase
            .from('profiles')
            .select('id')
            .ilike('name', memberName)
            .single();

        if (!member) return false;

        // 2. Prepare Data
        const rows = dates.map(d => {
            let date = d;
            let status = 'BOTH';
            if (d.endsWith('_M')) { date = d.replace('_M', ''); status = 'M'; }
            else if (d.endsWith('_N')) { date = d.replace('_N', ''); status = 'N'; }
            
            return { member_id: member.id, date, status };
        });

        // 3. Replace Data
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

// --- GLOBAL CONFLICTS ---

export const fetchGlobalSchedules = async (currentMonth: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase) return {};
    
    // YYYY-MM
    const start = `${currentMonth}-01T00:00:00`;
    // Calculate end of month
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
            .neq('events.ministry_id', currentMinistryId); // Exclude current ministry

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

// ============================================================================
// SHARED UTILITIES
// ============================================================================

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
    
    // CORREÇÃO CRÍTICA: Força o redirecionamento para a URL correta configurada no Supabase
    // Isso evita que o Google redirecione para URLs de preview da Vercel que não estão na allowlist
    const productionURL = "https://escalaobpcpro.vercel.app";
    
    // Usa a URL de produção se estiver em ambiente online, senão usa localhost
    const redirectUrl = window.location.hostname === 'localhost' 
        ? window.location.origin 
        : productionURL;

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl
        }
    });
    return { success: !error, message: error?.message || "" };
};

// Critical fix for User 131392d8... issue: Ensure profile exists
export const syncMemberProfile = async (ministryId: string, user: User) => {
    if (!supabase || !user.id) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: existing, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        // Prepare safe arrays
        const allowed = user.allowedMinistries || [cleanMid];
        if (!allowed.includes(cleanMid)) allowed.push(cleanMid);
        
        // Merge logic
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
            // Create New Profile
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
    
    // 1. Sign Up Auth
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
        // 2. Create Profile immediately
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
        
        // Update Metadata (for session consistency)
        await supabase.auth.updateUser({
            data: updates
        });

        // Update SQL Profile
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
        
        // Fetch current profile
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

        // Update Profile
        await supabase
            .from('profiles')
            .update({ 
                allowed_ministries: newAllowed,
                functions: newFunctions
            })
            .eq('id', user.id);
            
        // Update Auth Metadata
        await supabase.auth.updateUser({
            data: { allowedMinistries: newAllowed, functions: newFunctions }
        });

        return { success: true, message: "Bem-vindo ao novo ministério!" };

    } catch (e: any) {
        console.error(e);
        return { success: false, message: "Erro ao entrar no ministério." };
    }
};

// Aggressive Delete: Removes user from all tables to prevent constraints/orphans
export const deleteMember = async (ministryId: string, memberId: string, memberName: string) => {
    if (!supabase) return;
    try {
        // 1. Delete Availability
        await supabase.from('availability').delete().eq('member_id', memberId);
        
        // 2. Delete Schedule Assignments
        await supabase.from('schedule_assignments').delete().eq('member_id', memberId);
        
        // 3. Delete Profile
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

// --- NOTIFICATIONS (PWA) ---
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

// --- SWAP REQUESTS (V1 Style) ---
export const createSwapRequest = async (ministryId: string, request: SwapRequest) => {
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    const requests = await loadData<SwapRequest[]>(cleanMid, 'swap_requests_v1', []);
    requests.unshift(request);
    return await saveData(cleanMid, 'swap_requests_v1', requests);
};

export const performSwap = async (ministryId: string, requestId: string, takerName: string, takerId: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');
    
    // 1. Update Request
    const requests = await loadData<SwapRequest[]>(cleanMid, 'swap_requests_v1', []);
    const reqIndex = requests.findIndex(r => r.id === requestId);
    if (reqIndex === -1) return { success: false, message: "Solicitação não encontrada." };
    
    const req = requests[reqIndex];
    if (req.status !== 'pending') return { success: false, message: "Solicitação já processada." };
    
    req.status = 'completed';
    req.takenByName = takerName;
    requests[reqIndex] = req;
    await saveData(cleanMid, 'swap_requests_v1', requests);

    // 2. Update Schedule SQL
    const eventIso = req.eventIso; // YYYY-MM-DDTHH:mm
    const role = req.role;
    const dateTime = `${eventIso}:00`;
    
    // Find Event
    const { data: event } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).eq('date_time', dateTime).single();
    if (!event) return { success: false, message: "Evento não encontrado no banco." };

    // Update Assignment
    await supabase.from('schedule_assignments').delete().eq('event_id', event.id).eq('role', role);
    await supabase.from('schedule_assignments').insert({
        event_id: event.id,
        role: role,
        member_id: takerId
    });

    // Notify
    await sendNotification(ministryId, {
        type: 'success',
        title: 'Troca Realizada',
        message: `${takerName} assumiu a escala de ${req.requesterName} em ${req.eventTitle}.`
    });

    return { success: true, message: "Troca realizada com sucesso!" };
};

// --- ANNOUNCEMENTS (V1 Style) ---
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
