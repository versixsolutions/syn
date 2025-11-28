import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdmin } from '../../contexts/AdminContext'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as pdfjsLib from 'pdfjs-dist'
import { formatCurrency } from '../../lib/utils'

// Configura o worker do PDF.js (essencial para o funcionamento no navegador)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export default function FinanceiroImport() {
  const { selectedCondominioId } = useAdmin()
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [step, setStep] = useState<'upload' | 'preview' | 'saving'>('upload')
  const [processing, setProcessing] = useState(false)
  const [extractedData, setExtractedData] = useState<{ receitas: any[], despesas: any[] }>({ receitas: [], despesas: [] })

  // 1. Ler PDF, Extrair Texto e Processar com IA
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Por favor, envie um arquivo PDF.')
      return
    }

    setProcessing(true)
    const toastId = toast.loading('Lendo arquivo PDF...')

    try {
      // 1.1 Extração de Texto Local (Navegador)
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
      let fullText = ''

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        fullText += `\n--- PÁGINA ${i} ---\n${pageText}`
      }

      // 1.2 Envio para a Edge Function (IA Gemini)
      toast.loading('IA analisando tabelas financeiras...', { id: toastId })

      const { data: aiData, error: aiError } = await supabase.functions.invoke('process-financial-pdf', {
        body: { text: fullText }
      })

      if (aiError) throw aiError

      if (!aiData || (!aiData.receitas?.length && !aiData.despesas?.length)) {
        throw new Error("A IA não conseguiu identificar dados financeiros válidos neste documento.")
      }

      setExtractedData({
        receitas: aiData.receitas || [],
        despesas: aiData.despesas || []
      })
      
      setStep('preview')
      toast.success('Dados processados com sucesso!', { id: toastId })

    } catch (err: any) {
      console.error('Erro no processamento:', err)
      toast.error(`Falha: ${err.message || 'Erro desconhecido'}`, { id: toastId })
    } finally {
      setProcessing(false)
      // Limpa o input para permitir re-upload do mesmo arquivo se falhar
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 2. Salvar Dados no Banco (Confirmar Importação)
  const handleConfirmImport = async () => {
    if (!selectedCondominioId || !user) {
      toast.error('Erro de sessão ou condomínio não selecionado.')
      return
    }
    
    setStep('saving')
    const toastId = toast.loading('Salvando lançamentos no sistema...')

    try {
      // 2.1 Inserir Receitas
      if (extractedData.receitas.length > 0) {
        const receitasToInsert = extractedData.receitas.map(r => ({
          description: r.description,
          amount: parseFloat(r.amount), // Garante numérico
          received_at: r.date, // Mapeia data retornada pela IA
          category: r.category || 'Outros',
          condominio_id: selectedCondominioId,
          author_id: user.id,
          is_consolidated: true
        }))

        const { error: errRec } = await supabase.from('receitas').insert(receitasToInsert)
        if (errRec) throw new Error(`Erro ao salvar receitas: ${errRec.message}`)
      }

      // 2.2 Inserir Despesas
      if (extractedData.despesas.length > 0) {
        const despesasToInsert = extractedData.despesas.map(d => ({
          description: d.description,
          amount: parseFloat(d.amount),
          category: d.category || 'Outros',
          due_date: d.date,
          paid_at: d.date, // Assume pago pois é importação de histórico
          condominio_id: selectedCondominioId,
          author_id: user.id,
          is_consolidated: true
        }))

        const { error: errDesp } = await supabase.from('despesas').insert(despesasToInsert)
        if (errDesp) throw new Error(`Erro ao salvar despesas: ${errDesp.message}`)
      }

      toast.success('Importação concluída com sucesso!', { id: toastId })
      navigate('/admin/financeiro')

    } catch (err: any) {
      console.error(err)
      toast.error(err.message, { id: toastId })
      setStep('preview') // Volta para o preview em caso de erro para tentar de novo
    }
  }

  // Cálculos de Totais para o Preview
  const totalReceitas = extractedData.receitas.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0)
  const totalDespesas = extractedData.despesas.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar Demonstrativo</h1>
          <p className="text-gray-500 text-sm">Use a IA para transformar PDFs em dados.</p>
        </div>
        <button onClick={() => navigate('/admin/financeiro')} className="text-gray-500 hover:text-gray-700 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition">
          Voltar
        </button>
      </div>

      {step === 'upload' && (
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-200 text-center">
          <div 
            onClick={() => !processing && fileInputRef.current?.click()}
            className={`border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl p-16 cursor-pointer transition group ${processing ? 'opacity-50 cursor-wait' : 'hover:bg-indigo-50 hover:border-indigo-300'}`}
          >
            {processing ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <p className="text-indigo-800 font-bold animate-pulse">Lendo e Processando...</p>
                <p className="text-indigo-500 text-xs mt-1">Isso pode levar alguns segundos.</p>
              </div>
            ) : (
              <>
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">📄</div>
                <h3 className="text-xl font-bold text-indigo-900">Upload do Demonstrativo (PDF)</h3>
                <p className="text-indigo-600 text-sm mt-2 max-w-md mx-auto">
                  Clique para selecionar o arquivo. Nossa IA identificará automaticamente receitas, despesas e datas.
                </p>
              </>
            )}
            <input 
              type="file" 
              accept="application/pdf" 
              ref={fileInputRef} 
              className="hidden" 
              disabled={processing}
              onChange={handleFileChange} 
            />
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-5 rounded-xl border border-green-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Receitas Totais</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">{formatCurrency(totalReceitas)}</p>
                </div>
                <span className="bg-green-200 text-green-800 text-xs font-bold px-2 py-1 rounded-full">{extractedData.receitas.length} itens</span>
              </div>
            </div>
            <div className="bg-red-50 p-5 rounded-xl border border-red-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Despesas Totais</p>
                  <p className="text-2xl font-bold text-red-900 mt-1">{formatCurrency(totalDespesas)}</p>
                </div>
                <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded-full">{extractedData.despesas.length} itens</span>
              </div>
            </div>
          </div>

          {/* Tabela de Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-700 flex justify-between items-center">
              <span>Prévia dos Lançamentos</span>
              <span className="text-xs font-normal text-gray-500">Confira os dados antes de salvar</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 sticky top-0 shadow-sm">
                  <tr>
                    <th className="p-3 font-semibold text-gray-600">Tipo</th>
                    <th className="p-3 font-semibold text-gray-600">Descrição</th>
                    <th className="p-3 font-semibold text-gray-600">Categoria</th>
                    <th className="p-3 font-semibold text-gray-600">Data</th>
                    <th className="p-3 font-semibold text-gray-600 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {extractedData.receitas.map((r, i) => (
                    <tr key={`r-${i}`} className="hover:bg-green-50/30 transition">
                      <td className="p-3"><span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">RECEITA</span></td>
                      <td className="p-3 font-medium text-gray-900">{r.description}</td>
                      <td className="p-3 text-gray-500 text-xs uppercase">{r.category}</td>
                      <td className="p-3 text-gray-500 font-mono text-xs">{r.date}</td>
                      <td className="p-3 text-right font-bold text-green-700">{formatCurrency(parseFloat(r.amount))}</td>
                    </tr>
                  ))}
                  {extractedData.despesas.map((d, i) => (
                    <tr key={`d-${i}`} className="hover:bg-red-50/30 transition">
                      <td className="p-3"><span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">DESPESA</span></td>
                      <td className="p-3 font-medium text-gray-900">{d.description}</td>
                      <td className="p-3 text-gray-500 text-xs uppercase">{d.category}</td>
                      <td className="p-3 text-gray-500 font-mono text-xs">{d.date}</td>
                      <td className="p-3 text-right font-bold text-red-700">{formatCurrency(parseFloat(d.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-4 pt-2">
            <button 
              onClick={() => {
                setStep('upload')
                setExtractedData({ receitas: [], despesas: [] })
              }}
              className="flex-1 py-3.5 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition"
            >
              Cancelar / Novo Arquivo
            </button>
            <button 
              onClick={handleConfirmImport}
              disabled={step === 'saving'}
              className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md hover:shadow-lg disabled:opacity-70 transition flex items-center justify-center gap-2"
            >
              {step === 'saving' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                'Confirmar e Importar para o Sistema'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}