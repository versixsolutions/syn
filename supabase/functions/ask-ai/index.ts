import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const API_VERSION = 'v1beta';
const BASE_URL = `https://generativelanguage.googleapis.com/${API_VERSION}/models`;

// LISTA DE MODELOS PARA TENTAR (Ordem de preferência)
// Se o primeiro falhar (404), ele tenta o próximo.
const CHAT_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.0-pro'
];

const EMBEDDING_MODEL = 'text-embedding-004';

serve(async (req: Request) => {
  // 1. CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Validações
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) throw new Error("Credenciais Supabase ausentes.");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { action, text, query, userName, filter_condominio_id } = await req.json();

    // --- HELPER: Chamada Resiliente ao Google ---
    async function callGemini(models: string[], method: string, bodyGenerator: (model: string) => any) {
        let lastError;
        
        for (const model of models) {
            const url = `${BASE_URL}/${model}:${method}?key=${GEMINI_API_KEY}`;
            console.log(`Tentando modelo: ${model} ...`);
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyGenerator(model))
                });

                if (response.ok) {
                    console.log(`Sucesso com modelo: ${model}`);
                    return await response.json();
                }
                
                // Se for erro 404 ou 400 (Model not found/supported), tenta o próximo
                if (response.status === 404 || response.status === 400) {
                    const errText = await response.text();
                    console.warn(`Falha no modelo ${model} (${response.status}): ${errText}`);
                    lastError = new Error(`Modelo ${model} não encontrado/suportado.`);
                    continue; 
                }

                // Outros erros (500, 403) abortam imediatamente
                const fatalError = await response.text();
                throw new Error(`Erro API Google (${model}): ${fatalError}`);

            } catch (e) {
                console.error(`Exceção ao chamar ${model}:`, e);
                lastError = e;
                if (e.message.includes("Erro API Google")) throw e; // Relança erros fatais
            }
        }
        throw lastError || new Error("Nenhum modelo disponível funcionou.");
    }

    // --- AÇÃO 1: EMBEDDING ---
    if (action === 'embed') {
        console.log(`Gerando embedding...`);
        // Para embedding, usamos apenas um modelo fixo pois a dimensão (768) não pode mudar
        const data = await callGemini([EMBEDDING_MODEL], 'embedContent', (model) => ({
            model: `models/${model}`,
            content: { parts: [{ text: text }] }
        }));
        return new Response(JSON.stringify({ embedding: data.embedding.values }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- AÇÃO 2: CHAT ---
    if (query) {
        console.log(`Processando pergunta: "${query}"`);

        // 1. Embedding da Pergunta
        const embedData = await callGemini([EMBEDDING_MODEL], 'embedContent', (model) => ({
            model: `models/${model}`,
            content: { parts: [{ text: query }] }
        }));
        
        // 2. Busca no Banco
        const { data: documents, error: matchError } = await supabase.rpc('match_documents', {
            query_embedding: embedData.embedding.values,
            match_threshold: 0.3,
            match_count: 5,
            filter_condominio_id: filter_condominio_id
        });

        if (matchError) throw new Error(`Erro Banco: ${matchError.message}`);

        // 3. Contexto
        const contextText = documents?.length 
            ? documents.map((d: any) => d.content).join("\n\n") 
            : "Nenhuma informação encontrada.";

        // 4. Chat com Multi-Model Fallback
        const prompt = `
          Você é Norma, assistente do condomínio.
          Contexto: ${contextText}
          Pergunta: "${query}"
          Responda com base no contexto.
        `;

        const chatData = await callGemini(CHAT_MODELS, 'generateContent', () => ({
            contents: [{ parts: [{ text: prompt }] }]
        }));

        const answer = chatData.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta.";
        return new Response(JSON.stringify({ answer }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("FATAL:", error.message);
    return new Response(
        JSON.stringify({ error: error.message, details: "Verifique os logs." }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})