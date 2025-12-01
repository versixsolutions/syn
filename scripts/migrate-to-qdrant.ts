import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const QDRANT_URL = process.env.QDRANT_URL!;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!;
const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION_NAME || "norma_knowledge_base";
const HF_API_URL =
  "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;

function splitMarkdownIntoChunks(
  markdown: string,
  docTitle: string,
  chunkSize = 1000,
): any[] {
  const sectionRegex = /(?=\n#{1,3}\s+)|(?=\n\*\*\s*Artigo)/;
  const rawSections = markdown.split(sectionRegex);

  const chunks: any[] = [];
  let currentChunk = `Documento: ${docTitle}\n\n`;
  let chunkNumber = 0;

  for (const section of rawSections) {
    const trimmed = section.trim();
    if (trimmed.length < 50) continue;

    if (
      currentChunk.length + trimmed.length > chunkSize &&
      currentChunk.length > 100
    ) {
      chunks.push({
        content: currentChunk.trim(),
        chunk_number: chunkNumber,
      });
      currentChunk = `Documento: ${docTitle}\n\n${trimmed}\n\n`;
      chunkNumber++;
    } else {
      currentChunk += `${trimmed}\n\n`;
    }
  }

  if (currentChunk.trim().length > 100) {
    chunks.push({
      content: currentChunk.trim(),
      chunk_number: chunkNumber,
    });
  }

  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  if (!HF_TOKEN) {
    return Array(384).fill(0);
  }

  const resp = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: text.substring(0, 512),
      options: { wait_for_model: true, use_cache: true },
    }),
  });

  if (!resp.ok) {
    return Array(384).fill(0);
  }

  const result = await resp.json();
  let embedding: number[];

  if (Array.isArray(result) && Array.isArray(result[0])) {
    const numTokens = result.length;
    const dims = result[0].length;
    embedding = new Array(dims).fill(0);
    for (const tokenEmb of result) {
      for (let i = 0; i < dims; i++) {
        embedding[i] += tokenEmb[i] / numTokens;
      }
    }
  } else if (Array.isArray(result)) {
    embedding = result;
  } else {
    embedding = Array(384).fill(0);
  }

  const magnitude =
    Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
  return embedding.map((v) => v / magnitude);
}

async function migrate() {
  console.log("🚀 Iniciando migração de documentos para Qdrant...\n");

  try {
    const { data: documents, error } = await supabase
      .from("documents")
      .select("*")
      .is("metadata->>is_chunk", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!documents || documents.length === 0) {
      console.log("⚠️  Nenhum documento encontrado no Supabase");
      return;
    }

    console.log(`📚 Encontrados ${documents.length} documentos\n`);

    let totalChunks = 0;
    let processedDocs = 0;

    // ID sequencial simples - Usar timestamp como base
    let pointId = Date.now();

    for (const doc of documents) {
      console.log(
        `\n📄 Processando: ${doc.title || doc.metadata?.title || "Sem título"}`,
      );

      if (!doc.content || doc.content.length < 50) {
        console.log("   ⏭️  Pulando (conteúdo vazio ou muito curto)");
        continue;
      }

      const chunks = splitMarkdownIntoChunks(
        doc.content,
        doc.title || doc.metadata?.title || "Documento",
      );

      console.log(`   📦 ${chunks.length} chunks criados`);

      // Preparar pontos com IDs numéricos sequenciais
      const points = [] as any[];
      for (const chunk of chunks) {
        const emb = await generateEmbedding(chunk.content);
        points.push({
          id: pointId++,
          vector: emb,
          payload: {
            content: chunk.content,
            title: doc.title || doc.metadata?.title || "Documento",
            condominio_id: doc.condominio_id,
            doc_id: doc.id,
            category: doc.metadata?.category || "geral",
            chunk_number: chunk.chunk_number,
            total_chunks: chunks.length,
            created_at: doc.created_at,
          },
        });
      }

      console.log(`   📤 Enviando ${points.length} pontos para o Qdrant...`);

      const response = await fetch(
        `${QDRANT_URL}/collections/${COLLECTION_NAME}/points`,
        {
          method: "PUT",
          headers: {
            "api-key": QDRANT_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ points }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`\n   ❌ Erro ao indexar: ${errorText}`);
        continue;
      }

      console.log(`   ✅ ${points.length} pontos indexados`);

      totalChunks += points.length;
      processedDocs++;
    }

    console.log("\n" + "=".repeat(50));
    console.log(`✅ Migração concluída!`);
    console.log(`   📚 Documentos processados: ${processedDocs}`);
    console.log(`   📦 Total de chunks indexados: ${totalChunks}`);
    console.log("=".repeat(50) + "\n");

    const infoResp = await fetch(
      `${QDRANT_URL}/collections/${COLLECTION_NAME}`,
      {
        headers: { "api-key": QDRANT_API_KEY },
      },
    );

    if (infoResp.ok) {
      const info = await infoResp.json();
      console.log("📊 Status do Qdrant:");
      console.log(`   - Pontos indexados: ${info.result.points_count}`);
      console.log(`   - Status: ${info.result.status}\n`);
    }
  } catch (error: any) {
    console.error("\n❌ Erro:", error.message);
    process.exit(1);
  }
}

migrate();
