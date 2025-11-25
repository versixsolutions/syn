import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, text, query, userName, filter_condominio_id } = await req.json()
    
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada nos Secrets.");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // --- AÇÃO 1: GERAR EMBEDDING (Para salvar documentos) ---
    if (action === 'embed') {
        const response = await fetch(`${API_BASE}/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "models/text-embedding-004",
                content: { parts: [{ text: text }] }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Erro Gemini Embed:", err);
            throw new Error(`Falha ao gerar embedding: ${err}`);
        }

        const data = await response.json();
        return new Response(JSON.stringify({ embedding: data.embedding.values }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- AÇÃO 2: RESPONDER PERGUNTA (Chat) ---
    if (query) {
        console.log(`Pergunta recebida: ${query}`);

        // 1. Gerar vetor da pergunta
        const embedResponse = await fetch(`${API_BASE}/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "models/text-embedding-004",
                content: { parts: [{ text: query }] }
            })
        });

        if (!embedResponse.ok) throw new Error("Erro ao vetorizar pergunta no Gemini.");
        
        const embedData = await embedResponse.json();
        const queryEmbedding = embedData.embedding.values;

        // 2. Buscar documentos no Supabase
        // Reduzi o threshold para 0.3 para garantir que ele encontre algo mesmo se a similaridade não for perfeita
        const { data: documents, error: matchError } = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3, 
            match_count: 5,
            filter_condominio_id: filter_condominio_id
        });

        if (matchError) {
            console.error("Erro no Banco:", matchError);
            throw matchError;
        }

        console.log(`Documentos encontrados: ${documents?.length || 0}`);

        // 3. Montar Contexto
        let contextText = "";
        if (documents && documents.length > 0) {
            contextText = documents.map((d: any) => `--- Trecho de '${d.metadata?.source || 'Documento'}' ---\n${d.content}`).join("\n\n");
        } else {
            // Se não achar nada, instrui a IA a ser cordial
            contextText = "Nenhum documento específico foi encontrado no banco de dados sobre este tópico.";
        }

        // 4. Perguntar ao Gemini
        const prompt = `
          Você é a Norma, assistente virtual oficial do condomínio.
          
          CONTEXTO DOS DOCUMENTOS OFICIAIS:
          ${contextText}

          PERGUNTA DO MORADOR (${userName || 'Morador'}): 
          "${query}"

          INSTRUÇÕES:
          1. Responda baseando-se EXCLUSIVAMENTE no contexto fornecido acima.
          2. Se a resposta estiver no contexto, seja direta e cite a fonte (ex: "Conforme o Artigo X...").
          3. Se o contexto não tiver a resposta ou for insuficiente, diga educadamente: "Desculpe, não encontrei essa informação específica nos documentos oficiais do condomínio. Recomendo verificar com a administração."
          4. Não invente regras que não estejam no texto.
          5. Seja simpática e profissional.
        `;

        const chatResponse = await fetch(`${API_BASE}/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!chatResponse.ok) {
            const errText = await chatResponse.text();
            console.error("Erro Gemini Chat:", errText);
            throw new Error("O Google Gemini recusou a resposta.");
        }

        const chatData = await chatResponse.json();
        const answer = chatData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!answer) {
            console.error("Gemini retornou estrutura inválida:", JSON.stringify(chatData));
            throw new Error("A IA não gerou uma resposta de texto válida.");
        }

        return new Response(JSON.stringify({ answer }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error("Ação inválida.");

  } catch (error: any) {
    console.error("Erro Geral:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})