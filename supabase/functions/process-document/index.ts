import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { QdrantClient } from '../_shared/qdrant.ts'
import { generateEmbeddings } from '../_shared/embeddings.ts'
import { splitMarkdownIntoChunks } from '../_shared/chunking.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const condominioId = formData.get('condominio_id') as string
    const category = formData.get('category') as string || 'geral'

    if (!file) {
      throw new Error('Nenhum arquivo enviado')
    }

    console.log(`📄 Processando: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)

    // ===== PASSO 1: PROCESSAR PDF COM LLAMAPARSE =====
    const LLAMAPARSE_API_KEY = Deno.env.get('LLAMAPARSE_API_KEY')
    
    if (!LLAMAPARSE_API_KEY) {
      throw new Error('LLAMAPARSE_API_KEY não configurada')
    }

    const parseFormData = new FormData()
    parseFormData.append('file', file)
    parseFormData.append('result_type', 'markdown')
    parseFormData.append('language', 'pt')

    const parseResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
      },
      body: parseFormData
    })

    if (!parseResponse.ok) {
      throw new Error(`LlamaParse falhou: ${await parseResponse.text()}`)
    }

    const parseData = await parseResponse.json()
    const jobId = parseData.id

    // Aguardar processamento
    let markdown = ''
    let attempts = 0
    const maxAttempts = 30

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2 segundos

      const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
        headers: {
          'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
        }
      })

      if (resultResponse.ok) {
        const result = await resultResponse.json()
        markdown = result.markdown
        break
      }

      attempts++
      console.log(`⏳ Aguardando processamento... (${attempts}/${maxAttempts})`)
    }

    if (!markdown || markdown.length < 50) {
      throw new Error('Falha ao extrair texto do PDF')
    }

    console.log(`✅ PDF processado: ${markdown.length} caracteres`)

    // ===== PASSO 2: QUEBRAR EM CHUNKS =====
    const chunks = splitMarkdownIntoChunks(markdown, file.name)
    console.log(`📦 Gerados ${chunks.length} chunks`)

    // ===== PASSO 3: GERAR EMBEDDINGS =====
    const texts = chunks.map(c => c.content)
    const embeddings = await generateEmbeddings(texts)
    console.log(`🧮 Gerados ${embeddings.length} embeddings`)

    // ===== PASSO 4: INDEXAR NO QDRANT =====
    const qdrant = new QdrantClient()
    const timestamp = Date.now()

    const points = chunks.map((chunk, i) => ({
      id: `${condominioId}-${timestamp}-${i}`,
      vector: embeddings[i],
      payload: {
        content: chunk.content,
        title: file.name,
        condominio_id: condominioId,
        category: category,
        chunk_number: chunk.metadata.chunk_number,
        total_chunks: chunks.length,
        created_at: new Date().toISOString()
      }
    }))

    await qdrant.upsertPoints(points)
    console.log(`✅ ${points.length} pontos indexados no Qdrant`)

    // ===== RETORNAR RESULTADO =====
    return new Response(
      JSON.stringify({
        success: true,
        markdown: markdown,
        chunks_created: chunks.length,
        file_name: file.name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('❌ Erro:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})