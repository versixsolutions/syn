import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Usando a versão 2.14.0 que é muito estável para Deno via CDN
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- CONFIGURAÇÕES CRÍTICAS PARA O "MOTOR" DA IA NO DENO ---
// 1. Não usar cache de navegador ou sistema de arquivos local
env.useBrowserCache = false;
env.allowLocalModels = false;

// 2. CORREÇÃO DO ERRO DE WASM: 
// Apontar explicitamente onde estão os binários do ONNX (motor matemático)
// Sem isso, o Deno não sabe onde baixar o .wasm e falha ao iniciar a sessão.
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0/dist/';

// 3. Otimização para servidor (1 thread é mais seguro para não estourar a memória da Edge Function)
env.backends.onnx.wasm.numThreads = 1;

class EmbeddingPipeline {
  static task = 'feature-extraction';
  static model = 'Supabase/gte-small';
  static instance: any = null;

  static async getInstance() {
    if (this.instance === null) {
      console.log("Carregando modelo GTE-Small (WASM)...");
      this.instance = await pipeline(this.task, this.model);
      console.log("Modelo carregado na memória!");
    }
    return this.instance;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, userName } = await req.json()
    
    // Log para depuração
    console.log(`Pergunta recebida: ${query}`);

    // 1. Gerar Embedding
    const generateEmbedding = await EmbeddingPipeline.getInstance();
    
    // Gerar vetor
    const output = await generateEmbedding(query, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);

    // 2. Conectar ao Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
       throw new Error("Variáveis de ambiente não configuradas.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Buscar no Banco
    const { data: documents, error: matchError } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.60, 
      match_count: 3, 
    })

    if (matchError) throw matchError

    let answer = ''

    if (!documents || documents.length === 0) {
      console.log("Sem correspondência no banco.");
      answer = `Olá ${userName}, pesquisei em nossa base de conhecimento mas não encontrei uma regra específica sobre isso. Recomendo verificar com a administração ou abrir um chamado.`
    } else {
      console.log(`Encontrados ${documents.length} documentos.`);
      const topDoc = documents[0]
      const source = topDoc.metadata?.source || 'Regimento Interno'
      const title = topDoc.metadata?.title || 'Norma'
      
      answer = `Olá ${userName}! Encontrei informações relevantes no **${title}**:\n\n"${topDoc.content}"\n\n📄 Fonte: ${source}`
      
      if (documents.length > 1) {
        answer += `\n\nTambém pode ser útil:\n"${documents[1].content}"`
      }
    }

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("Erro Fatal na Função:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno ao processar IA" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})