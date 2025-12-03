// supabase/functions/ask-ai/index.ts
// Versão com busca vetorial real (HuggingFace + Qdrant) e rate limiting

// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateEmbedding } from "../_shared/embeddings-hf.ts";

// ✅ ORIGENS PERMITIDAS
const ALLOWED_ORIGINS = [
  "https://versixnorma.com.br",
  "https://www.versixnorma.com.br",
  "https://app.versixnorma.com.br",
  "http://localhost:5173",
  "http://localhost:3000",
];

// ✅ FUNÇÃO PARA OBTER CORS HEADERS VÁLIDOS (um único origin por vez)
function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    "Content-Type": "application/json",
  };
}

// ✅ SANITIZA UTF-8 MAL CODIFICADO
function sanitizeUTF8(text: string): string {
  if (!text) return text;
  return text
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã£/g, "ã")
    .replace(/Ãµ/g, "õ")
    .replace(/Ã§/g, "ç")
    .replace(/Ã /g, "à")
    .replace(/Ãª/g, "ê")
    .replace(/Ã´/g, "ô")
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã/g, "Í")
    .replace(/Ã"/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ãƒ/g, "Ã")
    .replace(/Ã•/g, "Õ")
    .replace(/Ã‡/g, "Ç")
    .replace(/Ã‚/g, "Â")
    .replace(/ÃŠ/g, "Ê")
    .replace(/Ã"/g, "Ô")
    .replace(/Âº/g, "º")
    .replace(/Âª/g, "ª");
}

serve(async (req) => {
  const origin = req.headers.get("origin") || undefined;
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ✅ EXTRAIR USUARIO DO JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ answer: "Não autorizado. Faça login primeiro." }),
        { status: 401, headers: corsHeaders },
      );
    }

    // Usar o JWT para rate limiting (mesmo sem validar, o header já indica um usuário)
    const token = authHeader.replace("Bearer ", "");
    const userId = token.substring(0, 36); // Usar primeiros 36 chars como ID (UUID-like)

    const { query, userName, filter_condominio_id } = await req.json();

    // ✅ VALIDAÇÃO CRÍTICA: Todos os parâmetros são obrigatórios
    if (!query) {
      throw new Error("Query não fornecida");
    }

    if (!query.trim() || query.length > 500) {
      throw new Error("Query inválida: deve ter entre 1 e 500 caracteres");
    }

    if (!filter_condominio_id || typeof filter_condominio_id !== "string") {
      throw new Error("Condomínio não especificado ou inválido");
    }

    if (!userName || typeof userName !== "string") {
      throw new Error("Nome de usuário inválido");
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const QDRANT_URL = Deno.env.get("QDRANT_URL");
    const QDRANT_API_KEY = Deno.env.get("QDRANT_API_KEY");
    const COLLECTION_NAME =
      Deno.env.get("QDRANT_COLLECTION_NAME") || "norma_knowledge_base";
    const AI_COLLECTION_NAME =
      Deno.env.get("QDRANT_AI_COLLECTION_NAME") || "faqs_ai_collection";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!GROQ_API_KEY || !QDRANT_URL || !QDRANT_API_KEY) {
      throw new Error("Configurações ausentes");
    }

    // ✅ RATE LIMITING: 50 requisições por hora por usuário
    console.log(`⏱️ Verificando rate limit para usuário: ${userId}`);

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

      const { count, error: countError } = await supabase
        .from("ai_requests")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", oneHourAgo);

      if (!countError && count && count >= 50) {
        console.warn(`⚠️ Rate limit atingido para usuário: ${userId}`);
        return new Response(
          JSON.stringify({
            answer:
              "🚫 Limite de requisições atingido. Máximo 50 por hora. Tente novamente em alguns minutos.",
          }),
          { status: 429, headers: corsHeaders },
        );
      }

      // ✅ Registrar requisição para rate limiting
      await supabase
        .from("ai_requests")
        .insert({
          user_id: userId,
          query: query.substring(0, 200),
          condominio_id: filter_condominio_id,
          created_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.warn("Aviso ao registrar request:", error.message);
        });

      console.log(
        `✅ Taxa dentro do limite. Requisições nesta hora: ${count || 0}/50`,
      );
    }

    console.log(`🔍 Query: "${query}"`);
    console.log(`🏢 Condomínio: ${filter_condominio_id}`);

    // ===== EMBEDDING DA QUERY =====
    console.log("🧠 Gerando embedding da query...");
    const {
      embedding: queryEmbedding,
      error: embError,
      cached,
    } = await generateEmbedding(query);

    if (embError) {
      console.warn(
        `⚠️ Erro no embedding: ${embError}. Usando fallback keyword.`,
      );
    }

    const hasRealEmbedding = queryEmbedding.some((v) => v !== 0);
    console.log(
      `📊 Embedding ${cached ? "(cache)" : "(novo)"}: ${hasRealEmbedding ? "REAL" : "FALLBACK"}`,
    );

    let documentResults: any[] = [];

    // ===== BUSCA VETORIAL (QDRANT) =====
    if (hasRealEmbedding) {
      console.log("🔎 Busca vetorial semântica no Qdrant...");

      const searchResp = await fetch(
        `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`,
        {
          method: "POST",
          headers: {
            "api-key": QDRANT_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            vector: queryEmbedding,
            limit: 5,
            score_threshold: 0.15,
            filter: {
              must: [
                {
                  key: "condominio_id",
                  match: { value: filter_condominio_id },
                },
              ],
            },
            with_payload: true,
          }),
        },
      );

      if (!searchResp.ok) {
        const errorText = await searchResp.text();
        console.error("❌ Erro na busca vetorial:", errorText);
      } else {
        const searchData = await searchResp.json();
        documentResults = (searchData.result || []).map((r: any) => ({
          ...r,
          type: "document",
          relevance_score: r.score,
          payload: {
            ...r.payload,
            title: sanitizeUTF8(r.payload?.title || ""),
            content: sanitizeUTF8(r.payload?.content || ""),
          },
        }));
        console.log(
          `📄 ${documentResults.length} documentos encontrados via busca vetorial`,
        );
      }
    }

    // ===== FALLBACK: BUSCA POR KEYWORDS (QDRANT SCROLL) =====
    let allPoints: any[] = [];
    if (!hasRealEmbedding || documentResults.length === 0) {
      console.log("⚠️ Fallback: busca por palavras-chave...");

      const scrollResp = await fetch(
        `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`,
        {
          method: "POST",
          headers: {
            "api-key": QDRANT_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filter: {
              must: [
                {
                  key: "condominio_id",
                  match: { value: filter_condominio_id },
                },
              ],
            },
            limit: 50,
            with_payload: true,
          }),
        },
      );

      if (scrollResp.ok) {
        const scrollData = await scrollResp.json();
        allPoints = scrollData.result?.points || [];
      } else {
        const errorText = await scrollResp.text();
        console.error("❌ Qdrant Error (scroll):", errorText);
        allPoints = [];
      }
    }

    // ===== BUSCA DE FAQs (AI) =====
    console.log("❓ Buscando FAQs da base AI...");
    let faqs: any[] = [];

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: faqData, error: faqError } = await supabase
          .from("ai_faqs")
          .select(
            "id, question, answer, article_reference, category, created_at, condominio_id",
          )
          .or(`condominio_id.eq.${filter_condominio_id},condominio_id.is.null`)
          .order("created_at", { ascending: false });

        if (!faqError && faqData) {
          faqs = (faqData as any[]).map((faq) => ({
            ...faq,
            question: sanitizeUTF8(faq.question || ""),
            answer: sanitizeUTF8(faq.answer || ""),
          }));
          console.log(
            `✅ FAQs encontradas para condomínio ${filter_condominio_id}: ${faqs.length}`,
          );
        } else {
          console.warn("⚠️ Erro ao buscar FAQs:", faqError?.message);
        }
      } catch (err) {
        console.warn("⚠️ Erro ao conectar com FAQs:", err);
      }
    }

    // ===== TOKENIZAÇÃO PARA FALLBACK / FAQ =====
    const queryWords = query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .filter((w: string) => w.length > 2);

    console.log(`🔍 Buscando por: ${queryWords.join(", ")}`);

    // Se usamos fallback keyword, ranquear documentos manualmente
    if (!hasRealEmbedding || documentResults.length === 0) {
      documentResults = allPoints
        .map((point: any) => {
          const rawContent = point.payload.content || "";
          const rawTitle = point.payload.title || "";
          const content = rawContent
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          const title = rawTitle
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

          let score = 0;

          // Palavras completas
          queryWords.forEach((word: string) => {
            if (title.includes(word)) score += 5;
            const matches = (
              content.match(new RegExp(`\\b${word}\\b`, "g")) || []
            ).length;
            score += matches;
          });

          // Query inteira (normalizada) para casos de frase
          const normalizedQuery = query
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          if (content.includes(normalizedQuery)) score += 8;
          if (title.includes(normalizedQuery)) score += 12;

          return {
            ...point,
            type: "document",
            relevance_score: score / 10,
            payload: {
              ...point.payload,
              title: sanitizeUTF8(point.payload.title || ""),
              content: sanitizeUTF8(point.payload.content || ""),
            },
          };
        })
        .filter((r: any) => r.relevance_score > 0)
        .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
        .slice(0, 5);
    }

    // ===== RANKING DE FAQs (COM OU SEM EMBEDDING) =====
    console.log("⭐ Calculando relevância de FAQs...");
    let faqResults: any[] = [];

    if (faqs.length) {
      if (hasRealEmbedding) {
        // Try cache: fetch embeddings from faqs_vectors
        let vectorRows: any[] = [];
        try {
          if (SUPABASE_URL && SUPABASE_ANON_KEY) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: vecData } = await supabase
              .from("faqs_vectors")
              .select("faq_id, embedding")
              .in(
                "faq_id",
                faqs.slice(0, 50).map((f: any) => f.id),
              );
            vectorRows = vecData || [];
            console.log(
              `🗂️ Cache FAQ vectors: ${vectorRows.length}/${Math.min(50, faqs.length)} hits`,
            );
          }
        } catch (_) {
          /* ignore cache errors */
        }
        // IA: usar embeddings também para FAQs
        // Para evitar custo elevado, compare com a própria pergunta em keyword também
        const faqsWithScores = await Promise.all(
          faqs.slice(0, 50).map(async (faq: any) => {
            // Use cached embedding if available
            const cached = vectorRows.find((r: any) => r.faq_id === faq.id);
            try {
              const faqEmb: number[] = cached
                ? cached.embedding
                : (await generateEmbedding(faq.question)).embedding;
              const dotProduct = queryEmbedding.reduce(
                (sum, val, i) => sum + val * (faqEmb[i] ?? 0),
                0,
              );
              const similarity = dotProduct;
              return {
                ...faq,
                type: "faq",
                relevance_score: similarity,
                payload: {
                  title: faq.question,
                  content: faq.answer,
                  article_reference: faq.article_reference,
                },
              };
            } catch (_) {
              const q = faq.question.toLowerCase();
              let score = 0;
              queryWords.forEach((w: string) => {
                if (q.includes(w)) score += 1;
              });
              return {
                ...faq,
                type: "faq",
                relevance_score: score / 10,
                payload: {
                  title: faq.question,
                  content: faq.answer,
                  article_reference: faq.article_reference,
                },
              };
            }
          }),
        );

        faqResults = faqsWithScores
          .filter((f) => f.relevance_score > 0.15)
          .sort((a, b) => b.relevance_score - a.relevance_score)
          .slice(0, 3);

        // Log diagnóstico: mostrar top 5 scores mesmo se não passar threshold
        const top5Scores = faqsWithScores
          .sort((a, b) => b.relevance_score - a.relevance_score)
          .slice(0, 5)
          .map(
            (f) =>
              `${f.relevance_score.toFixed(4)} ("${f.payload.title.substring(0, 40)}...")`,
          );
        console.log(`📊 Top 5 FAQ scores: ${top5Scores.join(" | ")}`);

        if (faqResults.length) {
          console.log(`✅ ${faqResults.length} FAQ(s) acima do threshold 0.15`);
        } else {
          console.log(
            "ℹ️ Nenhuma FAQ acima do threshold 0.15 — aplicando fallback por texto exato",
          );
          const nq = query
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "");

          console.log(`🔍 Query normalizada para fallback: "${nq}"`);
          console.log(`🔍 Total de FAQs para avaliar: ${faqs.length}`);

          const keywordExact = faqs
            .map((faq: any) => {
              const q = String(faq.question || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/\p{Diacritic}/gu, "");
              const nqWords = nq.split(/\s+/).filter((w) => w.length > 2);
              let score = 0;

              // Match exato da query completa = prioridade máxima
              if (q.includes(nq)) score = 10;

              // Ou se a FAQ contém >= 70% das palavras-chave
              const matchedWords = nqWords.filter((w) => q.includes(w));
              if (matchedWords.length >= Math.ceil(nqWords.length * 0.7)) {
                score = 5 + matchedWords.length * 0.5;
              }

              return {
                ...faq,
                type: "faq",
                relevance_score: score / 10,
                payload: {
                  title: faq.question,
                  content: faq.answer,
                  article_reference: faq.article_reference,
                },
              };
            })
            .filter((f) => f.relevance_score >= 0.5)
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 3);

          if (keywordExact.length) {
            faqResults = keywordExact;
            console.log(
              `✅ Fallback incluiu ${faqResults.length} FAQ(s) por correspondência textual (top score: ${faqResults[0].relevance_score.toFixed(2)})`,
            );
          } else {
            console.log(
              `❌ Fallback textual não encontrou FAQs (normalizedQuery: "${nq}")`,
            );
          }
        }
      } else {
        // Fallback: ranking keyword
        const normalizedQuery = query.toLowerCase();
        faqResults = faqs
          .map((faq: any) => {
            const question = faq.question.toLowerCase();
            const answer = faq.answer.toLowerCase();
            let score = 0;

            queryWords.forEach((word: string) => {
              if (question.includes(word)) score += 6;
              const matches = (answer.match(new RegExp(word, "g")) || [])
                .length;
              score += matches * 0.5;
            });

            if (question.includes(normalizedQuery)) score += 20;
            if (answer.includes(normalizedQuery)) score += 10;

            return {
              ...faq,
              type: "faq",
              relevance_score: score / 10,
              payload: {
                title: faq.question,
                content: faq.answer,
                article_reference: faq.article_reference,
              },
            };
          })
          .filter((r: any) => r.relevance_score > 0)
          .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
          .slice(0, 3);
      }
    }

    // ===== BUSCA VETORIAL EM QDRANT PARA AI FAQs (PRIORIDADE MÁXIMA)
    let aiVectorResults: any[] = [];
    if (hasRealEmbedding) {
      console.log("🎯 Buscando FAQs AI no Qdrant (prioridade máxima)...");
      try {
        const aiSearchResp = await fetch(
          `${QDRANT_URL}/collections/${AI_COLLECTION_NAME}/points/search`,
          {
            method: "POST",
            headers: {
              "api-key": QDRANT_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              vector: queryEmbedding,
              limit: 5,
              score_threshold: 0.3, // Threshold aumentado para maior precisão
              with_payload: true,
            }),
          },
        );
        if (aiSearchResp.ok) {
          const aiData = await aiSearchResp.json();
          aiVectorResults = (aiData.result || []).map((r: any) => ({
            ...r,
            type: "faq_ai",
            relevance_score: r.score + 0.2, // Boost de +0.2 para priorizar AI FAQs
            payload: {
              ...r.payload,
              title: sanitizeUTF8(r.payload?.question || ""),
              content: sanitizeUTF8(r.payload?.answer || ""),
              article_reference: r.payload?.article_reference
                ? sanitizeUTF8(r.payload.article_reference)
                : undefined,
            },
          }));
          console.log(
            `🧩 FAQs AI via vetor: ${aiVectorResults.length} resultado(s) | Top score: ${aiVectorResults[0]?.relevance_score?.toFixed(4) || "N/A"}`,
          );
        } else {
          const errText = await aiSearchResp.text();
          console.warn("⚠️ Qdrant AI collection error:", errText);
        }
      } catch (e) {
        console.warn("⚠️ Qdrant busca AI falhou", e);
      }
    }

    // Priorizar FAQs AI: primeiro AI FAQs, depois FAQs DB, depois documentos
    const allResults = [
      ...aiVectorResults.map((r) => ({ ...r, priority: 3 })), // Prioridade máxima
      ...faqResults.map((r) => ({ ...r, priority: 2 })), // Prioridade alta
      ...documentResults.map((r) => ({ ...r, priority: 1 })), // Prioridade normal
    ]
      .sort((a, b) => {
        // Primeiro ordena por prioridade, depois por score
        if (a.priority !== b.priority) return b.priority - a.priority;
        return b.relevance_score - a.relevance_score;
      })
      .slice(0, 4);

    const searchType =
      hasRealEmbedding && documentResults.length > 0 ? "semantic" : "keyword";
    console.log(
      `📊 Encontrados ${allResults.length} resultados combinados | search_type=${searchType}`,
    );

    if (aiVectorResults.length > 0) {
      console.log(
        `✨ ${aiVectorResults.length} FAQ(s) AI encontrada(s) - usando como fonte primária`,
      );
    }

    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({
          answer:
            "Não encontrei informações sobre isso nos documentos ou FAQs do condomínio. Você pode reformular a pergunta ou verificar se os documentos relevantes foram adicionados na Biblioteca.",
          sources: [],
          search_type: searchType,
        }),
        { headers: corsHeaders },
      );
    }

    // Log de debug
    if (allResults.length > 0) {
      console.log(
        `⭐ Top resultado: "${allResults[0].payload.title}" [${allResults[0].type}] (relevance=${allResults[0].relevance_score?.toFixed(4)})`,
      );
    }

    // ===== MONTAR CONTEXTO PARA GROQ =====
    const contextParts = allResults.map((r: any, i: number) => {
      const source = r.payload.title || "Documento";
      let type = "📄 Documento";
      if (r.type === "faq_ai") type = "⭐ FAQ AI";
      else if (r.type === "faq") type = "❓ FAQ";

      return `[Fonte ${i + 1} - ${type}: ${source}]\n${r.payload.content}`;
    });

    const contextText = contextParts.join("\n\n---\n\n");

    console.log(`💬 Contexto: ${contextText.length} caracteres`);

    // ===== PROMPT ENGINEERING =====
    const systemPrompt = `Você é a Norma, assistente virtual de gestão condominial.

**INSTRUÇÕES CRÍTICAS:**
  1. Responda APENAS com base no CONTEXTO fornecido abaixo
  2. **PRIORIDADE ABSOLUTA:** Se houver uma "⭐ FAQ AI" no contexto, use APENAS ela como fonte principal
  3. Se a informação NÃO estiver no contexto, diga: "Não encontrei essa informação nos documentos disponíveis"
  4. Seja concisa e objetiva (máximo 150 palavras)
  5. Use bullets quando listar múltiplos itens
  6. NÃO cite a fonte na resposta (ex: não diga "Segundo a FAQ..." ou "De acordo com...")
  7. Fale em português do Brasil, de forma profissional mas acessível
  8. Responda diretamente a pergunta de forma clara e objetiva

**CONTEXTO:**
${contextText}

**IMPORTANTE:** Não invente informações. Se não souber, admita. Não mencione a fonte (FAQ/Regimento) na resposta, pois ela será adicionada automaticamente pelo sistema.`;

    console.log("🤖 Chamando Groq...");

    // ===== CHAMAR GROQ LLM =====
    let finalAnswer = "";
    try {
      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: query },
            ],
            temperature: 0.1,
            max_tokens: 500,
          }),
        },
      );

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        console.error("❌ Groq Error:", errorText);
        finalAnswer =
          "Não foi possível gerar a resposta agora. Tente novamente em instantes.";
      } else {
        const groqData = await groqResponse.json();
        finalAnswer =
          groqData.choices?.[0]?.message?.content || "Resposta indisponível.";
      }
    } catch (groqErr) {
      console.error("❌ Erro inesperado Groq:", groqErr);
      finalAnswer =
        "Falha temporária ao processar a resposta. Retente em alguns segundos.";
    }

    console.log(`✅ Resposta gerada (${finalAnswer.length} caracteres)`);

    // Sanitize UTF-8 in response and sources
    const sanitizedAnswer = sanitizeUTF8(finalAnswer);
    const sanitizedSources = allResults.map((r: any) => {
      const source = {
        title: sanitizeUTF8(r.payload.title || ""),
        type: r.type,
        relevance_score: r.relevance_score,
        article_reference: r.payload.article_reference
          ? sanitizeUTF8(r.payload.article_reference)
          : undefined,
        excerpt:
          sanitizeUTF8((r.payload.content || "").substring(0, 150)) + "...",
      };
      console.log(
        `📚 Fonte: ${source.title} | Ref: ${source.article_reference || "N/A"} | Type: ${source.type}`,
      );
      return source;
    });

    return new Response(
      JSON.stringify({
        answer: sanitizedAnswer,
        search_type: searchType,
        sources: sanitizedSources,
      }),
      { headers: corsHeaders },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Erro:", errorMessage);
    return new Response(
      JSON.stringify({
        answer: `Erro técnico: ${errorMessage}. Por favor, tente novamente.`,
        sources: [],
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
