// supabase/functions/ask-ai/index.ts
// Versão com busca vetorial real (HuggingFace + Qdrant) e rate limiting

// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateEmbedding } from '../_shared/embeddings-hf.ts'

// ✅ ORIGENS PERMITIDAS
const ALLOWED_ORIGINS = [
  'https://versixnorma.com.br',
  'https://www.versixnorma.com.br',
  'https://app.versixnorma.com.br',
  'http://localhost:5173',
  'http://localhost:3000'
]

// ✅ FUNÇÃO PARA OBTER CORS HEADERS VÁLIDOS (um único origin por vez)
function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '3600',
    'Content-Type': 'application/json'
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const corsHeaders = getCorsHeaders(origin)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ✅ EXTRAIR USUARIO DO JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ answer: 'Não autorizado. Faça login primeiro.' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Usar o JWT para rate limiting (mesmo sem validar, o header já indica um usuário)
    const token = authHeader.replace('Bearer ', '')
    const userId = token.substring(0, 36) // Usar primeiros 36 chars como ID (UUID-like)

    const { query, userName, filter_condominio_id } = await req.json()

    // ✅ VALIDAÇÃO CRÍTICA: Todos os parâmetros são obrigatórios
    if (!query) {
      throw new Error('Query não fornecida')
    }

    if (!query.trim() || query.length > 500) {
      throw new Error('Query inválida: deve ter entre 1 e 500 caracteres')
    }

    if (!filter_condominio_id || typeof filter_condominio_id !== 'string') {
      throw new Error('Condomínio não especificado ou inválido')
    }

    if (!userName || typeof userName !== 'string') {
      throw new Error('Nome de usuário inválido')
    }

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    const QDRANT_URL = Deno.env.get('QDRANT_URL')
    const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY')
    const COLLECTION_NAME = Deno.env.get('QDRANT_COLLECTION_NAME') || 'norma_knowledge_base'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

    if (!GROQ_API_KEY || !QDRANT_URL || !QDRANT_API_KEY) {
      throw new Error('Configurações ausentes')
    }

    // ✅ RATE LIMITING: 50 requisições por hora por usuário
    console.log(`⏱️ Verificando rate limit para usuário: ${userId}`)
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
      
      const { count, error: countError } = await supabase
        .from('ai_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneHourAgo)
      
      if (!countError && count && count >= 50) {
        console.warn(`⚠️ Rate limit atingido para usuário: ${userId}`)
        return new Response(
          JSON.stringify({ 
            answer: '🚫 Limite de requisições atingido. Máximo 50 por hora. Tente novamente em alguns minutos.' 
          }),
          { status: 429, headers: corsHeaders }
        )
      }

      // ✅ Registrar requisição para rate limiting
      await supabase.from('ai_requests').insert({
        user_id: userId,
        query: query.substring(0, 200),
        condominio_id: filter_condominio_id,
        created_at: new Date().toISOString()
      }).then(({ error }) => {
        if (error) console.warn('Aviso ao registrar request:', error.message)
      })

      console.log(`✅ Taxa dentro do limite. Requisições nesta hora: ${count || 0}/50`)
    }

    console.log(`🔍 Query: "${query}"`)
    console.log(`🏢 Condomínio: ${filter_condominio_id}`)

    // ===== EMBEDDING DA QUERY =====
    console.log('🧠 Gerando embedding da query...')
    const { embedding: queryEmbedding, error: embError, cached } = await generateEmbedding(query)

    if (embError) {
      console.warn(`⚠️ Erro no embedding: ${embError}. Usando fallback keyword.`)
    }

    const hasRealEmbedding = queryEmbedding.some((v) => v !== 0)
    console.log(`📊 Embedding ${cached ? '(cache)' : '(novo)'}: ${hasRealEmbedding ? 'REAL' : 'FALLBACK'}`)

    let documentResults: any[] = []

    // ===== BUSCA VETORIAL (QDRANT) =====
    if (hasRealEmbedding) {
      console.log('🔎 Busca vetorial semântica no Qdrant...')

      const searchResp = await fetch(
        `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`,
        {
          method: 'POST',
          headers: {
            'api-key': QDRANT_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vector: queryEmbedding,
            limit: 5,
            score_threshold: 0.35,
            filter: {
              must: [
                {
                  key: 'condominio_id',
                  match: { value: filter_condominio_id }
                }
              ]
            },
            with_payload: true
          })
        }
      )

      if (!searchResp.ok) {
        const errorText = await searchResp.text()
        console.error('❌ Erro na busca vetorial:', errorText)
      } else {
        const searchData = await searchResp.json()
        documentResults = (searchData.result || []).map((r: any) => ({
          ...r,
          type: 'document',
          relevance_score: r.score
        }))
        console.log(`📄 ${documentResults.length} documentos encontrados via busca vetorial`)
      }
    }

    // ===== FALLBACK: BUSCA POR KEYWORDS (QDRANT SCROLL) =====
    let allPoints: any[] = []
    if (!hasRealEmbedding || documentResults.length === 0) {
      console.log('⚠️ Fallback: busca por palavras-chave...')

      const scrollResp = await fetch(
        `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`,
        {
          method: 'POST',
          headers: {
            'api-key': QDRANT_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filter: {
              must: [
                {
                  key: 'condominio_id',
                  match: { value: filter_condominio_id }
                }
              ]
            },
            limit: 50,
            with_payload: true
          })
        }
      )

      if (scrollResp.ok) {
        const scrollData = await scrollResp.json()
        allPoints = scrollData.result?.points || []
      } else {
        const errorText = await scrollResp.text()
        console.error('❌ Qdrant Error (scroll):', errorText)
        allPoints = []
      }
    }

    // ===== BUSCA DE FAQs =====
    console.log('❓ Buscando FAQs relevantes...')
    let faqs: any[] = []
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        const { data: faqData, error: faqError } = await supabase
          .from('faqs')
          .select('id, question, answer, category_id, created_at')
          .order('created_at', { ascending: false })
        
        if (!faqError && faqData) {
          faqs = faqData as any[]
          console.log(`✅ Total de FAQs encontradas: ${faqs.length}`)
        } else {
          console.warn('⚠️ Erro ao buscar FAQs:', faqError?.message)
        }
      } catch (err) {
        console.warn('⚠️ Erro ao conectar com FAQs:', err)
      }
    }

    // ===== TOKENIZAÇÃO PARA FALLBACK / FAQ =====
    const queryWords = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter((w: string) => w.length > 2)

    console.log(`🔍 Buscando por: ${queryWords.join(', ')}`)

    // Se usamos fallback keyword, ranquear documentos manualmente
    if (!hasRealEmbedding || documentResults.length === 0) {
      documentResults = allPoints
        .map((point: any) => {
          const content = (point.payload.content || '').toLowerCase()
          const title = (point.payload.title || '').toLowerCase()

          let score = 0

          queryWords.forEach((word: string) => {
            if (title.includes(word)) score += 5
            const matches = (content.match(new RegExp(word, 'g')) || []).length
            score += matches
          })

          const normalizedQuery = query.toLowerCase()
          if (content.includes(normalizedQuery)) score += 10
          if (title.includes(normalizedQuery)) score += 15

          return { ...point, type: 'document', relevance_score: score / 10 }
        })
        .filter((r: any) => r.relevance_score > 0)
        .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
        .slice(0, 5)
    }

    // ===== RANKING DE FAQs (COM OU SEM EMBEDDING) =====
    console.log('⭐ Calculando relevância de FAQs...')
    let faqResults: any[] = []

    if (faqs.length) {
      if (hasRealEmbedding) {
        // IA: usar embeddings também para FAQs
        const faqsWithScores = await Promise.all(
          faqs.slice(0, 20).map(async (faq: any) => {
            const { embedding: faqEmb } = await generateEmbedding(faq.question)

            const dotProduct = queryEmbedding.reduce(
              (sum, val, i) => sum + val * (faqEmb[i] ?? 0),
              0
            )

            const similarity = dotProduct

            return {
              ...faq,
              type: 'faq',
              relevance_score: similarity,
              payload: { title: faq.question, content: faq.answer }
            }
          })
        )

        faqResults = faqsWithScores
          .filter((f) => f.relevance_score > 0.4)
          .sort((a, b) => b.relevance_score - a.relevance_score)
          .slice(0, 3)
      } else {
        // Fallback: ranking keyword
        const normalizedQuery = query.toLowerCase()
        faqResults = faqs
          .map((faq: any) => {
            const question = faq.question.toLowerCase()
            const answer = faq.answer.toLowerCase()
            let score = 0

            queryWords.forEach((word: string) => {
              if (question.includes(word)) score += 6
              const matches = (answer.match(new RegExp(word, 'g')) || []).length
              score += matches * 0.5
            })

            if (question.includes(normalizedQuery)) score += 20
            if (answer.includes(normalizedQuery)) score += 10

            return {
              ...faq,
              type: 'faq',
              relevance_score: score / 10,
              payload: { title: faq.question, content: faq.answer }
            }
          })
          .filter((r: any) => r.relevance_score > 0)
          .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
          .slice(0, 3)
      }
    }

    const allResults = [...documentResults, ...faqResults]
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 4)

    console.log(`📊 Encontrados ${allResults.length} resultados combinados`)

    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            'Não encontrei informações sobre isso nos documentos ou FAQs do condomínio. Você pode reformular a pergunta ou verificar se os documentos relevantes foram adicionados na Biblioteca.',
          sources: [],
          search_type: hasRealEmbedding ? 'semantic' : 'keyword'
        }),
        { headers: corsHeaders }
      )
    }

    // Log de debug
    if (allResults.length > 0) {
      console.log(`⭐ Top resultado: "${allResults[0].payload.title}" [${allResults[0].type}] (score=${allResults[0].score})`)
    }

    // ===== MONTAR CONTEXTO PARA GROQ =====
    const contextParts = allResults.map((r: any, i: number) => {
      const source = r.payload.title || 'Documento'
      const type = r.type === 'faq' ? '❓ FAQ' : '📄 Documento'
      return `[Fonte ${i + 1} - ${type}: ${source}]\n${r.payload.content}`
    })

    const contextText = contextParts.join('\n\n---\n\n')

    console.log(`💬 Contexto: ${contextText.length} caracteres`)

    // ===== PROMPT ENGINEERING =====
    const systemPrompt = `Você é a Norma, assistente virtual de gestão condominial.

**INSTRUÇÕES CRÍTICAS:**
1. Responda APENAS com base no CONTEXTO fornecido abaixo
2. Se a informação NÃO estiver no contexto, diga: "Não encontrei essa informação nos documentos disponíveis"
3. Seja concisa e objetiva (máximo 150 palavras)
4. Use bullets quando listar múltiplos itens
5. Cite a fonte quando possível (ex: "Segundo o Regimento Interno..." ou "Conforme a FAQ...")
6. Fale em português do Brasil, de forma profissional mas acessível
7. Priorize informações de FAQs quando forem mais claras e objetivas

**CONTEXTO:**
${contextText}

**IMPORTANTE:** Não invente informações. Se não souber, admita.`

    console.log('🤖 Chamando Groq...')

    // ===== CHAMAR GROQ LLM =====
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
        temperature: 0.1,
        max_tokens: 500
      })
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('❌ Groq Error:', errorText)
      throw new Error(`Groq API falhou: ${errorText}`)
    }

    const groqData = await groqResponse.json()
    const answer = groqData.choices?.[0]?.message?.content || 'Erro ao gerar resposta'

    console.log(`✅ Resposta gerada (${answer.length} caracteres)`)

    // ===== RETORNAR RESPOSTA =====
    return new Response(
      JSON.stringify({
        answer,
        sources: allResults.map((r: any) => ({
          title: r.payload.title,
          type: r.type,
          score: r.score,
          excerpt: r.payload.content.substring(0, 150) + '...'
        }))
      }),
      { headers: corsHeaders }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ Erro:', errorMessage)
    return new Response(
      JSON.stringify({
        answer: `Erro técnico: ${errorMessage}. Por favor, tente novamente.`,
        sources: []
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})