
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY, PushSubscriptionRecord, User, MemberMap, DEFAULT_ROLES } from '../types';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const getStorageKey = (ministryId: string, suffix: string) => `${ministryId}_${suffix}`;

// --- Authentication Logic ---

export const authenticateUser = async (ministryId: string, usernameInput: string, passwordInput: string): Promise<{ success: boolean; message: string; user?: User }> => {
  if (!supabase || !ministryId) return { success: false, message: "Erro de conexão" };

  const usersKey = getStorageKey(ministryId, 'users_v1');
  const legacyAuthKey = getStorageKey(ministryId, 'auth_config_v1');

  try {
    // 1. Tenta buscar a lista de usuários moderna
    const { data: usersData } = await supabase
      .from('app_storage')
      .select('value')
      .eq('key', usersKey)
      .single();

    let users: User[] = usersData ? usersData.value : [];

    // Tenta encontrar o usuário na lista
    const foundUser = users.find(u => u.username === usernameInput);

    if (foundUser) {
      if (foundUser.password === passwordInput) {
        return { success: true, message: "Login realizado.", user: foundUser };
      } else {
        return { success: false, message: "Senha incorreta." };
      }
    }

    // FALLBACK: Se o usuário for "admin" e não estiver na lista (migração ou legado), verifica a chave antiga
    if (usernameInput === 'admin') {
      const { data: legacyData } = await supabase
        .from('app_storage')
        .select('value')
        .eq('key', legacyAuthKey)
        .single();
      
      if (!legacyData) {
         // Primeiro acesso admin absoluto
         // Cria o usuário admin na nova estrutura
         const newAdmin: User = {
            username: 'admin',
            name: 'Administrador',
            role: 'admin',
            password: passwordInput,
            createdAt: new Date().toISOString()
         };
         users.push(newAdmin);
         await saveData(ministryId, 'users_v1', users);
         return { success: true, message: "Admin configurado.", user: newAdmin };
      }

      const storedAuth = legacyData.value as { password: string };
      if (storedAuth.password === passwordInput) {
        // Migrar para estrutura nova em memória para retornar
        const legacyAdmin: User = { username: 'admin', name: 'Administrador', role: 'admin' };
        return { success: true, message: "Login Admin.", user: legacyAdmin };
      } else {
        return { success: false, message: "Senha incorreta." };
      }
    }

    return { success: false, message: "Usuário não encontrado." };

  } catch (e) {
    console.error("Auth error", e);
    return { success: false, message: "Erro interno de autenticação." };
  }
};

// --- Registration Logic ---

export const getMinistryRoles = async (ministryId: string): Promise<string[] | null> => {
    if (!supabase) return null;
    try {
        const { data } = await supabase
          .from('app_storage')
          .select('value')
          .eq('key', getStorageKey(ministryId, 'functions_config'))
          .single();
        
        if (data) return data.value as string[];
        
        // Se não tiver config salva, verifica se o ministério "existe" (tem algum dado salvo)
        const { data: checkData } = await supabase.from('app_storage').select('key').ilike('key', `${ministryId}_%`).limit(1);
        if (checkData && checkData.length > 0) return DEFAULT_ROLES;
        
        return null; // Ministério não existe
    } catch (e) {
        return null;
    }
};

export const registerMember = async (
    ministryId: string, 
    name: string, 
    whatsapp: string, 
    password: string, 
    selectedRoles: string[]
): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Erro de conexão" };

    try {
        // 1. Validar Username (slug do nome)
        const username = name.trim().split(' ')[0].toLowerCase() + Math.floor(Math.random() * 100);
        
        // 2. Carregar Usuários existentes
        const users = await loadData<User[]>(ministryId, 'users_v1', []);
        
        // Verificar duplicidade de nome (opcional, mas bom)
        if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
            return { success: false, message: "Já existe um usuário com este nome." };
        }

        // 3. Criar Novo Usuário
        const newUser: User = {
            username,
            name,
            whatsapp,
            password,
            role: 'member', // Default para member
            functions: selectedRoles,
            createdAt: new Date().toISOString()
        };
        
        const updatedUsers = [...users, newUser];
        
        // 4. Carregar e Atualizar Lista de Membros (Escala)
        const membersMap = await loadData<MemberMap>(ministryId, 'members_v7', {});
        const updatedMembersMap = { ...membersMap };
        
        selectedRoles.forEach(role => {
            if (!updatedMembersMap[role]) updatedMembersMap[role] = [];
            if (!updatedMembersMap[role].includes(name)) {
                updatedMembersMap[role].push(name);
            }
        });

        // 5. Salvar Tudo
        await Promise.all([
            saveData(ministryId, 'users_v1', updatedUsers),
            saveData(ministryId, 'members_v7', updatedMembersMap)
        ]);

        return { success: true, message: `Cadastro realizado! Seu usuário é: ${username}` };

    } catch (e) {
        console.error(e);
        return { success: false, message: "Erro ao cadastrar." };
    }
};

// --- Data Loading/Saving ---

export const loadData = async <T>(ministryId: string, keySuffix: string, fallback: T): Promise<T> => {
  if (!supabase || !ministryId) return fallback;
  
  try {
    const { data, error } = await supabase
      .from('app_storage')
      .select('value')
      .eq('key', getStorageKey(ministryId, keySuffix))
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
    const { error } = await supabase
      .from('app_storage')
      .upsert(
        { key: getStorageKey(ministryId, keySuffix), value },
        { onConflict: 'key' }
      );
    return !error;
  } catch (e) {
    console.error(`Error saving ${keySuffix}`, e);
    return false;
  }
};

// --- Push Notification Specific ---

export const saveSubscription = async (ministryId: string, subscription: PushSubscription) => {
  if (!supabase || !ministryId) return false;

  let deviceId = localStorage.getItem('escala_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('escala_device_id', deviceId);
  }

  const subRecord: PushSubscriptionRecord = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.toJSON().keys?.p256dh || '',
      auth: subscription.toJSON().keys?.auth || ''
    },
    device_id: deviceId,
    last_updated: new Date().toISOString()
  };

  const storageKey = getStorageKey(ministryId, `sub_${deviceId}`);
  
  try {
    const { error } = await supabase
      .from('app_storage')
      .upsert(
        { key: storageKey, value: subRecord },
        { onConflict: 'key' }
      );
      
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error saving subscription:", e);
    return false;
  }
};
