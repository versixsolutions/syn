// Embeddings com HuggingFace usando fetch (Deno Edge Functions não suportam npm packages)
// Suporta Inference Endpoints dedicados (pago) ou API pública (descontinuada)

// Prioridade: HUGGINGFACE_ENDPOINT_URL (dedicado) > API pública (deprecated)
const HF_ENDPOINT_URL = Deno.env.get("HUGGINGFACE_ENDPOINT_URL");
const HF_API_URL =
  HF_ENDPOINT_URL ||
  "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";

interface EmbeddingResponse {
  embedding: number[];
  cached: boolean;
  error?: string;
}

const embeddingCache = new Map<
  string,
  { embedding: number[]; timestamp: number }
>();
const CACHE_TTL = 3600000;

function getCacheKey(text: string): string {
  return text.toLowerCase().trim().substring(0, 512);
}

export async function generateEmbedding(
  text: string,
): Promise<EmbeddingResponse> {
  const HF_TOKEN = Deno.env.get("HUGGINGFACE_TOKEN");

  if (!HF_TOKEN) {
    console.warn("⚠️ HUGGINGFACE_TOKEN não configurado");
    return {
      embedding: Array(384).fill(0),
      cached: false,
      error: "Token não configurado",
    };
  }

  const cacheKey = getCacheKey(text);
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("✅ Embedding recuperado do cache");
    return { embedding: cached.embedding, cached: true };
  }

  // Log do endpoint apenas na primeira chamada
  if (embeddingCache.size === 0) {
    console.log(
      `🔗 Usando HuggingFace Endpoint: ${HF_ENDPOINT_URL ? "Dedicado (Pago)" : "API Pública (Deprecated)"}`,
    );
  }

  try {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text.substring(0, 512),
        options: {
          wait_for_model: true,
          use_cache: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ HuggingFace API error:", response.status, errorText);

      if (response.status === 429) {
        return {
          embedding: Array(384).fill(0),
          cached: false,
          error: "Rate limit atingido",
        };
      }

      throw new Error(`HF API error: ${response.status}`);
    }

    const result = await response.json();

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
      throw new Error("Formato de resposta inesperado");
    }

    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    embedding = embedding.map((val) => val / magnitude);

    embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });

    console.log(`✅ Embedding gerado: ${embedding.length} dimensões`);
    return { embedding, cached: false };
  } catch (error) {
    console.error("❌ Erro ao gerar embedding:", error);
    return {
      embedding: Array(384).fill(0),
      cached: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

export async function generateBatchEmbeddings(
  texts: string[],
): Promise<EmbeddingResponse[]> {
  const results: EmbeddingResponse[] = [];

  for (let i = 0; i < texts.length; i += 5) {
    const batch = texts.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map((text) => generateEmbedding(text)),
    );
    results.push(...batchResults);

    if (i + 5 < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}
