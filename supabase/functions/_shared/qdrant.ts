// Helper functions para Qdrant
export interface QdrantPoint {
  id: string | number
  vector: number[]
  payload: {
    content: string
    title: string
    condominio_id: string
    doc_id?: number
    category?: string
    created_at: string
    [key: string]: any
  }
}

export class QdrantClient {
  private url: string
  private apiKey: string
  private collectionName: string

  constructor() {
    this.url = Deno.env.get('QDRANT_URL')!
    this.apiKey = Deno.env.get('QDRANT_API_KEY')!
    this.collectionName = Deno.env.get('QDRANT_COLLECTION_NAME') || 'norma_knowledge_base'
  }

  async createCollection(vectorSize: number = 384) {
    const response = await fetch(`${this.url}/collections/${this.collectionName}`, {
      method: 'PUT',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        vectors: {
          size: vectorSize,
          distance: 'Cosine'
        },
        optimizers_config: {
          indexing_threshold: 10000
        }
      })
    })

    if (!response.ok && response.status !== 409) { // 409 = já existe
      throw new Error(`Erro ao criar collection: ${await response.text()}`)
    }

    return response.ok
  }

  async upsertPoints(points: QdrantPoint[]) {
    const response = await fetch(`${this.url}/collections/${this.collectionName}/points`, {
      method: 'PUT',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ points })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Erro ao inserir pontos: ${error}`)
    }

    return await response.json()
  }

  async search(vector: number[], limit: number = 5, filter?: any) {
    const payload: any = {
      vector,
      limit,
      with_payload: true,
      score_threshold: 0.7 // Só resultados relevantes
    }

    if (filter) {
      payload.filter = filter
    }

    const response = await fetch(`${this.url}/collections/${this.collectionName}/points/search`, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Erro na busca: ${await response.text()}`)
    }

    const data = await response.json()
    return data.result || []
  }

  async deleteByFilter(filter: any) {
    const response = await fetch(`${this.url}/collections/${this.collectionName}/points/delete`, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filter })
    })

    if (!response.ok) {
      throw new Error(`Erro ao deletar: ${await response.text()}`)
    }

    return await response.json()
  }
}