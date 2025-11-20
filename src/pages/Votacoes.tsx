import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDate } from '../lib/utils'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

interface Votacao {
  id: string
  title: string
  description: string
  status: string
  start_date: string
  end_date: string
  created_at: string
  votes: {
    favor: number
    contra: number
    abstencao: number
    total: number
  }
  user_vote: string | null
}

export default function Votacoes() {
  const [votacoes, setVotacoes] = useState<Votacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active')
  const { user } = useAuth()

  useEffect(() => {
    loadVotacoes()
  }, [user])

  async function loadVotacoes() {
    try {
      const { data: votacoesData, error: votacoesError } = await supabase
        .from('votacoes')
        .select('*')
        .order('end_date', { ascending: false })

      if (votacoesError) throw votacoesError

      const votacoesWithVotes = await Promise.all(
        (votacoesData || []).map(async (votacao) => {
          const { data: votosData, error: votosError } = await supabase
            .from('votos')
            .select('vote')
            .eq('votacao_id', votacao.id)

          if (votosError) throw votosError

          const votes = {
            favor: votosData?.filter(v => v.vote === 'favor').length || 0,
            contra: votosData?.filter(v => v.vote === 'contra').length || 0,
            abstencao: votosData?.filter(v => v.vote === 'abstencao').length || 0,
            total: votosData?.length || 0,
          }

          let userVote = null
          if (user?.id) {
             const { data: userVoteData } = await supabase
            .from('votos')
            .select('vote')
            .eq('votacao_id', votacao.id)
            .eq('user_id', user.id)
            .maybeSingle()
            userVote = userVoteData?.vote || null
          }

          const now = new Date()
          const endDate = new Date(votacao.end_date)
          const computedStatus = endDate > now ? 'ativa' : 'encerrada'

          return { ...votacao, status: computedStatus, votes, user_vote: userVote }
        })
      )
      setVotacoes(votacoesWithVotes)
    } catch (error) {
      console.error('Erro ao carregar votações:', error)
    } finally {
      setLoading(false)
    }
  }

  async function votar(votacaoId: string, voto: 'favor' | 'contra' | 'abstencao') {
    try {
      const { error } = await supabase
        .from('votos')
        .insert({ votacao_id: votacaoId, user_id: user?.id, vote: voto })
      if (error) throw error
      await loadVotacoes()
    } catch (error: any) {
      console.error('Erro ao votar:', error)
      alert(error.message || 'Erro ao registrar voto')
    }
  }

  const ativas = votacoes.filter(v => v.status === 'ativa')
  const encerradas = votacoes.filter(v => v.status === 'encerrada')
  const filteredVotacoes = filter === 'all' ? votacoes : filter === 'active' ? ativas : encerradas

  if (loading) return <LoadingSpinner message="Carregando votações..." />

  return (
    <PageLayout
      title="Votações Online"
      subtitle="Participe das decisões do condomínio"
      icon="🗳️"
    >
      {/* --- 1. CARDS DE RESUMO --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Votações Ativas</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-purple-600">{ativas.length}</p>
            <span className="text-2xl">🔥</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Encerradas</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-gray-600">{encerradas.length}</p>
            <span className="text-2xl">📁</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Sua Participação</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-blue-600">{votacoes.filter(v => v.user_vote).length}</p>
            <span className="text-2xl">🗳️</span>
          </div>
        </div>
      </div>

      {/* --- 2. BARRA DE FILTROS --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 sticky top-20 z-30">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
           <button
             onClick={() => setFilter('active')}
             className={`px-5 py-2 rounded-full text-xs font-bold transition border ${filter === 'active' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
           >
             🔥 Ativas
           </button>
           <button
             onClick={() => setFilter('closed')}
             className={`px-5 py-2 rounded-full text-xs font-bold transition border ${filter === 'closed' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
           >
             📁 Encerradas
           </button>
           <button
             onClick={() => setFilter('all')}
             className={`px-5 py-2 rounded-full text-xs font-bold transition border ${filter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
           >
             Todas
           </button>
        </div>
      </div>

      {/* Lista */}
      {filteredVotacoes.length > 0 ? (
        <div className="space-y-6">
          {filteredVotacoes.map((votacao) => {
             const participation = votacao.votes.total // Simplificado
             const isEnded = votacao.status === 'encerrada'

             return (
              <div key={votacao.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden ${isEnded ? 'border-gray-200' : 'border-purple-500'}`}>
                {/* Header colorido para ativas */}
                {!isEnded && (
                  <div className="bg-purple-600 text-white px-4 py-2 text-xs font-bold flex justify-between items-center">
                    <span>EM ANDAMENTO</span>
                    <span>Termina em {formatDate(votacao.end_date)}</span>
                  </div>
                )}
                
                <div className="p-5">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{votacao.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{votacao.description}</p>

                  {/* Barra de Progresso Visual */}
                  <div className="w-full bg-gray-100 rounded-full h-4 mb-4 overflow-hidden flex">
                     <div style={{ width: `${(votacao.votes.favor / (votacao.votes.total || 1)) * 100}%` }} className="bg-green-500 h-full"></div>
                     <div style={{ width: `${(votacao.votes.contra / (votacao.votes.total || 1)) * 100}%` }} className="bg-red-500 h-full"></div>
                     <div style={{ width: `${(votacao.votes.abstencao / (votacao.votes.total || 1)) * 100}%` }} className="bg-gray-400 h-full"></div>
                  </div>

                  {/* Botões ou Resultado */}
                  {votacao.user_vote ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                      <p className="text-blue-800 text-sm font-bold">Você votou: {votacao.user_vote.toUpperCase()}</p>
                    </div>
                  ) : !isEnded ? (
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => votar(votacao.id, 'favor')} className="bg-green-100 text-green-700 py-2 rounded-lg font-bold text-sm hover:bg-green-200 border border-green-200">Sim 👍</button>
                      <button onClick={() => votar(votacao.id, 'contra')} className="bg-red-100 text-red-700 py-2 rounded-lg font-bold text-sm hover:bg-red-200 border border-red-200">Não 👎</button>
                      <button onClick={() => votar(votacao.id, 'abstencao')} className="bg-gray-100 text-gray-700 py-2 rounded-lg font-bold text-sm hover:bg-gray-200 border border-gray-200">Abster 🤷</button>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 text-sm italic">Votação encerrada.</p>
                  )}
                </div>
              </div>
             )
          })}
        </div>
      ) : (
        <EmptyState icon="🗳️" title="Nenhuma votação encontrada" description="Não há votações neste filtro." />
      )}
    </PageLayout>
  )
}