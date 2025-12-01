import dotenv from "dotenv";

dotenv.config();

const QDRANT_URL = process.env.QDRANT_URL!;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!;
const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION_NAME || "norma_knowledge_base";

async function dropCollection() {
  console.log(`⚠️  Apagando coleção inteira: ${COLLECTION_NAME}`);
  const resp = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    method: "DELETE",
    headers: { "api-key": QDRANT_API_KEY },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Falha ao apagar coleção: ${txt}`);
  }
  console.log("✅ Coleção removida com sucesso");
}

async function recreateCollection() {
  console.log(`🛠️  Recriando coleção: ${COLLECTION_NAME}`);
  const resp = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    method: "PUT",
    headers: {
      "api-key": QDRANT_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vectors: {
        size: Number(process.env.EMBEDDING_DIMENSIONS || 384),
        distance: "Cosine",
      },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Falha ao recriar coleção: ${txt}`);
  }
  console.log("✅ Coleção recriada");
}

async function clearQdrant() {
  try {
    await dropCollection();
    await recreateCollection();
  } catch (err: any) {
    console.error("❌ Erro ao limpar Qdrant:", err.message);
    process.exit(1);
  }
}

clearQdrant();
