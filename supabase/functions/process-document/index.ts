import { serve } from 'std/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { pipeline, env } from '@xenova/transformers'

// Configuração IA Local (Embeddings) no Deno
env.useBrowserCache = false;
env.allowLocalModels = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Segredos
const LLAMA_CLOUD_API_KEY = Deno.env.get('LLAMA_CLOUD_API_KEY');
const QDRANT_URL = Deno.env.get('QDRANT_URL');
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Configuração da Collection no Qdrant
const COLLECTION_NAME = "norma_knowledge_base";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!LLAMA_CLOUD_API_KEY || !QDRANT_URL || !QDRANT_API_KEY) {
      throw new Error("Chaves de API (Llama/Qdrant) não configuradas.");
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const condominio_id = formData.get('condominio_id') as string;
    const category = formData.get('category') as string;
    const file_url = formData.get('file_url') as string;

    if (!file) throw new Error("Arquivo não enviado.");

    // 1. LlamaParse (Visão/OCR)
    console.log(`[1/4] Enviando para LlamaParse: ${file.name}`);
    
    const llamaFormData = new FormData();
    llamaFormData.append('file', file);
    llamaFormData.append('language', 'pt');
    llamaFormData.append('parsing_instruction', 'O documento é um regimento de condomínio. Preserve títulos, artigos e tabelas em Markdown.');

    const uploadResp = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}` },
      body: llamaFormData
    });

    if (!uploadResp.ok) throw new Error("Erro upload LlamaParse");
    const { id: jobId } = await uploadResp.json();

    // Polling
    let markdown = '';
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusResp = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: { 'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}` }
      });
      const statusData = await statusResp.json();
      if (statusData.status === 'SUCCESS') {
        const res = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
             headers: { 'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}` }
        });
        const data = await res.json();
        markdown = data.markdown;
        break;
      }
    }

    if (!markdown) throw new Error("Timeout LlamaParse");

    // 2. Chunking Semântico (Simples baseada em Headers Markdown)
    console.log(`[2/4] Fragmentando texto...`);
    const chunks = markdown
      .split(/(?=\n#+\s+)/) // Quebra em títulos (#, ##, ###)
      .map(c => c.trim())
      .filter(c => c.length > 50);

    // 3. Embeddings (Xenova/Local)
    console.log(`[3/4] Gerando Embeddings (${chunks.length} chunks)...`);
    const extractor = await pipeline('feature-extraction', 'Supabase/gte-small');
    
    const points = [];
    for (const chunk of chunks) {
        const output = await extractor(chunk, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);
        
        points.push({
            id: crypto.randomUUID(),
            vector: embedding,
            payload: {
                content: chunk,
                condominio_id: condominio_id,
                source: file.name,
                category: category,
                file_url: file_url
            }
        });
    }

    // 4. Salvar no Qdrant
    console.log(`[4/4] Salvando no Qdrant...`);
    
    // Garantir que coleção existe
    await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        method: 'PUT',
        headers: { 'api-key': QDRANT_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectors: { size: 384, distance: "Cosine" } })
    });

    // Upsert pontos
    const upsertResp = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`, {
        method: 'PUT',
        headers: { 'api-key': QDRANT_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ points })
    });

    if (!upsertResp.ok) {
        const err = await upsertResp.text();
        throw new Error(`Erro Qdrant Upsert: ${err}`);
    }

    // 5. Registrar no Supabase (Log Visual)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    await supabase.from('library_files').insert({
        title: file.name.replace('.pdf', ''),
        file_url: file_url,
        category: category,
        condominio_id: condominio_id
    });

    return new Response(JSON.stringify({ success: true, chunks: chunks.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("Erro Fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})