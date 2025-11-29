import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ✅ CORREÇÃO CRÍTICA: Validar variáveis de ambiente
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = []
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL')
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY')
  
  throw new Error(
    `❌ Configuração crítica faltando. Variáveis não definidas: ${missingVars.join(', ')}. ` +
    `Verifique seu arquivo .env.`
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})

// Log para debug (remover em produção)
if (import.meta.env.DEV) {
  console.log('✅ Supabase inicializado com sucesso', {
    url: supabaseUrl?.substring(0, 20) + '...',
    hasKey: !!supabaseAnonKey
  })
}
