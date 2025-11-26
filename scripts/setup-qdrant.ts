import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const QDRANT_URL = process.env.QDRANT_URL!
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'norma_knowledge_base'

async function setupQdrant() {
  console.log('🚀 Configurando Qdrant Cloud...\n')

  try {
    // Criar collection
    console.log(`📦 Criando collection: ${COLLECTION_NAME}`)
    
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      method: 'PUT',
      headers: {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        vectors: {
          size: 384, // Dimensão do modelo gte-small
          distance: 'Cosine'
        },
        optimizers_config: {
          indexing_threshold: 10000
        }
      })
    })

    if (response.status === 409) {
      console.log('⚠️  Collection já existe (isso é OK)')
    } else if (response.ok) {
      console.log('✅ Collection criada com sucesso!')
    } else {
      throw new Error(`Erro: ${await response.text()}`)
    }

    // Verificar collection
    const infoResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      headers: { 'api-key': QDRANT_API_KEY }
    })

    if (infoResponse.ok) {
      const info = await infoResponse.json()
      console.log('\n📊 Informações da Collection:')
      console.log(`   - Nome: ${info.result.name}`)
      console.log(`   - Vetores: ${info.result.vectors_count || 0}`)
      console.log(`   - Status: ${info.result.status}`)
    }

    console.log('\n✅ Setup concluído! Qdrant está pronto para uso.')

  } catch (error: any) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  }
}

setupQdrant()