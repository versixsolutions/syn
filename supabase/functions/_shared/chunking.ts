export interface Chunk {
  content: string
  metadata: {
    start_index: number
    end_index: number
    chunk_number: number
  }
}

export function splitMarkdownIntoChunks(
  markdown: string,
  docTitle: string,
  chunkSize: number = 1000,
  overlap: number = 200
): Chunk[] {
  // Estratégia 1: Tentar quebrar por seções (headers)
  const sectionRegex = /(?=\n#{1,3}\s+)|(?=\n\*\*\s*Artigo)/
  const rawSections = markdown.split(sectionRegex)
  
  const chunks: Chunk[] = []
  let currentChunk = `Documento: ${docTitle}\n\n`
  let chunkNumber = 0
  let startIndex = 0

  for (const section of rawSections) {
    const trimmedSection = section.trim()
    
    if (trimmedSection.length < 50) continue // Ignora seções muito pequenas

    // Se adicionar a seção ultrapassar o limite
    if (currentChunk.length + trimmedSection.length > chunkSize && currentChunk.length > 100) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          start_index: startIndex,
          end_index: startIndex + currentChunk.length,
          chunk_number: chunkNumber
        }
      })
      
      // Overlap: pega últimas palavras do chunk anterior
      const words = currentChunk.split(' ')
      const overlapWords = words.slice(-Math.floor(overlap / 5)).join(' ')
      
      currentChunk = `Documento: ${docTitle}\n\n${overlapWords}\n\n${trimmedSection}\n\n`
      startIndex += currentChunk.length - overlapWords.length
      chunkNumber++
    } else {
      currentChunk += `${trimmedSection}\n\n`
    }
  }

  // Adiciona último chunk
  if (currentChunk.trim().length > 100) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        start_index: startIndex,
        end_index: startIndex + currentChunk.length,
        chunk_number: chunkNumber
      }
    })
  }

  // Fallback: Se não gerou chunks, quebra por tamanho fixo
  if (chunks.length === 0) {
    const text = `Documento: ${docTitle}\n\n${markdown}`
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push({
        content: text.slice(i, i + chunkSize),
        metadata: {
          start_index: i,
          end_index: Math.min(i + chunkSize, text.length),
          chunk_number: Math.floor(i / (chunkSize - overlap))
        }
      })
    }
  }

  return chunks
}

export function extractTopics(markdown: string, limit: number = 3): string[] {
  const lines = markdown
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20)
    .filter(l => !l.startsWith('---') && !l.startsWith('Documento:'))
    .filter(l => l.startsWith('#') || l.startsWith('**') || /^Artigo/i.test(l))

  return lines.slice(0, limit)
}