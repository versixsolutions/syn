import { serve } from 'std/http/server.ts'
import { pipeline, env } from '@xenova/transformers'

// Configuração IA Local
env.useBrowserCache = false;
env.allowLocalModels = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');
const COLLECTION_NAME = "norma_knowledge_base";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { query, userName, filter_condominio_id } = await req.json()

    if (!GROQ_API_KEY || !QDRANT_URL) throw new Error("Configurações de API ausentes.");

    // 1. Gerar Embedding da Pergunta
    const extractor = await pipeline('feature-extraction', 'Supabase/gte-small');
    const output = await extractor(query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(output.data);

    // 2. Buscar no Qdrant (Com filtro de condomínio)
    const searchPayload = {
        vector: queryVector,
        limit: 5,
        with_payload: true,
        filter: {
            must: [
                { key: "condominio_id", match: { value: filter_condominio_id } }
            ]
        }
    };

    const searchResp = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
        method: 'POST',
        headers: { 'api-key': QDRANT_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify(searchPayload)
    });

    const searchData = await searchResp.json();
    const hits = searchData.result || [];

    // 3. Montar Contexto
    const contextText = hits.map((hit: any) => hit.payload.content).join("\n\n---\n\n");
    
    if (!contextText) {
        return new Response(JSON.stringify({ answer: "Não encontrei informações sobre isso nos documentos do seu condomínio." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Raciocínio com Groq (Llama 3)
    const systemPrompt = `
      Você é a Norma, gerente predial.
      Use APENAS o contexto abaixo para responder.
      Contexto: ${contextText}
      
      Pergunta: "${query}"
      
      Instruções:
      - Responda em português do Brasil.
      - Seja direta e educada.
      - Cite a fonte se possível.
      - Se não souber, diga que não consta.
    `;

    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama3-8b-8192", // Modelo rápido e gratuito
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: query }
            ],
            temperature: 0.1
        })
    });

    const groqData = await groqResp.json();
    const answer = groqData.choices?.[0]?.message?.content || "Erro ao gerar resposta.";

    return new Response(JSON.stringify({ answer }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ answer: `Erro técnico: ${error.message}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})