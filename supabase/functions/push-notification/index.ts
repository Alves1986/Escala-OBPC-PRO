
// Copie TODO este código e cole no Editor da Edge Function 'push-notification' no painel do Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.0'

// Fix for "Cannot find name 'Deno'" in environments without Deno types
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // 1. Trata requisições OPTIONS (CORS) - Necessário para o navegador aceitar a resposta
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Conecta ao Supabase usando a chave de serviço (Admin)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Recebe os dados enviados pelo seu App
    const { ministryId, title, message, type, actionLink } = await req.json()

    // 4. CONFIGURAÇÃO VAPID (SEGURANÇA REFORÇADA)
    // A chave pública pode ficar no código, mas a privada DEVE vir das variáveis de ambiente.
    const publicKey = 'BF16yQvZzPhqIFKl0CVYgNtjonnfgGI39QPOHXcmu0_kGL9V9llvULEMaQajIxT8nEW8rRQ_kWacpDc1zQi9EYs'
    
    // IMPORTANTE: Configure 'VAPID_PRIVATE_KEY' no Dashboard do Supabase em Edge Functions > Secrets
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!privateKey) {
        console.error('VAPID_PRIVATE_KEY não configurada nas variáveis de ambiente.');
        return new Response(JSON.stringify({ error: 'Erro de configuração no servidor (Missing VAPID Key).' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }

    const subject = 'mailto:cassia.andinho@gmail.com'

    // Configura a biblioteca de Push
    webpush.setVapidDetails(subject, publicKey, privateKey)

    // 5. Busca os celulares inscritos no banco de dados
    const cleanMid = ministryId.trim().toLowerCase().replace(/\s+/g, '-')

    // Busca IDs de usuários que pertencem a este ministério
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .or(`ministry_id.eq.${cleanMid},allowed_ministries.cs.{${cleanMid}}`)
        
    const userIds = profiles?.map((p: any) => p.id) || []
    
    if (userIds.length === 0) {
      console.log('Nenhum usuário encontrado neste ministério.')
      return new Response(JSON.stringify({ message: 'Nenhum usuário no ministério.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Busca subscrições apenas desses usuários
    const { data: subscriptions, error: storageError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds)

    if (storageError || !subscriptions || subscriptions.length === 0) {
      console.log('Nenhum dispositivo encontrado para notificar.')
      return new Response(JSON.stringify({ message: 'Nenhum dispositivo inscrito.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const results = []
    console.log(`Enviando notificação para ${subscriptions.length} dispositivos...`)

    // 6. Loop para enviar a notificação para cada celular
    for (const record of subscriptions) {
      const pushSubscription = {
        endpoint: record.endpoint,
        keys: {
            p256dh: record.p256dh,
            auth: record.auth
        },
      }

      const payload = JSON.stringify({
        title: title || 'Novo Aviso da Escala',
        body: message,
        icon: 'https://escala-midia-pro.vercel.app/icon.png',
        data: {
            url: actionLink ? `/?tab=${actionLink}` : '/',
            type: type
        }
      })

      try {
        await webpush.sendNotification(pushSubscription, payload)
        results.push({ endpoint: record.endpoint, status: 'success' })
      } catch (err) {
        console.error('Falha ao enviar para um dispositivo:', err)
        results.push({ endpoint: record.endpoint, status: 'failed', error: err })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Erro na função:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
