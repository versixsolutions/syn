import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const targetCondominioId = process.env.SEED_CONDOMINIO_ID || null

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function resolveCondominioId(): Promise<string> {
  if (targetCondominioId) return targetCondominioId
  const { data, error } = await supabase.from('condominios').select('id').limit(1)
  if (error || !data || data.length === 0) {
    throw new Error('Não foi possível determinar um condominio_id. Defina SEED_CONDOMINIO_ID no .env')
  }
  return data[0].id
}

async function run() {
  try {
    const condominio_id = await resolveCondominioId()

    // cria assembleia em andamento
    const { data: ass, error: assErr } = await supabase
      .from('assembleias')
      .insert({
        condominio_id,
        titulo: 'Assembleia de Teste - Presença & Votação',
        data_hora: new Date().toISOString(),
        status: 'em_andamento',
        edital_topicos: ['Abertura', 'Ordem do dia', 'Encaminhamentos'],
        link_presenca: null,
      })
      .select('*')
      .single()

    if (assErr) throw assErr

    // cria pautas
    const { error: pautaErr } = await supabase.from('assembleias_pautas').insert([
      {
        assembleia_id: ass.id,
        titulo: 'Aprovação do orçamento 2026',
        descricao: 'Deliberação sobre o orçamento anual proposto pela administração.',
        ordem: 1,
        status: 'em_votacao',
        tipo_votacao: 'aberta',
        opcoes: ['Sim', 'Não', 'Abstenção'],
      },
      {
        assembleia_id: ass.id,
        titulo: 'Troca de empresa de portaria',
        descricao: 'Proposta de troca de fornecedor atual por melhor custo/benefício.',
        ordem: 2,
        status: 'pendente',
        tipo_votacao: 'secreta',
        opcoes: ['Trocar', 'Manter'],
      }
    ])

    if (pautaErr) throw pautaErr

    console.log('✅ Seed de assembleia criado com sucesso: ', ass.id)
    console.log('   Rota QR/link de presença: /transparencia/assembleias/' + ass.id + '/presenca')
  } catch (e) {
    console.error('❌ Falha ao semear assembleia:', e)
    process.exit(1)
  }
}

run()
