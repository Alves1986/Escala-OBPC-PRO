import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
    SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, 
    AppNotification, TeamMemberProfile, AvailabilityMap, SwapRequest, 
    ScheduleMap, RepertoireItem, Announcement, GlobalConflictMap, 
    KNOWN_MINISTRIES, GlobalConflict, DatabaseProfile, DatabaseEvent, DatabaseAssignment 
} from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getStorageKey = (ministryId: string, suffix: string) => `${ministryId}_${suffix}`;

export const getSupabase = () => supabase;

// --- LEGACY KEY-VALUE HELPERS (For configs, logs, announcements) ---
// Mantido para dados que ainda não foram migrados para tabelas próprias
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
        // Busca profiles que têm este ministério no array allowed_ministries (ou ministry_id legado)
        // A lógica OR abaixo garante que se o usuário for do "louvor" mas tiver "midia" no array, ele aparece
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*');

        if (error) throw error;

        // Filtra membros deste ministério no lado do cliente (para simplificar query array)
        // Lógica de filtro aprimorada:
        // 1. Membro Primary: ministry_id é o atual -> Mostra sempre
        // 2. Membro Visitante: allowed_ministries inclui o atual -> Mostra SOMENTE se tiver função compatível
        const ministryProfiles = profiles.filter((p: any) => {
            const allowed = p.allowed_ministries || [];
            const isPrimary = p.ministry_id === cleanMid;
            const isAllowed = allowed.includes(cleanMid);
            
            if (isPrimary) return true;
            if (!isAllowed) return false;

            // Para visitantes, verifica se tem função válida no ministério atual
            // Isso evita que alguém da "Mídia" apareça no "Louvor" se não for músico
            // Se o app não tiver config de funções carregada aqui, assume que mostra.
            // Para ser robusto, verificamos se functions não está vazio.
            const hasFunctions = p.functions && p.functions.length > 0;
            return hasFunctions; 
        });

        // 1. Constroi Public List
        const publicList: TeamMemberProfile[] = ministryProfiles.map((p: any) => ({
            id: p.id,
            name: p.name,
            email: p.email || undefined, // Agora lê o email do banco
            whatsapp: p.whatsapp,
            avatar_url: p.avatar_url,
            birthDate: p.birth_date,
            roles: p.functions || [],
            createdAt: new Date().toISOString()
        })).sort((a, b) => a.name.localeCompare(b.name));

        // 2. Constroi Member Map (Agrupado por Função)
        const memberMap: MemberMap = {};
        ministryProfiles.forEach((p: any) => {
            const funcs = p.functions || [];
            funcs.forEach((role: string) => {
                if (!memberMap[role]) memberMap[role] = [];
                if (!memberMap[role].includes(p.name)) {
                    memberMap[role].push(p.name);
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

        // 1. Buscar Eventos do Mês
        const { data: events, error: eventError } = await supabase
            .from('events')
            .select('id, title, date_time')
            .eq('ministry_id', cleanMid)
            .gte('date_time', startOfMonth)
            .lt('date_time', `${nextMonth}T00:00:00`);

        if (eventError) throw eventError;
        if (!events || events.length === 0) return { schedule: {}, events: [] };

        const eventIds = events.map(e => e.id);

        // 2. Buscar Assignments desses eventos
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

        // 3. Converter para ScheduleMap
        const schedule: ScheduleMap = {};
        
        assignments?.forEach((assign: any) => {
            const event = events.find(e => e.id === assign.event_id);
            if (event && assign.profiles) {
                const eventIsoKey = event.date_time.slice(0, 16); 
                const key = `${eventIsoKey}_${assign.role}`;
                schedule[key] = assign.profiles.name;
            }
        });

        const mappedEvents = events.map(e => ({
            id: e.id,
            title: e.title,
            date: e.date_time.split('T')[0],
            time: e.date_time.split('T')[1].slice(0, 5)
        }));

        return { schedule, events: mappedEvents };

    } catch (e) {
        console.error("Erro ao buscar escala (SQL):", e);
        return { schedule: {}, events: [] };
    }
};

export const updateMinistryEvent = async (ministryId: string, oldIso: string, newTitle: string, newIso: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const { data: existingEvent } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .ilike('date_time', `${oldIso}%`)
            .limit(1)
            .single();

        if (existingEvent) {
            const { error } = await supabase
                .from('events')
                .update({ title: newTitle, date_time: newIso })
                .eq('id', existingEvent.id);
            return !error;
        } else {
            const { error } = await supabase
                .from('events')
                .insert({ ministry_id: cleanMid, title: newTitle, date_time: newIso });
            return !error;
        }
    } catch (e) {
        console.error("Erro ao atualizar evento (SQL):", e);
        return false;
    }
};

export const saveScheduleAssignment = async (ministryId: string, key: string, memberName: string): Promise<boolean> => {
    if (!supabase || !ministryId) return false;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const [isoDate, role] = key.split('_');
        
        let memberId = null;
        if (memberName) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id')
                .eq('name', memberName)
                .limit(1);
            
            if (profiles && profiles.length > 0) {
                memberId = profiles[0].id;
            } else {
                console.error("Membro não encontrado para salvar:", memberName);
                return false;
            }
        }

        let eventId = null;
        const { data: existingEvents } = await supabase
            .from('events')
            .select('id')
            .eq('ministry_id', cleanMid)
            .ilike('date_time', `${isoDate}%`)
            .limit(1);

        if (existingEvents && existingEvents.length > 0) {
            eventId = existingEvents[0].id;
        } else {
            const isSundayMorning = isoDate.includes('09:00');
            const defaultTitle = isSundayMorning ? 'Culto (Domingo - Manhã)' : 'Culto';
            
            const { data: newEvent, error: createError } = await supabase
                .from('events')
                .insert({ ministry_id: cleanMid, title: defaultTitle, date_time: isoDate })
                .select().single();
            
            if (createError || !newEvent) throw createError;
            eventId = newEvent.id;
        }

        await supabase.from('schedule_assignments').delete().eq('event_id', eventId).eq('role', role);
        
        if (memberName) {
            await supabase.from('schedule_assignments').insert({ event_id: eventId, role: role, member_id: memberId });
        }

        return true;

    } catch (e) {
        console.error("Erro ao salvar assignment (SQL):", e);
        return false;
    }
};

// --- AVAILABILITY ---

export const fetchMinistryAvailability = async (ministryId: string): Promise<AvailabilityMap> => {
    if (!supabase) return {};
    
    try {
        const { data, error } = await supabase
            .from('availability')
            .select(`
                date,
                status,
                profiles!inner ( name, ministry_id )
            `);

        if (error) throw error;

        const map: AvailabilityMap = {};

        data.forEach((row: any) => {
            const name = row.profiles.name;
            const dateStr = row.date;
            const status = row.status;

            if (!map[name]) map[name] = [];

            let entry = dateStr;
            if (status === 'M') entry += '_M';
            else if (status === 'N') entry += '_N';

            map[name].push(entry);
        });

        return map;

    } catch (e) {
        console.error("Erro ao buscar disponibilidade (SQL):", e);
        return {};
    }
};

export const saveMemberAvailability = async (memberId: string, memberName: string, dates: string[]): Promise<boolean> => {
    if (!supabase) return false;

    try {
        let targetId = memberId;
        if (!targetId || targetId === 'manual') {
             const { data: profiles } = await supabase
                .from('profiles')
                .select('id')
                .eq('name', memberName)
                .limit(1);
             if (profiles && profiles.length > 0) targetId = profiles[0].id;
             else return false;
        }

        await supabase.from('availability').delete().eq('member_id', targetId);

        if (dates.length === 0) return true;

        const rows = dates.map(d => {
            let date = d;
            let status = 'BOTH';
            if (d.endsWith('_M')) { date = d.replace('_M', ''); status = 'M'; }
            else if (d.endsWith('_N')) { date = d.replace('_N', ''); status = 'N'; }

            return { member_id: targetId, date: date, status: status };
        });

        const { error } = await supabase.from('availability').insert(rows);
        return !error;

    } catch (e) {
        console.error("Erro ao salvar disponibilidade (SQL):", e);
        return false;
    }
};

// --- AUTH & PROFILE SYNC ---

export const syncMemberProfile = async (ministryId: string, user: User) => {
    if (!supabase || !ministryId) return;
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-');

    try {
        const row = {
            id: user.id,
            name: user.name,
            email: user.email, // Salva o email no banco
            whatsapp: user.whatsapp,
            avatar_url: user.avatar_url,
            birth_date: user.birthDate || null,
            ministry_id: user.ministryId || cleanMid,
            allowed_ministries: user.allowedMinistries || [cleanMid],
            functions: user.functions || [],
            role: user.role
        };

        const { error } = await supabase.from('profiles').upsert(row);
        if (error) console.error("Erro ao sincronizar profile SQL:", error);

    } catch (e) {
        console.error("Exception sync profile:", e);
    }
};

// --- GLOBAL CONFLICTS ---

export const fetchGlobalSchedules = async (currentMonth: string, currentMinistryId: string): Promise<GlobalConflictMap> => {
    if (!supabase || !currentMinistryId) return {};
    const conflictMap: GlobalConflictMap = {};

    try {
        const startOfMonth = `${currentMonth}-01T00:00:00`;
        const [y, m] = currentMonth.split('-').map(Number);
        const nextMonth = new Date(y, m, 1).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('schedule_assignments')
            .select(`
                role,
                events!inner ( ministry_id, date_time ),
                profiles!inner ( name )
            `)
            .gte('events.date_time', startOfMonth)
            .lt('events.date_time', `${nextMonth}T00:00:00`)
            .neq('events.ministry_id', currentMinistryId);

        if (error) throw error;

        data.forEach((row: any) => {
            const name = row.profiles.name.trim().toLowerCase();
            const eventIso = row.events.date_time.slice(0, 16);
            
            if (!conflictMap[name]) conflictMap[name] = [];
            
            conflictMap[name].push({
                ministryId: row.events.ministry_id,
                eventIso: eventIso,
                role: row.role
            });
        });

        return conflictMap;

    } catch (e) {
        console.error("Erro ao buscar conflitos globais (SQL):", e);
        return {};
    }
};

// --- REST OF FUNCTIONS (Keep as is, just ensuring exports) ---

export const createSwapRequest = async (ministryId: string, request: SwapRequest): Promise<boolean> => {
    return saveData(ministryId, 'swap_requests_v1', [request]); 
    // Simplified append, assumes caller handles loading/appending locally or use append logic
};

export const performSwap = async (
    ministryId: string, requestId: string, acceptingMemberName: string, acceptingMemberId?: string
): Promise<{ success: boolean; message: string }> => {
    if (!supabase || !ministryId) return { success: false, message: "Erro conexão" };
    
    try {
        const requests = await loadData<SwapRequest[]>(ministryId, 'swap_requests_v1', []);
        const idx = requests.findIndex(r => r.id === requestId);
        if (idx < 0) return { success: false, message: "Pedido não encontrado" };
        
        const req = requests[idx];
        if (req.status !== 'pending') return { success: false, message: "Já processado" };

        const key = `${req.eventIso}_${req.role}`;
        const saveSuccess = await saveScheduleAssignment(ministryId, key, acceptingMemberName);
        
        if (!saveSuccess) return { success: false, message: "Falha ao atualizar escala no banco." };

        requests[idx] = { ...req, status: 'completed', takenByName: acceptingMemberName };
        await saveData(ministryId, 'swap_requests_v1', requests);

        return { success: true, message: "Troca realizada!" };

    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro interno" };
    }
};

export const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; message: string; user?: User, ministryId?: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { success: false, message: "Email ou senha incorretos." };

        if (data.user) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
            const meta = data.user.user_metadata;
            const allowedMinistries = profile?.allowed_ministries || meta.allowedMinistries || [meta.ministryId];
            const cleanMid = allowedMinistries[0] || 'midia';

            const userProfile: User = {
                id: data.user.id,
                email: data.user.email,
                name: profile?.name || meta.name,
                role: profile?.role || meta.role || 'member',
                ministryId: cleanMid,
                allowedMinistries: allowedMinistries,
                whatsapp: profile?.whatsapp || meta.whatsapp,
                birthDate: profile?.birth_date || meta.birthDate,
                avatar_url: profile?.avatar_url || meta.avatar_url,
                functions: profile?.functions || meta.functions || []
            };

            await syncMemberProfile(cleanMid, userProfile);
            return { success: true, message: "Login realizado.", user: userProfile, ministryId: cleanMid };
        }
        return { success: false, message: "Erro desconhecido." };
    } catch (e) { return { success: false, message: "Erro interno." }; }
};

export const loginWithGoogle = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                queryParams: { prompt: 'select_account', access_type: 'offline' }
            },
        });
        if (error) return { success: false, message: error.message };
        return { success: true, message: "Redirecionando..." };
    } catch (e) { return { success: false, message: "Erro interno." }; }
};

export const registerWithEmail = async (
    email: string, password: string, name: string, ministries: string[], whatsapp?: string, selectedRoles?: string[]
): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };
    try {
        const cleanMinistries = ministries.map(m => m.trim().toLowerCase().replace(/\s+/g, '-'));
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: {
                data: {
                    name, ministryId: cleanMinistries[0], allowedMinistries: cleanMinistries,
                    whatsapp, functions: selectedRoles || [], role: 'member'
                }
            }
        });

        if (error) return { success: false, message: error.message };

        if (data.user) {
            const userProfile: User = {
                id: data.user.id,
                email, name, role: 'member', ministryId: cleanMinistries[0],
                allowedMinistries: cleanMinistries, whatsapp, functions: selectedRoles || []
            };
            await syncMemberProfile(cleanMinistries[0], userProfile);
        }
        return { success: true, message: "Cadastro realizado!" };
    } catch (e) { return { success: false, message: "Erro interno." }; }
};

export const joinMinistry = async (newMinistryId: string, roles: string[]): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Usuário não autenticado." };

        const cleanMid = newMinistryId.trim().toLowerCase().replace(/\s+/g, '-');
        
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const currentAllowed = profile?.allowed_ministries || [];
        
        if (currentAllowed.includes(cleanMid)) return { success: false, message: "Já participa." };

        const newAllowed = [...currentAllowed, cleanMid];
        
        await supabase.from('profiles').update({
            allowed_ministries: newAllowed,
            functions: [...(profile?.functions || []), ...roles]
        }).eq('id', user.id);

        return { success: true, message: "Entrou no ministério!" };
    } catch (e) { return { success: false, message: "Erro." }; }
};

export const updateUserProfile = async (
    name: string, whatsapp: string, avatar_url?: string, functions?: string[], birthDate?: string, currentMinistryId?: string
): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Usuário não logado" };

        const updates = { name, whatsapp, avatar_url, birth_date: birthDate, functions };

        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
        if (error) throw error;

        await supabase.auth.updateUser({ data: updates });

        return { success: true, message: "Perfil atualizado!" };
    } catch (e) { return { success: false, message: "Erro ao atualizar." }; }
};

export const logout = async () => { if (supabase) await supabase.auth.signOut(); };

export const sendPasswordResetEmail = async (email: string) => {
    if (!supabase) return { success: false, message: "Erro conexão" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    return error ? { success: false, message: error.message } : { success: true, message: "Email enviado." };
};

export const deleteMember = async (ministryId: string, memberId: string, memberName: string): Promise<boolean> => {
    if (!supabase) return false;
    try {
        if (memberId && memberId !== 'manual') {
            await supabase.from('profiles').delete().eq('id', memberId);
        }
        return true;
    } catch (e) { return false; }
};

export const toggleAdmin = async (ministryId: string, email: string) => {
    const admins = await loadData<string[]>(ministryId, 'admins_list', []);
    const newAdmins = admins.includes(email) ? admins.filter(e => e !== email) : [...admins, email];
    await saveData(ministryId, 'admins_list', newAdmins);
    return { success: true, isAdmin: !admins.includes(email) };
};

export const createAnnouncement = async (ministryId: string, announcement: any, author: string) => {
    const list = await loadData<Announcement[]>(ministryId, 'announcements_v1', []);
    const newAnn = { ...announcement, id: Date.now().toString(), timestamp: new Date().toISOString(), readBy: [], likedBy: [], author };
    return await saveData(ministryId, 'announcements_v1', [newAnn, ...list].slice(0, 20));
};

export const markAnnouncementRead = async (ministryId: string, id: string, user: User) => {
    const list = await loadData<Announcement[]>(ministryId, 'announcements_v1', []);
    const updated = list.map(a => a.id === id && !a.readBy.some(r => r.userId === user.id) ? { ...a, readBy: [...a.readBy, { userId: user.id!, name: user.name, timestamp: new Date().toISOString() }] } : a);
    await saveData(ministryId, 'announcements_v1', updated);
    return updated;
};

export const toggleAnnouncementLike = async (ministryId: string, id: string, user: User) => {
    const list = await loadData<Announcement[]>(ministryId, 'announcements_v1', []);
    const updated = list.map(a => {
        if (a.id !== id) return a;
        const liked = a.likedBy?.some(l => l.userId === user.id);
        const newLikes = liked ? a.likedBy.filter(l => l.userId !== user.id) : [...(a.likedBy || []), { userId: user.id!, name: user.name, timestamp: new Date().toISOString() }];
        return { ...a, likedBy: newLikes };
    });
    await saveData(ministryId, 'announcements_v1', updated);
    return updated;
};

export const sendNotification = async (ministryId: string, notif: any) => {
    const list = await loadData<AppNotification[]>(ministryId, 'notifications_v1', []);
    const newNotif = { ...notif, id: Date.now().toString(), timestamp: new Date().toISOString(), read: false };
    await saveData(ministryId, 'notifications_v1', [newNotif, ...list].slice(0, 50));
};

export const markNotificationsRead = async (ministryId: string, ids: string[]) => {
    const list = await loadData<AppNotification[]>(ministryId, 'notifications_v1', []);
    const updated = list.map(n => ids.includes(n.id) ? { ...n, read: true } : n);
    await saveData(ministryId, 'notifications_v1', updated);
    return updated;
};

export const clearAllNotifications = async (ministryId: string) => {
    await saveData(ministryId, 'notifications_v1', []);
    return [];
};

export const saveSubscription = async (ministryId: string, sub: PushSubscription) => {
    const list = await loadData<PushSubscriptionRecord[]>(ministryId, 'push_subscriptions_v1', []);
    const record = { endpoint: sub.endpoint, keys: { p256dh: (sub.toJSON() as any).keys.p256dh, auth: (sub.toJSON() as any).keys.auth }, device_id: 'browser', last_updated: new Date().toISOString() };
    const filtered = list.filter(s => s.endpoint !== sub.endpoint);
    return await saveData(ministryId, 'push_subscriptions_v1', [...filtered, record]);
};