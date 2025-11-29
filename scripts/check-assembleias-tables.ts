import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERRO: Variáveis de ambiente não encontradas!')
  console.error('   Certifique-se de que .env.local existe com:')
  console.error('   - VITE_SUPABASE_URL')
  console.error('   - VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTables() {
  console.log('🔍 Verificando tabelas de assembleias no Supabase...\n')

  const tables = [
    'assembleias',
    'assembleias_presencas',
    'assembleias_pautas',
    'assembleias_votos'
  ]

  let allExist = true

  for (const table of tables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.log(`❌ Tabela "${table}" NÃO existe`)
        console.log(`   Erro: ${error.message}`)
        allExist = false
      } else {
        console.log(`✅ Tabela "${table}" existe (${count || 0} registros)`)
      }
    } catch (err) {
      console.log(`❌ Erro ao verificar "${table}":`, err)
      allExist = false
    }
  }

  console.log('\n' + '='.repeat(60))
  if (allExist) {
    console.log('✅ TODAS as tabelas de assembleias estão configuradas!')
    console.log('\n📋 Próximos passos:')
    console.log('   1. Verificar bucket "assembleias" no Supabase Storage')
    console.log('   2. Executar: npm run seed:assembleia')
    console.log('   3. Testar fluxo completo no frontend')
  } else {
    console.log('⚠️  ATENÇÃO: Algumas tabelas estão faltando!')
    console.log('\n📋 Para criar as tabelas:')
    console.log('   1. Acesse: https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw/sql/new')
    console.log('   2. Cole o conteúdo de: scripts/create-assembleias-tables.sql')
    console.log('   3. Clique em "Run" para executar')
    console.log('   4. Execute este script novamente para verificar')
  }
  console.log('='.repeat(60) + '\n')

  process.exit(allExist ? 0 : 1)
}

checkTables()
