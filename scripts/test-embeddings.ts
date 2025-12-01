// Script para testar embeddings HuggingFace
import { HfInference } from '@huggingface/inference'
import { readFileSync } from 'fs'
import { join } from 'path'

// Carregar .env manualmente
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = readFileSync(envPath, 'utf-8')
    const lines = envContent.split('\n')
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim()
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Não foi possível carregar .env')
  }
}

loadEnv()

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN

async function testEmbedding() {
  console.log('🧪 Testando conexão com HuggingFace...\n')
  
  if (!HF_TOKEN) {
    console.error('❌ HUGGINGFACE_TOKEN não configurado no .env')
    console.log('📖 Acesse: https://huggingface.co/settings/tokens')
    process.exit(1)
  }

  console.log(`✅ Token encontrado: ${HF_TOKEN.substring(0, 8)}...`)
  console.log(`🔗 Modelo: sentence-transformers/all-MiniLM-L6-v2\n`)

  try {
    const testText = 'Qual o horário da piscina do condomínio?'
    console.log(`📝 Gerando embedding para: "${testText}"`)
    
    const startTime = Date.now()
    
    const hf = new HfInference(HF_TOKEN)
    const result = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: testText
    })

    const duration = Date.now() - startTime
    
    // Converter resultado em array se necessário
    let embedding: number[]
    
    if (Array.isArray(result)) {
      embedding = result as number[]
    } else {
      throw new Error('Formato de resposta inesperado')
    }

    // L2 normalization
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    const normalizedEmbedding = embedding.map(val => val / magnitude)

    console.log(`\n✅ Embedding gerado com sucesso!`)
    console.log(`📊 Dimensões: ${normalizedEmbedding.length}`)
    console.log(`⏱️ Tempo: ${duration}ms`)
    console.log(`🔢 Primeiros 5 valores: [${normalizedEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
    console.log(`📈 Magnitude (normalizada): ${Math.sqrt(normalizedEmbedding.reduce((s, v) => s + v*v, 0)).toFixed(6)}`)
    
    console.log('\n🎉 Tudo funcionando! Pronto para executar npm run reindex:qdrant')

  } catch (error) {
    console.error('\n❌ Erro ao conectar:', error)
    process.exit(1)
  }
}

testEmbedding()
