

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let requestData: any = {};
    try {
        const text = await req.text();
        if (text) requestData = JSON.parse(text);
    } catch (e) {
        // Body vazio ou inválido
    }

    const { ministryId, title, message, type, actionLink } = requestData;

    // --- VALIDAÇÃO DAS CHAVES VAPID ---
    // A chave pública deve bater com a que está no frontend (utils/pushUtils.ts)
    const publicKey = 'BObJkDWME42FE1qS75tls7RnVakwqIjYufuqnwVKjLS-wrYlxmUSlcYdunkckUxpyME03GgrPAzShWruRnZnu3o'
    
    // A chave privada vem dos Secrets do Supabase
    let privateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!privateKey) {
        // Fallback apenas para teste se o usuário esqueceu de configurar (NÃO RECOMENDADO EM PROD)
        console.error("VAPID_PRIVATE_KEY não encontrada nos Secrets.");
        return new Response(JSON.stringify({ 
            success: false, 
            message: 'CONFIGURAÇÃO PENDENTE: Adicione VAPID_PRIVATE_KEY nos Secrets do Supabase.' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Limpeza da chave (remove espaços e quebras de linha que causam o erro de 32 bytes)
    privateKey = privateKey.trim();

    try {
        // Email de contato para o serviço de Push
        const subject = 'mailto:cassia.andinho@gmail.com'
        webpush.setVapidDetails(subject, publicKey, privateKey)
    } catch (err: any) {
        console.error("Erro na configuração VAPID:", err.message);
        
        // Tratamento específico para o erro de tamanho da chave
        let userMsg = "Erro na configuração de chaves.";
        if (err.message && err.message.includes('32 bytes long')) {
            userMsg = "A Chave Privada (VAPID) está inválida (tamanho incorreto). Gere um novo par em Configurações.";
        }

        return new Response(JSON.stringify({ 
            success: false, 
            message: userMsg,
            details: err.message
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Se chegou aqui, as chaves estão válidas. Prossegue com o envio.
    
    if (!ministryId) {
         return new Response(JSON.stringify({ success: false, message: 'Ministry ID required.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
         })
    }

    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-')

    // Busca usuários do ministério
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`)
        
    const userIds = profiles?.map((p: any) => p.id) || []
    
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhum usuário para notificar.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    // Busca subscrições
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Ninguém ativou notificações ainda.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    const results = []
    
    for (const record of subscriptions) {
      if (!record.p256dh || !record.auth || !record.endpoint) continue;

      const pushSubscription = {
        endpoint: record.endpoint,
        keys: { p256dh: record.p256dh, auth: record.auth },
      }

      const payload = JSON.stringify({
        title: title || 'Aviso',
        body: message || 'Nova notificação.',
        icon: 'https://escala-midia-pro.vercel.app/icon.png',
        data: { url: actionLink ? `/?tab=${actionLink}` : '/', type }
      })

      try {
        await webpush.sendNotification(pushSubscription, payload)
        results.push({ endpoint: record.endpoint, status: 'success' })
      } catch (err: any) {
        console.error('Falha envio individual:', err.statusCode)
        if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', record.endpoint);
        }
        results.push({ endpoint: record.endpoint, status: 'failed' })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    return new Response(JSON.stringify({ 
        success: true, 
        message: successCount > 0 ? `Enviado para ${successCount} aparelhos.` : 'Falha no envio.',
        results 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: any) {
    console.error('Erro Fatal:', error)
    return new Response(JSON.stringify({ success: false, message: 'Erro interno no servidor.', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })
  }
})