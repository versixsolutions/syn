// Importações
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'mailto:admin@versix.com.br',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    )
  } catch (err) {
    console.error('Erro ao configurar VAPID:', err)
  }
}

interface Payload {
  type: 'INSERT' | 'UPDATE'
  table: string
  record: any
  old_record: any
  schema: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: Payload = await req.json()
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // =================================================================
    // CASO 1: APROVAÇÃO DE USUÁRIO (UPDATE na tabela users)
    // =================================================================
    if (payload.table === 'users' && payload.type === 'UPDATE') {
      const oldRole = payload.old_record.role
      const newRole = payload.record.record

      // Detecta mudança de 'pending' para qualquer status aprovado
      if (oldRole === 'pending' && newRole !== 'pending') {
        const user = payload.record
        console.log(`✅ Usuário aprovado: ${user.email}`)

        if (RESEND_API_KEY) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Versix Norma <onboarding@resend.dev>', // Use seu domínio verificado em produção
              to: [user.email],
              subject: '🎉 Seu acesso foi aprovado!',
              html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #1F4080;">Bem-vindo ao Versix!</h1>
                  </div>
                  <p>Olá, <strong>${user.full_name || 'Morador'}</strong>,</p>
                  <p>Temos ótimas notícias! Seu cadastro foi aprovado pela administração do condomínio.</p>
                  <p>Agora você já pode acessar todas as funcionalidades do aplicativo, como:</p>
                  <ul>
                    <li>📢 Ler comunicados oficiais</li>
                    <li>🗳️ Votar em assembleias</li>
                    <li>💰 Acessar prestação de contas</li>
                    <li>🚨 Abrir ocorrências</li>
                  </ul>
                  <div style="text-align: center; margin-top: 30px;">
                    <a href="https://app.versix.com.br" style="background-color: #00A86B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                      Acessar Agora
                    </a>
                  </div>
                  <p style="font-size: 12px; color: #888; margin-top: 40px; text-align: center;">
                    Se você não solicitou este acesso, ignore este e-mail.
                  </p>
                </div>
              `
            })
          })
          
          if (!res.ok) {
            console.error('Erro ao enviar email:', await res.text())
          } else {
            console.log('📧 Email de boas-vindas enviado!')
          }
        }
      }
      return new Response(JSON.stringify({ message: 'User update processed' }), { headers: corsHeaders })
    }

    // =================================================================
    // CASO 2: NOVO COMUNICADO (INSERT na tabela comunicados)
    // =================================================================
    if (payload.table === 'comunicados' && payload.type === 'INSERT') {
      const comunicado = payload.record
      console.log(`📢 Processando notificação para comunicado: ${comunicado.title}`)

      // Lógica de Push Notification (Mantida igual)
      const { data: subscriptions } = await supabase.from('push_subscriptions').select('subscription, user_id')
      
      if (VAPID_PRIVATE_KEY && subscriptions && subscriptions.length > 0) {
        const notificationPayload = JSON.stringify({
          title: `Condomínio: ${comunicado.title}`,
          body: comunicado.content.substring(0, 100) + '...',
          url: '/comunicados'
        })

        const pushPromises = subscriptions.map(sub => {
          if (!sub.subscription || !sub.subscription.endpoint) return Promise.resolve()
          return webpush.sendNotification(sub.subscription, notificationPayload).catch(() => {})
        })

        await Promise.all(pushPromises)
        console.log(`✅ Pushes enviados.`)
      }
      
      return new Response(JSON.stringify({ message: 'Notification processed' }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ message: 'No action taken' }), { headers: corsHeaders })

  } catch (error: any) {
    console.error('Erro Fatal na Edge Function:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})