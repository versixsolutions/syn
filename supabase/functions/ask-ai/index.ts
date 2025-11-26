import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { QdrantClient } from '../_shared/qdrant.ts'
import { generateEmbedding } from '../_shared/embeddings.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, userName, filter_condominio_id } = await req.json()

    if (!query) {
      throw new Error('Query não fornecida')
    }

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')

    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY não configurada')
    }

    console.log(`🔍 Query: "${query}"`)
    console.log(`🏢 Condomínio: ${filter_condominio_id}`)

    // ===== PASSO 1: GERAR EMBEDDING DA PERGUNTA =====
    const queryVector = await generateEmbedding(query)
    console.log(`🧮 Embedding gerado (${queryVector.length} dimensões)`)

    // ===== PASSO 2: BUSCAR NO QDRANT =====
    const qdrant = new QdrantClient()
    
    const filter = {
      must: [
        {
          key: 'condominio_id',
          match: { value: filter_condominio_id }
        }
      ]
    }

    const searchResults = await qdrant.search(queryVector, 5, filter)
    console.log(`📊 Encontrados ${searchResults.length} resultados`)

    if (searchResults.length === 0) {
      return new Response(
        JSON.stringify({
          answer: 'Não encontrei informações sobre isso nos documentos do seu condomínio. Você pode reformular a pergunta ou adicionar documentos relevantes na Biblioteca.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // ===== PASSO 3: RE-RANKING (Ordenar por relevância) =====
    const rankedResults = searchResults
      .filter(r => r.score > 0.7) // Só resultados com >70% de relevância
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // Top 3

    console.log(`⭐ Top resultado: score=${rankedResults[0]?.score.toFixed(3)}`)

    // ===== PASSO 4: MONTAR CONTEXTO =====
    const contextParts = rankedResults.map((r, i) => {
      const source = r.payload.title || 'Documento'
      return `[Fonte ${i + 1}: ${source}]\n${r.payload.content}`
    })

    const contextText = contextParts.join('\n\n---\n\n')

    console.log(`💬 Contexto: ${contextText.length} caracteres`)

    // ===== PASSO 5: PROMPT ENGINEERING =====
    const systemPrompt = `Você é a Norma, assistente virtual de gestão condominial.

**INSTRUÇÕES CRÍTICAS:**
1. Responda APENAS com base no CONTEXTO fornecido abaixo
2. Se a informação NÃO estiver no contexto, diga: "Não encontrei essa informação nos documentos disponíveis"
3. Seja concisa e objetiva (máximo 150 palavras)
4. Use bullets quando listar múltiplos itens
5. Cite a fonte quando possível (ex: "Segundo o Regimento Interno...")
6. Fale em português do Brasil, de forma profissional mas acessível

**CONTEXTO:**
${contextText}

**IMPORTANTE:** Não invente informações. Se não souber, admita.`

    // ===== PASSO 6: CHAMAR GROQ (Llama 3.3 70B) =====
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.1, // Menos criativo = mais fiel ao contexto
        max_tokens: 500
      })
    })

    if (!groqResponse.ok) {
      throw new Error(`Groq API falhou: ${await groqResponse.text()}`)
    }

    const groqData = await groqResponse.json()
    const answer = groqData.choices?.[0]?.message?.content || 'Erro ao gerar resposta'

    console.log(`✅ Resposta gerada (${answer.length} caracteres)`)

    // ===== PASSO 7: RETORNAR RESULTADO =====
    return new Response(
      JSON.stringify({
        answer,
        sources: rankedResults.map(r => ({
          title: r.payload.title,
          score: r.score,
          excerpt: r.payload.content.substring(0, 150) + '...'
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error: any) {
    console.error('❌ Erro:', error)
    return new Response(
      JSON.stringify({
        answer: `Erro técnico: ${error.message}. Por favor, tente novamente.`
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})