import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const QDRANT_URL = process.env.QDRANT_URL!;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!;
const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION_NAME || "norma_knowledge_base";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

async function diagnose() {
  console.log("🔍 Diagnóstico do Pipeline de Upload\n");

  // 1. Verificar Qdrant
  console.log("1️⃣ Verificando conexão com Qdrant...");
  try {
    const resp = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      headers: { "api-key": QDRANT_API_KEY },
    });

    if (resp.ok) {
      const data = await resp.json();
      console.log(`   ✅ Coleção existe: ${COLLECTION_NAME}`);
      console.log(`   📊 Pontos indexados: ${data.result.points_count}`);
      console.log(
        `   📐 Dimensão vetores: ${data.result.config.params.vectors.size}`,
      );
      console.log(
        `   📏 Distância: ${data.result.config.params.vectors.distance}\n`,
      );
    } else {
      const err = await resp.text();
      console.log(`   ❌ Erro ao acessar coleção: ${err}\n`);
    }
  } catch (err: any) {
    console.log(`   ❌ Erro de conexão Qdrant: ${err.message}\n`);
  }

  // 2. Verificar HuggingFace Token e Endpoint
  console.log("2️⃣ Verificando HuggingFace Token e Endpoint...");
  const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;
  const HF_ENDPOINT_URL = process.env.HUGGINGFACE_ENDPOINT_URL;

  if (HF_ENDPOINT_URL) {
    console.log(
      `   🌐 Endpoint customizado: ${HF_ENDPOINT_URL.substring(0, 60)}...`,
    );
  } else {
    console.log(
      `   ⚠️  HUGGINGFACE_ENDPOINT_URL não configurado (usando API pública deprecated)`,
    );
  }

  if (HF_TOKEN && HF_TOKEN.startsWith("hf_")) {
    console.log(
      `   ✅ Token HF configurado: ${HF_TOKEN.substring(0, 10)}...\n`,
    );

    // Testar embedding
    const testUrl =
      HF_ENDPOINT_URL ||
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";
    try {
      const resp = await fetch(testUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: "teste de conexão",
          options: { wait_for_model: true, use_cache: true },
        }),
      });

      if (resp.ok) {
        const result = await resp.json();
        console.log(
          `   ✅ API HuggingFace funcionando (dimensão: ${result.length || result[0]?.length})\n`,
        );
      } else {
        const err = await resp.text();
        console.log(`   ⚠️ Erro na API HF: ${resp.status} - ${err}\n`);
      }
    } catch (err: any) {
      console.log(`   ❌ Erro ao testar HF: ${err.message}\n`);
    }
  } else {
    console.log(`   ❌ HUGGINGFACE_TOKEN não configurado ou inválido\n`);
  }

  // 3. Verificar LlamaParse
  console.log("3️⃣ Verificando LlamaParse API...");
  const LLAMAPARSE_API_KEY = process.env.LLAMAPARSE_API_KEY;
  if (LLAMAPARSE_API_KEY && LLAMAPARSE_API_KEY.startsWith("llx-")) {
    console.log(
      `   ✅ Token LlamaParse configurado: ${LLAMAPARSE_API_KEY.substring(0, 10)}...\n`,
    );
  } else {
    console.log(`   ❌ LLAMAPARSE_API_KEY não configurado ou inválido\n`);
  }

  // 4. Verificar tabela documents no Supabase
  console.log("4️⃣ Verificando tabela documents...");
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error, count } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log(`   ❌ Erro ao acessar tabela: ${error.message}\n`);
    } else {
      console.log(
        `   ✅ Tabela acessível: ${count || 0} documentos cadastrados\n`,
      );
    }
  } catch (err: any) {
    console.log(`   ❌ Erro ao conectar Supabase: ${err.message}\n`);
  }

  // 5. Verificar storage bucket
  console.log('5️⃣ Verificando storage bucket "biblioteca"...');
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.storage
      .from("biblioteca")
      .list("", { limit: 1 });

    if (error) {
      console.log(`   ⚠️ Erro ao acessar bucket: ${error.message}\n`);
    } else {
      console.log(`   ✅ Bucket acessível\n`);
    }
  } catch (err: any) {
    console.log(`   ❌ Erro ao verificar storage: ${err.message}\n`);
  }

  // 6. Scroll últimos pontos do Qdrant
  console.log("6️⃣ Últimos pontos indexados no Qdrant...");
  try {
    const resp = await fetch(
      `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`,
      {
        method: "POST",
        headers: {
          "api-key": QDRANT_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 3, with_payload: true }),
      },
    );

    if (resp.ok) {
      const data = await resp.json();
      const points = data.result?.points || [];

      if (points.length === 0) {
        console.log(`   ⚠️ Nenhum ponto indexado ainda\n`);
      } else {
        console.log(`   📄 Últimos ${points.length} pontos:`);
        points.forEach((p: any) => {
          console.log(`      - ID: ${p.id}`);
          console.log(`        Título: ${p.payload.title}`);
          console.log(`        Condomínio: ${p.payload.condominio_id}`);
          console.log(
            `        Chunk: ${p.payload.chunk_number + 1}/${p.payload.total_chunks}`,
          );
          console.log(`        Criado: ${p.payload.created_at}`);
          console.log(
            `        Vetor: ${
              Array.isArray(p.vector)
                ? `[${p.vector
                    .slice(0, 3)
                    .map((v: number) => v.toFixed(3))
                    .join(", ")}...]`
                : "N/A"
            }`,
          );
          console.log("");
        });
      }
    } else {
      const err = await resp.text();
      console.log(`   ❌ Erro ao listar pontos: ${err}\n`);
    }
  } catch (err: any) {
    console.log(`   ❌ Erro ao scroll Qdrant: ${err.message}\n`);
  }

  console.log("═".repeat(60));
  console.log("✅ Diagnóstico concluído!\n");
  console.log("📋 Próximos passos:");
  console.log("   1. Se Qdrant ou HF tiverem erro, corrigir env vars");
  console.log(
    "   2. Deploy da Edge Function: supabase functions deploy process-document",
  );
  console.log("   3. Configurar secrets no Supabase Dashboard");
  console.log("   4. Fazer upload de teste e verificar logs da função");
  console.log("   5. Executar este script novamente para ver novos pontos\n");
}

diagnose();
