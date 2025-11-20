// scripts/seed-knowledge.ts
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'

// Carrega as variáveis do arquivo .env
dotenv.config()

// CORREÇÃO: Acessamos pelo NOME da variável, não pelo valor
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error('❌ Erro: Faltam variáveis no arquivo .env')
  console.error('Verifique se SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e OPENAI_API_KEY estão definidos.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiKey })

const documents = [
  {
    title: "Horário de Silêncio",
    content: "Artigo 1º: Cumpre aos condôminos guardar silêncio no período de 22h00min às 06h00min. Exceção: Em Julho, Dezembro e Janeiro, o silêncio é das 23h00min às 08h00min."
  },
  {
    title: "Coleta de Lixo",
    content: "Artigo 3º: A coleta de lixo é feita diariamente pelo zelador das 07:30h às 08:30h e das 15:30h às 16:00h (exceto domingos e feriados). O lixo deve ser colocado na frente das unidades nesses horários."
  },
  {
    title: "Área de Lazer (Horários)",
    content: "Artigo 4º: É vedado o uso da área de lazer (piscina, quadra, playground) de 23h00h às 06h00h. Artigo 5º: Salão de festas permitido até 01h00 da manhã."
  },
  {
    title: "Uso da Piscina",
    content: "Artigo 28º: A piscina é de uso exclusivo dos condôminos e convidados (máximo 4 pessoas). É proibido o uso por empregados domésticos. Artigo 30º: Proibido usar copos de vidro, comer na borda ou usar trajes jeans."
  },
  {
    title: "Animais de Estimação",
    content: "Artigo 34º: Permitido até 02 animais por unidade. Devem circular com coleira. Proibida permanência na área de lazer. Dejetos devem ser recolhidos imediatamente. Proibido animais de grande porte ou agressivos."
  },
  {
    title: "Mudanças e Obras",
    content: "Artigo 44º: Mudanças permitidas de Seg a Sex (08h-12h e 14h-18h) e Sáb (08h-12h e 14h-18h). Proibido em domingos e feriados. Exige apresentação de contrato de locação ou documento de compra."
  },
  {
    title: "Entregadores e Segurança",
    content: "Artigo 8º (Parágrafo Único): Por segurança, não é permitido o acesso de entregadores (iFood, gás, etc.) ao interior do condomínio. O morador deve receber na portaria."
  },
  {
    title: "Velocidade no Condomínio",
    content: "Artigo 13º: A velocidade máxima de qualquer veículo dentro do condomínio é de 10 km/h."
  },
  {
    title: "Multas e Penalidades",
    content: "Artigo 79º: Infrações sujeitas a: I) Advertência escrita; II) Multa de 1 taxa condominial na reincidência. Casos graves que incomodem diversos moradores podem gerar multa direta sem advertência."
  }
]

async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  })
  return response.data[0].embedding
}

async function seed() {
  console.log('🚀 Iniciando povoamento da base de conhecimento...')

  for (const doc of documents) {
    console.log(`Processando: ${doc.title}`)
    
    try {
      const embedding = await generateEmbedding(doc.content)

      const { error } = await supabase.from('documents').insert({
        content: doc.content,
        metadata: { title: doc.title, source: 'Regimento Interno 2025' },
        embedding: embedding
      })

      if (error) console.error('Erro ao inserir:', error.message)
      else console.log('✅ Salvo com sucesso!')

    } catch (e) {
      console.error('Falha ao processar:', e)
    }
  }

  console.log('🏁 Processo finalizado!')
}

seed()