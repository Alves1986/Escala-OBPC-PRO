
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

    const { ministryId, title, message, type, actionLink, action, name } = requestData;

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        // Configure um email válido para contato em caso de problemas com o serviço de push
        const subject = 'mailto:admin@example.com'; 
        webpush.setVapidDetails(subject, publicKey, privateKey);
    } catch (err: any) {
        console.error("Erro Fatal VAPID:", err.message);
        return new Response(JSON.stringify({ 
            success: false, 
            message: "Erro na validação das chaves VAPID.",
            details: err.message
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // 7. Lógica de Envio
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-')

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`)
        
    const userIds = profiles?.map((p: any) => p.id) || []
    
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum usuário encontrado neste ministério.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum dispositivo inscrito.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
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
        console.error('Falha envio:', err.statusCode)
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
    console.error('Erro Fatal Handler:', error)
    return new Response(JSON.stringify({ 
        success: false, 
        message: 'Erro interno na função.', 
        details: error.message || String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })
  }
})
