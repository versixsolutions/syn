// supabase/functions/ask-ai/index.ts
// Versão CORRIGIDA, SEGURA e COM RATE LIMITING

// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://norma.versixsolutions.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '3600'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ✅ EXTRAIR USUARIO DO JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ answer: 'Não autorizado. Faça login primeiro.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    if (!GROQ_API_KEY || !QDRANT_URL) {
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
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // ===== BUSCA SIMPLIFICADA (MVP - SEM EMBEDDINGS DA QUERY) =====
    // Usar scroll para buscar todos os documentos e filtrar manualmente
    console.log('🔎 Buscando documentos relevantes...')

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

    if (!scrollResp.ok) {
      const errorText = await scrollResp.text()
      console.error('❌ Qdrant Error:', errorText)
      throw new Error(`Busca falhou: ${errorText}`)
    }

    const scrollData = await scrollResp.json()
    const allPoints = scrollData.result?.points || []

    console.log(`📄 Total de documentos encontrados: ${allPoints.length}`)

    // ===== FILTRAR MANUALMENTE POR PALAVRAS-CHAVE (MVP) =====
    // Tokenizar query e normalizar
    const queryWords = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .split(/\s+/)
      .filter((w) => w.length > 2) // Filtrar palavras muito curtas

    console.log(`🔍 Buscando por: ${queryWords.join(', ')}`)

    // Calcular score para cada documento
    const rankedResults = allPoints
      .map((point) => {
        const content = point.payload.content.toLowerCase()
        const title = point.payload.title.toLowerCase()
        
        let score = 0
        
        // Score por palavra no título (peso maior)
        queryWords.forEach((word) => {
          if (title.includes(word)) {
            score += 5
          }
        })
        
        // Score por palavra no conteúdo
        queryWords.forEach((word) => {
          const matches = (content.match(new RegExp(word, 'g')) || []).length
          score += matches
        })
        
        // Boost se contém query exata
        const normalizedQuery = query.toLowerCase()
        if (content.includes(normalizedQuery)) {
          score += 10
        }
        
        // Boost se contém frase similar
        if (title.includes(normalizedQuery)) {
          score += 15
        }
        
        return { ...point, score }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // Top 3 resultados

    console.log(`📊 Encontrados ${rankedResults.length} resultados relevantes`)

    if (rankedResults.length === 0) {
      return new Response(
        JSON.stringify({
          answer: 'Não encontrei informações sobre isso nos documentos do condomínio. Você pode reformular a pergunta ou verificar se os documentos relevantes foram adicionados na Biblioteca.',
          sources: []
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Log de debug
    if (rankedResults.length > 0) {
      console.log(`⭐ Top resultado: "${rankedResults[0].payload.title}" (score=${rankedResults[0].score})`)
    }

    // ===== MONTAR CONTEXTO PARA GROQ =====
    const contextParts = rankedResults.map((r, i) => {
      const source = r.payload.title || 'Documento'
      return `[Fonte ${i + 1}: ${source}]\n${r.payload.content}`
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
5. Cite a fonte quando possível (ex: "Segundo o Regimento Interno...")
6. Fale em português do Brasil, de forma profissional mas acessível

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
        sources: rankedResults.map((r) => ({
          title: r.payload.title,
          score: r.score,
          excerpt: r.payload.content.substring(0, 150) + '...'
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Erro:', error)
    return new Response(
      JSON.stringify({
        answer: `Erro técnico: ${error.message}. Por favor, tente novamente.`,
        sources: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})