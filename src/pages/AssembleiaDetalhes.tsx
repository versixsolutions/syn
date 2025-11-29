import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAssembleias } from '../hooks/useAssembleias'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { exportarResultadosAssembleiaPDF } from '../lib/pdfExportAssembleias'
import { QRCodeCanvas } from 'qrcode.react'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'
import type { Assembleia, AssembleiaPresenca, AssembleiaPauta, ResultadoVotacao } from '../types'

export default function AssembleiaDetalhes() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, canManage } = useAuth()
  const { registrarPresenca, votar, loadPresencas, loadPautas, loadResultados } = useAssembleias()

  const [assembleia, setAssembleia] = useState<Assembleia | null>(null)
  const [presencas, setPresencas] = useState<AssembleiaPresenca[]>([])
  const [pautas, setPautas] = useState<AssembleiaPauta[]>([])
  const [resultados, setResultados] = useState<Record<string, ResultadoVotacao>>({})
  const [loading, setLoading] = useState(true)
  const [registrandoPresenca, setRegistrandoPresenca] = useState(false)
  const [jaRegistrado, setJaRegistrado] = useState(false)
  const [exportandoPDF, setExportandoPDF] = useState(false)
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    if (id) {
      loadData()
      setupRealtimeSubscription()
    }
  }, [id])

  async function loadData() {
    if (!id) return

    setLoading(true)
    try {
      // Carregar assembleia
      const { data: assembleiaData } = await supabase
        .from('assembleias')
        .select('*')
        .eq('id', id)
        .single()

      if (assembleiaData) {
        setAssembleia(assembleiaData)
      }

      // Carregar presenças
      const presencasData = await loadPresencas(id)
      setPresencas(presencasData)

      // Verificar se usuário já registrou presença
      if (user) {
        const jaRegistrouPresenca = presencasData.some(p => p.user_id === user.id)
        setJaRegistrado(jaRegistrouPresenca)
      }

      // Carregar pautas
      const pautasData = await loadPautas(id)
      setPautas(pautasData)

      // Carregar resultados para pautas encerradas
      const resultadosTemp: Record<string, ResultadoVotacao> = {}
      for (const pauta of pautasData) {
        if (pauta.status === 'encerrada') {
          const resultado = await loadResultados(pauta.id)
          if (resultado) {
            resultadosTemp[pauta.id] = resultado
          }
        }
      }
      setResultados(resultadosTemp)

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('❌ Erro ao carregar assembleia')
    } finally {
      setLoading(false)
    }
  }

  function setupRealtimeSubscription() {
    if (!id) return

    // Subscribe para mudanças em pautas (quando síndico abre/fecha votação)
    const subscription = supabase
      .channel(`assembleia-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assembleias_pautas',
          filter: `assembleia_id=eq.${id}`,
        },
        () => {
          loadData() // Recarregar dados quando houver mudanças
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }

  async function handleRegistrarPresenca() {
    if (!id) return

    setRegistrandoPresenca(true)
    const success = await registrarPresenca(id)
    setRegistrandoPresenca(false)

    if (success) {
      setJaRegistrado(true)
      loadData() // Atualizar lista de presenças
    }
  }

  async function handleExportarPDF() {
    if (!id) return

    setExportandoPDF(true)
    toast.loading('Gerando PDF...')
    
    const result = await exportarResultadosAssembleiaPDF(id)
    
    setExportandoPDF(false)
    toast.dismiss()
    
    if (result.success) {
      toast.success('PDF exportado com sucesso!')
    } else {
      toast.error('Erro ao exportar PDF')
    }
  }

  async function handleVotar(pautaId: string, opcao: string) {
    const success = await votar(pautaId, opcao)
    if (success) {
      loadData() // Atualizar dados
    }
  }

  function formatDateTime(dateString: string) {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return <LoadingSpinner message="Carregando assembleia..." />
  if (!assembleia) return <div>Assembleia não encontrada</div>

  const podeRegistrarPresenca = assembleia.status === 'em_andamento' && !jaRegistrado
  const pautasEmVotacao = pautas.filter(p => p.status === 'em_votacao')

  return (
    <PageLayout
      title={assembleia.titulo}
      subtitle={formatDateTime(assembleia.data_hora)}
      icon="🗳️"
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Status da Assembleia */}
        <div className={`p-4 rounded-xl border-2 ${
          assembleia.status === 'em_andamento' 
            ? 'bg-green-50 border-green-300' 
            : assembleia.status === 'agendada'
            ? 'bg-blue-50 border-blue-300'
            : 'bg-gray-50 border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">
                {assembleia.status === 'em_andamento' && '🟢 Assembleia em Andamento'}
                {assembleia.status === 'agendada' && '📅 Assembleia Agendada'}
                {assembleia.status === 'encerrada' && '✅ Assembleia Encerrada'}
                {assembleia.status === 'cancelada' && '❌ Assembleia Cancelada'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {presencas.length} presença{presencas.length !== 1 ? 's' : ''} registrada{presencas.length !== 1 ? 's' : ''}
              </p>
            </div>

        {/* Ações Rápidas */}
        <div className="flex gap-3">
          {assembleia.status === 'encerrada' && (
            <button
              onClick={handleExportarPDF}
              disabled={exportandoPDF}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {exportandoPDF ? '⏳ Gerando...' : '📄 Exportar Resultados (PDF)'}
            </button>
          )}
          {canManage && assembleia.status === 'em_andamento' && (
            <button
              onClick={() => setShowQR(true)}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
              data-testid="btn-abrir-qr"
            >
              🧾 Abrir QR de Presença
            </button>
          )}
        </div>

            {podeRegistrarPresenca && (
              <button
                onClick={handleRegistrarPresenca}
                disabled={registrandoPresenca}
                className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition disabled:opacity-50"
              >
                {registrandoPresenca ? '⏳ Registrando...' : '✅ Registrar Presença'}
              </button>
            )}

            {jaRegistrado && assembleia.status === 'em_andamento' && (
              <div className="px-6 py-3 bg-green-100 text-green-800 rounded-xl font-bold border border-green-300">
                ✅ Presença Confirmada
              </div>
            )}
          </div>
        </div>

        {/* Edital */}
        {assembleia.edital_topicos && assembleia.edital_topicos.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">📋 Edital da Assembleia</h3>
              {assembleia.edital_pdf_url && (
                <a
                  href={assembleia.edital_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-purple-600 hover:underline flex items-center gap-1"
                >
                  📄 Baixar PDF
                </a>
              )}
            </div>
            <ul className="space-y-2">
              {assembleia.edital_topicos.map((topico, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm text-gray-700">{topico}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pautas em Votação */}
        {pautasEmVotacao.length > 0 && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl p-5">
            <h3 className="text-lg font-bold text-purple-900 mb-4">🗳️ Votações Abertas</h3>
            <div className="space-y-4">
              {pautasEmVotacao.map((pauta) => (
                <PautaVotacao
                  key={pauta.id}
                  pauta={pauta}
                  onVotar={handleVotar}
                  userId={user?.id || ''}
                />
              ))}
            </div>
          </div>
        )}

        {/* Resultados das Votações */}
        {Object.keys(resultados).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Resultados das Votações</h3>
            <div className="space-y-4">
              {Object.values(resultados).map((resultado) => (
                <ResultadoCard key={resultado.pauta_id} resultado={resultado} />
              ))}
            </div>
          </div>
        )}

        {/* Ata */}
        {assembleia.ata_topicos && assembleia.ata_topicos.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">📝 Ata da Assembleia</h3>
              {assembleia.ata_pdf_url && (
                <a
                  href={assembleia.ata_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-purple-600 hover:underline flex items-center gap-1"
                >
                  📄 Baixar PDF
                </a>
              )}
            </div>
            <ul className="space-y-2">
              {assembleia.ata_topicos.map((topico, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm text-gray-700">{topico}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Lista de Presenças */}
        {presencas.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              ✅ Presenças Registradas ({presencas.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {presencas.map((presenca) => (
                <div key={presenca.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                  <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold">
                    {presenca.user?.full_name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-gray-900 truncate">
                      {presenca.user?.full_name || 'Usuário'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Apto {presenca.user?.unit_number || 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botão Voltar */}
        <div className="text-center pt-4">
          <button
            onClick={() => navigate('/transparencia/assembleias')}
            className="text-purple-600 font-bold hover:underline"
          >
            ← Voltar para lista de assembleias
          </button>
        </div>

      </div>

      {/* Modal QR */}
      {showQR && assembleia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={()=>setShowQR(false)} data-testid="modal-qr">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">QR de Presença</h3>
              <button onClick={()=>setShowQR(false)} className="text-gray-500 hover:text-gray-800 font-bold">✖</button>
            </div>
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-white border rounded-xl">
                <QRCodeCanvas value={`${window.location.origin}/transparencia/assembleias/${assembleia.id}/presenca`} size={220} includeMargin={true} />
              </div>
            </div>
            <div className="text-sm text-gray-700 break-all mb-4">
              <span className="font-bold text-gray-900">Link:</span>{' '}
              {`${window.location.origin}/transparencia/assembleias/${assembleia.id}/presenca`}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/transparencia/assembleias/${assembleia.id}/presenca`)} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold" data-testid="btn-copiar-link">Copiar Link</button>
              <a href={`/transparencia/assembleias/${assembleia.id}/presenca`} target="_blank" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold" data-testid="btn-abrir-nova-aba">Abrir em Nova Aba</a>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

interface PautaVotacaoProps {
  pauta: AssembleiaPauta
  onVotar: (pautaId: string, opcao: string) => void
  userId: string
}

function PautaVotacao({ pauta, onVotar, userId }: PautaVotacaoProps) {
  const [jaVotou, setJaVotou] = useState(false)
  const [votando, setVotando] = useState(false)

  useEffect(() => {
    checkIfVoted()
  }, [pauta.id, userId])

  async function checkIfVoted() {
    if (!userId) return

    const { data } = await supabase
      .from('assembleias_votos')
      .select('id')
      .eq('pauta_id', pauta.id)
      .eq('user_id', userId)
      .single()

    setJaVotou(!!data)
  }

  async function handleVoto(opcao: string) {
    setVotando(true)
    await onVotar(pauta.id, opcao)
    setJaVotou(true)
    setVotando(false)
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-purple-200">
      <h4 className="font-bold text-gray-900 mb-2">{pauta.titulo}</h4>
      <p className="text-sm text-gray-600 mb-4">{pauta.descricao}</p>

      {jaVotou ? (
        <div className="bg-green-100 text-green-800 p-3 rounded-lg text-center font-bold">
          ✅ Voto registrado com sucesso
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {pauta.opcoes.map((opcao) => (
            <button
              key={opcao}
              onClick={() => handleVoto(opcao)}
              disabled={votando}
              className="py-3 px-4 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-lg font-bold transition disabled:opacity-50"
            >
              {opcao}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ResultadoCardProps {
  resultado: ResultadoVotacao
}

function ResultadoCard({ resultado }: ResultadoCardProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h4 className="font-bold text-gray-900 mb-3">{resultado.titulo}</h4>
      <div className="space-y-2">
        {resultado.resultados.map((r) => (
          <div key={r.opcao}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">{r.opcao}</span>
              <span className="font-bold text-purple-600">
                {r.votos} voto{r.votos !== 1 ? 's' : ''} ({r.percentual.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${r.percentual}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {resultado.vencedor && (
        <div className="mt-3 bg-purple-100 text-purple-900 p-2 rounded text-center font-bold text-sm">
          🏆 Resultado: {resultado.vencedor}
        </div>
      )}
    </div>
  )
}
