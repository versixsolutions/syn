import * as pdfjsLib from 'pdfjs-dist'

// Configuração do Worker usando UNPKG com versão fixa para estabilidade.
// A versão deve bater com a instalada no package.json (5.4.394)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.394/build/pdf.worker.min.mjs`

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
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      
      fullText += `\n--- Página ${i} ---\n${pageText}`
    }

    return fullText
  } catch (error) {
    console.error('Erro ao ler PDF:', error)
    throw new Error('Não foi possível extrair o texto do PDF. Verifique se o arquivo é válido.')
  }
}