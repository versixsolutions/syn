import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // 1. Tratamento de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Verificar Autenticação do Solicitante (Admin)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Não autenticado')

    // Verificar se é admin na tabela users
    const { data: profile } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'sindico')) {
      return new Response(JSON.stringify({ error: 'Permissão negada. Apenas Admin/Síndico.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Pegar ID do alvo
    const { userId } = await req.json()
    if (!userId) throw new Error('ID do usuário é obrigatório')

    console.log(`🗑️ Deletando usuário: ${userId}`)

    // 4. Deletar usando Cliente Service Role (Admin Supremo)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // ESSA CHAVE PRECISA ESTAR NO .ENV DO SUPABASE
    )

    // Deleta do Auth (o banco deve ter ON DELETE CASCADE para limpar o resto)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Erro ao deletar do Auth:', deleteError)
      throw deleteError
    }

    return new Response(JSON.stringify({ success: true, message: 'Usuário excluído definitivamente.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Erro na Edge Function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})