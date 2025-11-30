import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext' // Importar useAuth
import { formatDateTime } from '../lib/utils'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

interface Ocorrencia {
  id: string
  title: string
  description: string
  status: string
  created_at: string
  resolved_at: string | null
  author_id: string // Importante para identificar se é minha
  author: {
    full_name: string
    unit_number: string
  } | null
}

const STATUS_CONFIG: any = {
  aberto: { label: 'Aberto', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '🆕' },
  em_andamento: { label: 'Em Andamento', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '⏳' },
  resolvido: { label: 'Resolvido', color: 'bg-green-100 text-green-700 border-green-200', icon: '✅' },
  arquivado: { label: 'Arquivado', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: '🔒' },
}

export default function Ocorrencias() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [showOnlyMine, setShowOnlyMine] = useState(false)

  useEffect(() => {
    loadOcorrencias()
  }, [])

  async function loadOcorrencias() {
    try {
      const { data, error } = await supabase
        .from('ocorrencias')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          resolved_at,
          author_id,
          author:author_id (
            full_name,
            unit_number
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted = data?.map(o => ({
        ...o,
        author: Array.isArray(o.author) ? o.author[0] : o.author,
      })) || []

      setOcorrencias(formatted as any)
    } catch (error) {
      console.error('Erro ao carregar ocorrências:', error)
    } finally {
      setLoading(false)
    }
  }

  // Lógica de Filtros Combinados
  const filteredOcorrencias = ocorrencias.filter(o => {
    const matchesStatus = selectedStatus ? o.status === selectedStatus : true
    const matchesMine = showOnlyMine ? o.author_id === user?.id : true
    return matchesStatus && matchesMine
  })

  const stats = {
    abertas: ocorrencias.filter(o => o.status === 'aberto').length,
    em_andamento: ocorrencias.filter(o => o.status === 'em_andamento').length,
    resolvidas: ocorrencias.filter(o => o.status === 'resolvido').length,
  }

  if (loading) return <LoadingSpinner message="Carregando ocorrências..." />

  return (
    <PageLayout
      title="Central de Ocorrências"
      subtitle="Acompanhe e reporte problemas do condomínio"
      icon="🚨"
      headerAction={
        <button 
          onClick={() => navigate('/ocorrencias/nova')} 
          className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-bold hover:bg-white/30 transition text-sm flex items-center gap-2 border border-white/30"
        >
          <span className="text-lg">+</span> Nova
        </button>
      }
    >
      {/* --- 1. CARDS DE RESUMO --- */}
      <div className="
        flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-4 pb-4 mb-6
        md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:snap-none
        scrollbar-hide
      ">
        {/* Cards mantidos iguais ao anterior... */}
        <div className="min-w-[240px] snap-center bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Novas / Abertas</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-blue-600">{stats.abertas}</p>
            <span className="text-2xl">🆕</span>
          </div>
        </div>
        {/* ... outros cards */}
      </div>

      {/* --- 2. BARRA DE FILTROS --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 sticky top-20 z-30">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            
            {/* Toggle "Minhas Ocorrências" */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                <button
                    onClick={() => setShowOnlyMine(false)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${!showOnlyMine ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                >
                    Todas
                </button>
                <button
                    onClick={() => setShowOnlyMine(true)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${showOnlyMine ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                >
                    Minhas
                </button>
            </div>

            {/* Filtros de Status */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide w-full md:w-auto">
            <button
                onClick={() => setSelectedStatus(null)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition shrink-0 border ${
                !selectedStatus
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
            >
                Todos Status
            </button>
            {Object.entries(STATUS_CONFIG).map(([key, config]: any) => (
                <button
                key={key}
                onClick={() => setSelectedStatus(key)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition shrink-0 border flex items-center gap-2 ${
                    selectedStatus === key
                    ? `${config.color} shadow-sm ring-1 ring-offset-1 ring-transparent`
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                >
                <span>{config.icon}</span> {config.label}
                </button>
            ))}
            </div>
        </div>
      </div>

      {/* Lista */}
      {filteredOcorrencias.length > 0 ? (
        <div className="space-y-4">
          {filteredOcorrencias.map((ocorrencia) => {
            const statusConfig = STATUS_CONFIG[ocorrencia.status] || STATUS_CONFIG.aberto
            const isMine = ocorrencia.author_id === user?.id // Verifica se é do usuário

            return (
              <div
                key={ocorrencia.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition ${isMine ? 'border-l-4 border-l-primary border-gray-200' : 'border-gray-200'}`}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        {isMine && (
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-primary/20">
                                Minha
                            </span>
                        )}
                        <span className="text-xs text-gray-400">#{ocorrencia.id.slice(0, 6)}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-lg">{ocorrencia.title}</h3>
                    </div>
                    {ocorrencia.status === 'resolvido' && (
                      <span className="text-green-500 text-2xl">✅</span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{ocorrencia.description}</p>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-100 px-2 py-1 rounded text-gray-600 font-medium">
                        {ocorrencia.author?.full_name || 'Anônimo'}
                      </span>
                      <span>• {formatDateTime(ocorrencia.created_at)}</span>
                    </div>
                    {/* Em breve: Link para ver detalhes */}
                    <button className="text-primary font-bold hover:underline">Detalhes &rarr;</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon="🎉"
          title="Nenhuma ocorrência"
          description="Não há registros com este filtro."
          action={{ label: 'Limpar Filtros', onClick: () => { setSelectedStatus(null); setShowOnlyMine(false); } }}
        />
      )}
    </PageLayout>
  )
}