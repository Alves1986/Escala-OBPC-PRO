
// Copie TODO este código e cole no Editor da Edge Function 'push-notification' no painel do Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fix for "Cannot find name 'Deno'"
declare const Deno: any;

Deno.serve(async (req: Request) => {
  // 1. Tratamento de CORS (Pre-flight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Leitura Segura do Corpo da Requisição
    let requestData: any = {};
    try {
        const text = await req.text();
        if (text) requestData = JSON.parse(text);
    } catch (e) {
        console.warn("Corpo da requisição vazio ou inválido.");
    }

    const { ministryId, title, message, type, actionLink, action, name, memberId, targetEmail, status } = requestData;

    // 3. DETECÇÃO DE TESTE DO DASHBOARD (Supabase "Test Function" button)
    if (name === "Functions" || (!ministryId && !action)) {
         return new Response(JSON.stringify({ 
             success: true, 
             message: 'Edge Function está ONLINE! Configure os Segredos (Secrets) no Dashboard para envio real.' 
         }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
         })
    }

    // 4. Feature: Gerador de Chaves
    if (action === 'generate_keys') {
        const keys = webpush.generateVAPIDKeys();
        return new Response(JSON.stringify({ 
            success: true, 
            keys 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // 5. Configuração do Supabase Client via Env Vars
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Variáveis de ambiente do Supabase (URL/KEY) não configuradas no Dashboard.");
    }

    // Inicializa cliente com Service Role para poder validar o usuário e ler perfis/inscrições
    // IMPORTANTE: Service Role bypassa RLS, permitindo ações de Admin.
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- SECURITY CHECK START ---
    // Valida se o usuário que chamou a função tem permissão para o ministryId alvo
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ success: false, message: 'Authorization header missing' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
        return new Response(JSON.stringify({ success: false, message: 'Invalid User Token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Normaliza ID do ministério alvo se existir
    const cleanMid = ministryId ? ministryId.trim().toLowerCase().replace(/\s+/g, '-') : null;

    // Busca perfil do usuário para verificar permissões
    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('ministry_id, allowed_ministries, is_admin')
        .eq('id', user.id)
        .single();

    if (!callerProfile) {
        return new Response(JSON.stringify({ success: false, message: 'Profile not found' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verifica se o usuário é Admin, se pertence ao ministério principal ou se tem permissão secundária
    const hasAccess = 
        callerProfile.is_admin || 
        (cleanMid && callerProfile.ministry_id === cleanMid) || 
        (cleanMid && callerProfile.allowed_ministries && callerProfile.allowed_ministries.includes(cleanMid));

    if (!hasAccess) {
        console.warn(`Acesso negado: Usuário ${user.id} tentou acessar ${cleanMid} sem permissão.`);
        return new Response(JSON.stringify({ success: false, message: 'Forbidden: You do not have permission.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // --- SECURITY CHECK END ---

    // === ADMIN ACTIONS (Bypassing RLS safely) ===
    
    // ACTION: Delete Member
    if (action === 'delete_member') {
        if (!memberId || !cleanMid) {
            return new Response(JSON.stringify({ success: false, message: 'Missing memberId or ministryId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 1. Atualizar Perfil: Remove o ministério da lista de permitidos
        const { data: profile } = await supabase.from('profiles').select('allowed_ministries, ministry_id').eq('id', memberId).single();
        
        if (profile) {
             const currentAllowed = Array.isArray(profile.allowed_ministries) ? profile.allowed_ministries : [];
             const newAllowed = currentAllowed.filter((m: string) => m !== cleanMid);
             const updates: any = { allowed_ministries: newAllowed };
             
             // Se o ministério ativo for o que está sendo removido, troca ou zera
             if (profile.ministry_id === cleanMid) {
                 updates.ministry_id = newAllowed.length > 0 ? newAllowed[0] : null;
             }
             
             const { error: updateError } = await supabase.from('profiles').update(updates).eq('id', memberId);
             if (updateError) throw updateError;
        }

        // 2. Limpar Escalas Futuras
        const todayIso = new Date().toISOString();
        const { data: events } = await supabase.from('events').select('id').eq('ministry_id', cleanMid).gte('date_time', todayIso);
        const eventIds = events?.map((e: any) => e.id) || [];
        
        if (eventIds.length > 0) {
            await supabase.from('schedule_assignments').delete().eq('member_id', memberId).in('event_id', eventIds);
        }

        return new Response(JSON.stringify({ success: true, message: 'Membro removido com sucesso via Server-Side.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // ACTION: Toggle Admin
    if (action === 'toggle_admin') {
        if (!callerProfile.is_admin) {
             return new Response(JSON.stringify({ success: false, message: 'Apenas Administradores podem alterar permissões.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (!targetEmail) {
            return new Response(JSON.stringify({ success: false, message: 'Target email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { error } = await supabase.from('profiles').update({ is_admin: status }).eq('email', targetEmail);
        
        if (error) throw error;
        
        return new Response(JSON.stringify({ success: true, message: 'Permissão alterada.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // === PUSH NOTIFICATIONS LOGIC ===

    // 6. Configuração VAPID (Push Notifications) via Env Vars
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    let privateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!publicKey || !privateKey) {
        return new Response(JSON.stringify({ 
            success: false, 
            message: 'ERRO CRÍTICO: Chaves VAPID não configuradas nos Secrets do Supabase.' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // --- LIMPEZA ROBUSTA DA CHAVE PRIVADA ---
    privateKey = privateKey.trim().replace(/[\r\n\s]/g, '');
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || 
        (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
    }

    try {
        const subject = 'mailto:admin@example.com'; 
        webpush.setVapidDetails(subject, publicKey, privateKey);
    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, message: "Erro VAPID.", details: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // 7. Lógica de Envio
    if (!cleanMid) return new Response(JSON.stringify({ success: false, message: 'Ministry ID missing for push' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`)
        
    const userIds = profiles?.map((p: any) => p.id) || []
    
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum usuário para notificar.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum dispositivo inscrito.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const results = []
    let successCount = 0;
    
    for (const record of subscriptions) {
      if (!record.p256dh || !record.auth || !record.endpoint) continue;

      const pushSubscription = {
        endpoint: record.endpoint,
        keys: { p256dh: record.p256dh, auth: record.auth },
      }

      const payload = JSON.stringify({
        title: title || 'Novo Aviso',
        body: message || 'Você tem uma nova notificação.',
        icon: 'https://escala-midia-pro.vercel.app/icon.png',
        data: { url: actionLink ? `/?tab=${actionLink}` : '/', type }
      })

      try {
        await webpush.sendNotification(pushSubscription, payload)
        results.push({ endpoint: record.endpoint, status: 'success' })
        successCount++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', record.endpoint);
        }
        results.push({ endpoint: record.endpoint, status: 'failed', error: err.message })
      }
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: successCount > 0 ? `Enviado para ${successCount} dispositivos.` : 'Nenhum envio com sucesso.',
        results 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: any) {
    return new Response(JSON.stringify({ 
        success: false, 
        message: 'Erro interno na função.', 
        details: error.message || String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })
  }
})
