import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LLAMA_CLOUD_API_KEY = Deno.env.get('LLAMA_CLOUD_API_KEY');

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!LLAMA_CLOUD_API_KEY) {
      throw new Error("LLAMA_CLOUD_API_KEY não configurada.");
    }

    // Recebe o arquivo (blob) ou URL. Para simplificar e evitar limites de tamanho de payload JSON,
    // vamos assumir que o frontend envia o arquivo como FormData.
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error("Nenhum arquivo enviado.");
    }

    console.log(`Recebido arquivo: ${file.name}, tamanho: ${file.size} bytes`);

    // 1. Enviar para LlamaParse
    // A API do LlamaParse espera um upload de arquivo.
    // Documentação de referência (simplificada): POST /api/parsing/upload
    
    const llamaFormData = new FormData();
    llamaFormData.append('file', file);
    
    // Configuração opcional para português
    llamaFormData.append('language', 'pt'); 
    // Formato markdown é o padrão e ideal
    
    const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
        // Nota: Não setar Content-Type aqui, o fetch define o boundary automaticamente para FormData
      },
      body: llamaFormData
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.error("Erro LlamaParse Upload:", errText);
      throw new Error(`Falha no upload para LlamaParse: ${uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();
    const jobId = uploadData.id;
    console.log(`Job iniciado no LlamaParse. ID: ${jobId}`);

    // 2. Polling para verificar o status do processamento
    // O LlamaParse é assíncrono. Precisamos esperar ele terminar.
    let markdown = '';
    let attempts = 0;
    const maxAttempts = 60; // 60 tentativas * 2s = 2 minutos timeout (ajuste conforme necessário)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2 segundos
      
      const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
        }
      });

      if (!statusResponse.ok) {
         throw new Error("Erro ao verificar status do job.");
      }

      const statusData = await statusResponse.json();
      console.log(`Status do Job ${jobId}: ${statusData.status}`);

      if (statusData.status === 'SUCCESS') {
        // 3. Obter o resultado (Markdown)
        const resultResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
             headers: {
                'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
            }
        });
        
        if(!resultResponse.ok) {
            throw new Error("Erro ao baixar markdown resultante.");
        }

        const resultData = await resultResponse.json();
        markdown = resultData.markdown;
        break;
      } else if (statusData.status === 'FAILED') {
        throw new Error("O processamento do PDF falhou no LlamaParse.");
      }

      attempts++;
    }

    if (!markdown) {
      throw new Error("Timeout: O processamento demorou muito.");
    }
    
    // Retorna o Markdown estruturado para o Frontend (que depois chamará o 'ask-ai' para gerar embeddings)
    // Ou, idealmente, esta função já poderia chamar o 'ask-ai' internamente, mas vamos manter desacoplado por enquanto.
    
    return new Response(
      JSON.stringify({ markdown }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("Erro na Edge Function process-document:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})