import { HfInference } from '@huggingface/inference'
import { readFileSync } from 'fs'
import { join } from 'path'

// Carregar .env manualmente
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim()
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Não foi possível carregar .env')
  }
}

loadEnv()

const QDRANT_URL = process.env.QDRANT_URL!
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN!
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'norma_knowledge_base'

async function generateEmbedding(text: string, hf: HfInference): Promise<number[]> {
  const result = await hf.featureExtraction({
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    inputs: text.substring(0, 512)
  })

  let embedding: number[]
  
  if (Array.isArray(result)) {
    embedding = result as number[]
  } else {
    throw new Error('Formato de resposta inesperado')
  }

  // L2 normalize
  const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0))
  return embedding.map((v) => v / mag)
}

async function reindex() {
  console.log('🚀 Iniciando re-indexação com embeddings reais...')

  if (!HF_TOKEN) {
    console.error('❌ HUGGINGFACE_TOKEN não configurado no .env')
    process.exit(1)
  }

  const hf = new HfInference(HF_TOKEN)

  console.log('📥 Buscando documentos existentes do Qdrant...')

  const scrollResp = await fetch(
    `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`,
    {
      method: 'POST',
      headers: {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        limit: 1000,
        with_payload: true,
        with_vector: false
      })
    }
  )

  if (!scrollResp.ok) {
    throw new Error(`Qdrant scroll error: ${await scrollResp.text()}`)
  }

  const scrollData = await scrollResp.json()
  const existingPoints = scrollData.result?.points || []

  console.log(`📄 ${existingPoints.length} documentos encontrados`)

  const newPoints: any[] = []
  let processed = 0
  let errors = 0

  for (const point of existingPoints) {
    try {
      const content = point.payload.content || ''
      const title = point.payload.title || ''
      const textForEmbedding = `${title}. ${content}`.substring(0, 512)

      console.log(`🔄 [${processed + 1}/${existingPoints.length}] Processando: ${title.substring(0, 50)}...`)

      const embedding = await generateEmbedding(textForEmbedding, hf)

      newPoints.push({
        id: point.id,
        vector: embedding,
        payload: point.payload
      })

      processed++

      await new Promise((r) => setTimeout(r, 200))
    } catch (error) {
      console.error(`❌ Erro no documento ${point.id}:`, error)
      errors++
    }
  }

  console.log(`\n✅ ${processed} embeddings gerados, ${errors} erros`)

  console.log('🗑️ Recriando collection no Qdrant...')

  await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    method: 'DELETE',
    headers: { 'api-key': QDRANT_API_KEY }
  })

  const createResp = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    method: 'PUT',
    headers: {
      'api-key': QDRANT_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vectors: {
        size: 384,
        distance: 'Cosine'
      }
    })
  })

  if (!createResp.ok) {
    throw new Error(`Erro ao criar collection: ${await createResp.text()}`)
  }

  console.log('✅ Collection recriada')

  console.log('📤 Inserindo pontos com embeddings reais...')

  for (let i = 0; i < newPoints.length; i += 100) {
    const batch = newPoints.slice(i, i + 100)

    const upsertResp = await fetch(
      `${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`,
      {
        method: 'PUT',
        headers: {
          'api-key': QDRANT_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ points: batch })
      }
    )

    if (!upsertResp.ok) {
      console.error(`❌ Erro no batch ${i}-${i + batch.length}:`, await upsertResp.text())
    } else {
      console.log(`✅ Batch ${i + 1}-${Math.min(i + 100, newPoints.length)} inserido`)
    }
  }

  console.log('\n🎉 Re-indexação concluída!')
  console.log(`📊 Total: ${newPoints.length} documentos com embeddings reais`)
}

reindex().catch((err) => {
  console.error('❌ Erro geral na reindexação:', err)
  process.exit(1)
})
