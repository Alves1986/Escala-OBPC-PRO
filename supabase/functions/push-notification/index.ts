
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
    // O Deno.env.get pega essas variáveis automaticamente do ambiente do Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Recebe os dados enviados pelo seu App (Título, Mensagem, etc)
    const { ministryId, title, message, type, actionLink } = await req.json()

    // 4. CONFIGURAÇÃO VAPID (SUAS CHAVES REAIS)
    const publicKey = 'BF16yQvZzPhqIFKl0CVYgNtjonnfgGI39QPOHXcmu0_kGL9V9llvULEMaQajIxT8nEW8rRQ_kWacpDc1zQi9EYs'
    const privateKey = 'jPhKxqIlLZG3sAhavSwSHXKY6CnzygSCTR8iIn_edsTE' // Chave Privada (Não compartilhe)
    const subject = 'mailto:cassia.andinho@gmail.com'

    // Configura a biblioteca de Push
    webpush.setVapidDetails(subject, publicKey, privateKey)

    // 5. Busca os celulares inscritos no banco de dados (Nova Tabela SQL)
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
      .select('endpoint, p256dh, auth') // Select SQL columns
      .in('user_id', userIds)

    // Se não tiver ninguém inscrito, retorna sucesso mas avisa
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

      // O que vai aparecer no celular
      const payload = JSON.stringify({
        title: title || 'Novo Aviso da Escala',
        body: message,
        icon: 'https://escala-midia-pro.vercel.app/icon.png', // Tenta mostrar o ícone do app
        data: {
            url: actionLink ? `/?tab=${actionLink}` : '/', // Abre o app ao clicar (com tab se houver)
            type: type
        }
      })

      try {
        await webpush.sendNotification(pushSubscription, payload)
        results.push({ endpoint: record.endpoint, status: 'success' })
      } catch (err) {
        console.error('Falha ao enviar para um dispositivo:', err)
        
        // Se o erro for 410 (Gone), o usuário desinstalou ou limpou dados.
        // Aqui poderíamos remover do banco, mas por segurança apenas logamos o erro.
        results.push({ endpoint: record.endpoint, status: 'failed', error: err })
      }
    }

    // 7. Retorna o relatório final
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    // Tratamento de erro geral
    console.error('Erro na função:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})