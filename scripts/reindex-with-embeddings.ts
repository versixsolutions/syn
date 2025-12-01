const QDRANT_URL = process.env.QDRANT_URL!
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN!
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'norma_knowledge_base'
const HF_API_URL =
  'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2'

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: text.substring(0, 512),
      options: { wait_for_model: true }
    })
  })

  if (!response.ok) {
    throw new Error(`HF API error: ${response.status}`)
  }

  const result = await response.json()

  if (Array.isArray(result) && Array.isArray(result[0])) {
    const dims = result[0].length
    const embedding = new Array(dims).fill(0)

    for (const tokenEmb of result) {
      for (let i = 0; i < dims; i++) {
        embedding[i] += tokenEmb[i] / result.length
      }
    }

    const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0))
    return embedding.map((v) => v / mag)
  }

  return result
}

async function reindex() {
  console.log('🚀 Iniciando re-indexação com embeddings reais...')

  console.log('📥 Buscando documentos existentes do Qdrant...')

  const scrollResp = await fetch(
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

      const embedding = await generateEmbedding(textForEmbedding)

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
