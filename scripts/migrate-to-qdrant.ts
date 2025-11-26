import { createClient } from '@supabase/supabase-js'
import { pipeline } from '@xenova/transformers'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const QDRANT_URL = process.env.QDRANT_URL!
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'norma_knowledge_base'

let embedder: any = null

// Função auxiliar de chunking (igual à do Edge Function)
function splitMarkdownIntoChunks(markdown: string, docTitle: string, chunkSize = 1000): any[] {
  const sectionRegex = /(?=\n#{1,3}\s+)|(?=\n\*\*\s*Artigo)/
  const rawSections = markdown.split(sectionRegex)
  
  const chunks: any[] = []
  let currentChunk = `Documento: ${docTitle}\n\n`
  let chunkNumber = 0

  for (const section of rawSections) {
    const trimmed = section.trim()
    if (trimmed.length < 50) continue

    if (currentChunk.length + trimmed.length > chunkSize && currentChunk.length > 100) {
      chunks.push({
        content: currentChunk.trim(),
        chunk_number: chunkNumber
      })
      currentChunk = `Documento: ${docTitle}\n\n${trimmed}\n\n`
      chunkNumber++
    } else {
      currentChunk += `${trimmed}\n\n`
    }
  }

  if (currentChunk.trim().length > 100) {
    chunks.push({
      content: currentChunk.trim(),
      chunk_number: chunkNumber
    })
  }

  return chunks
}

async function generateEmbedding(text: string): Promise<number[]> {
  if (!embedder) {
    console.log('🔄 Carregando modelo de embedding...')
    embedder = await pipeline('feature-extraction', 'Supabase/gte-small')
  }

  const output = await embedder(text, {
    pooling: 'mean',
    normalize: true
  })

  return Array.from(output.data)
}

async function migrate() {
  console.log('🚀 Iniciando migração de documentos para Qdrant...\n')

  try {
    // Buscar todos os documentos principais (não chunks)
    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .is('metadata->>is_chunk', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!documents || documents.length === 0) {
      console.log('⚠️  Nenhum documento encontrado no Supabase')
      return
    }

    console.log(`📚 Encontrados ${documents.length} documentos\n`)

    let totalChunks = 0
    let processedDocs = 0

    for (const doc of documents) {
      console.log(`\n📄 Processando: ${doc.title || doc.metadata?.title || 'Sem título'}`)
      
      if (!doc.content || doc.content.length < 50) {
        console.log('   ⏭️  Pulando (conteúdo vazio ou muito curto)')
        continue
      }

      // Quebrar em chunks
      const chunks = splitMarkdownIntoChunks(
        doc.content,
        doc.title || doc.metadata?.title || 'Documento'
      )

      console.log(`   📦 ${chunks.length} chunks criados`)

      // Gerar embeddings e indexar
      const points = []
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        
        // Gerar embedding
        const embedding = await generateEmbedding(chunk.content)
        
        points.push({
          id: `${doc.condominio_id}-${doc.id}-${i}`,
          vector: embedding,
          payload: {
            content: chunk.content,
            title: doc.title || doc.metadata?.title || 'Documento',
            condominio_id: doc.condominio_id,
            doc_id: doc.id,
            category: doc.metadata?.category || 'geral',
            chunk_number: chunk.chunk_number,
            total_chunks: chunks.length,
            created_at: doc.created_at
          }
        })

        process.stdout.write(`   🧮 Embeddings: ${i + 1}/${chunks.length}\r`)
      }

      // Enviar para Qdrant em batch
      const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
        method: 'PUT',
        headers: {
          'api-key': QDRANT_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ points })
      })

      if (!response.ok) {
        throw new Error(`Erro ao indexar: ${await response.text()}`)
      }

      console.log(`\n   ✅ ${points.length} pontos indexados no Qdrant`)
      
      totalChunks += points.length
      processedDocs++
    }

    console.log('\n' + '='.repeat(50))
    console.log(`✅ Migração concluída!`)
    console.log(`   📚 Documentos processados: ${processedDocs}`)
    console.log(`   📦 Total de chunks indexados: ${totalChunks}`)
    console.log('='.repeat(50) + '\n')

  } catch (error: any) {
    console.error('\n❌ Erro:', error.message)
    process.exit(1)
  }
}

migrate()