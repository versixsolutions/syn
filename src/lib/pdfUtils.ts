import * as pdfjsLib from 'pdfjs-dist'

// Configuração do Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''

    // Percorre todas as páginas
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      
      // Junta os fragmentos de texto da página
      // Adicionamos um espaço para garantir que palavras não colem, 
      // mas o ideal seria usar a geometria (transform) para saber se é nova linha.
      // Para este caso simples, ' ' costuma bastar.
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      
      fullText += `\n--- Página ${i} ---\n${pageText}`
    }

    console.log(`PDF lido: ${pdf.numPages} páginas. Tamanho texto: ${fullText.length}`)
    
    if (fullText.trim().length < 50) {
        console.warn("Texto extraído muito curto. Possível PDF de imagem.")
    }

    return fullText
  } catch (error) {
    console.error('Erro ao ler PDF:', error)
    throw new Error('Não foi possível extrair o texto do PDF. Verifique se o arquivo é válido e contém texto selecionável (não imagem).')
  }
}