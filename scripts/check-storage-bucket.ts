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

async function checkBucket() {
  console.log('🗄️  Verificando bucket de Storage no Supabase...\n')

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()

    if (error) {
      console.log('❌ Erro ao listar buckets:', error.message)
      process.exit(1)
    }

    console.log('📦 Buckets existentes:')
    buckets?.forEach(bucket => {
      const icon = bucket.public ? '🌐' : '🔒'
      console.log(`   ${icon} ${bucket.name} (${bucket.public ? 'público' : 'privado'})`)
    })

    const assembleiaBucket = buckets?.find(b => b.name === 'assembleias')

    console.log('\n' + '='.repeat(60))
    if (assembleiaBucket) {
      console.log('✅ Bucket "assembleias" ENCONTRADO!')
      console.log(`   Status: ${assembleiaBucket.public ? '🌐 Público' : '🔒 Privado'}`)
      
      if (!assembleiaBucket.public) {
        console.log('\n⚠️  AVISO: O bucket deve ser PÚBLICO para URLs funcionarem')
        console.log('   Acesse: https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw/storage/buckets')
        console.log('   E configure como público')
      }
    } else {
      console.log('❌ Bucket "assembleias" NÃO ENCONTRADO!')
      console.log('\n📋 Para criar o bucket:')
      console.log('   1. Acesse: https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw/storage/buckets')
      console.log('   2. Clique em "New bucket"')
      console.log('   3. Configure:')
      console.log('      - Nome: assembleias')
      console.log('      - Público: ✅ SIM')
      console.log('      - MIME types: application/pdf')
      console.log('   4. Execute este script novamente')
    }
    console.log('='.repeat(60) + '\n')

    process.exit(assembleiaBucket ? 0 : 1)
  } catch (err) {
    console.log('❌ Erro:', err)
    process.exit(1)
  }
}

checkBucket()
