import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'

let embedder: any = null

export async function generateEmbedding(text: string): Promise<number[]> {
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

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []
  
  for (const text of texts) {
    const embedding = await generateEmbedding(text)
    embeddings.push(embedding)
  }
  
  return embeddings
}