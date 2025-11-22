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
  total_voters: number
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
  
  // Destructuring do 'canManage' para verificar permissão
  const { user, canManage } = useAuth()

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

          return { 
            ...votacao, 
            status: computedStatus, 
            votes, 
            user_vote: userVote,
            total_voters: votacao.total_voters || 100 
          }
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
      title="Assembleia Digital"
      subtitle="Participe das decisões do condomínio"
      icon="🗳️"
      headerAction={
        // Renderiza o botão APENAS se o usuário tiver permissão de gestão (Admin/Síndico)
        canManage ? (
          <button 
            onClick={() => alert('Funcionalidade de criação em desenvolvimento')} // Aqui você ligará a rota de criação futuramente
            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-bold hover:bg-white/30 transition text-sm flex items-center gap-2 border border-white/30"
          >
            <span className="text-lg">+</span> Nova Votação
          </button>
        ) : null
      }
    >
      {/* --- 1. CARDS DE RESUMO --- */}
      <div className="
        flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-4 pb-4 mb-6
        md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:snap-none
        scrollbar-hide
      ">
        <div className="min-w-[240px] snap-center bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Votações Ativas</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-purple-600">{ativas.length}</p>
            <span className="text-2xl">🔥</span>
          </div>
        </div>

        <div className="min-w-[240px] snap-center bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Encerradas</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-gray-600">{encerradas.length}</p>
            <span className="text-2xl">📁</span>
          </div>
        </div>

        <div className="min-w-[240px] snap-center bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Sua Participação</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-blue-600">{votacoes.filter(v => v.user_vote).length}</p>
            <span className="text-2xl">✅</span>
          </div>
        </div>
      </div>

      {/* --- 2. BARRA DE FILTROS --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 sticky top-20 z-30">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
           <button
             onClick={() => setFilter('active')}
             className={`px-5 py-2 rounded-full text-xs font-bold transition border shrink-0 ${filter === 'active' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
           >
             🔥 Ativas
           </button>
           <button
             onClick={() => setFilter('closed')}
             className={`px-5 py-2 rounded-full text-xs font-bold transition border shrink-0 ${filter === 'closed' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
           >
             📁 Encerradas
           </button>
           <button
             onClick={() => setFilter('all')}
             className={`px-5 py-2 rounded-full text-xs font-bold transition border shrink-0 ${filter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
           >
             Todas
           </button>
        </div>
      </div>

      {/* --- 3. LISTA DE VOTAÇÕES --- */}
      {filteredVotacoes.length > 0 ? (
        <div className="space-y-6">
          {filteredVotacoes.map((votacao) => {
             const participation = Math.round((votacao.votes.total / (votacao.total_voters || 1)) * 100)
             const favorPercent = votacao.votes.total > 0 ? Math.round((votacao.votes.favor / votacao.votes.total) * 100) : 0
             const contraPercent = votacao.votes.total > 0 ? Math.round((votacao.votes.contra / votacao.votes.total) * 100) : 0
             const abstencaoPercent = votacao.votes.total > 0 ? Math.round((votacao.votes.abstencao / votacao.votes.total) * 100) : 0
             const isEnded = votacao.status === 'encerrada'
             const daysLeft = Math.ceil((new Date(votacao.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

             return (
              <div key={votacao.id} className={`bg-white rounded-xl shadow-sm border-l-4 overflow-hidden transition hover:shadow-md ${isEnded ? 'border-l-gray-300' : 'border-l-purple-500'}`}>
                
                {/* Header do Card (Status) */}
                {!isEnded && (
                  <div className="bg-purple-50 border-b border-purple-100 px-5 py-2 flex justify-between items-center">
                    <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
                      <span className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></span>
                      EM ANDAMENTO
                    </span>
                    <span className="text-[10px] font-medium text-purple-600 bg-white px-2 py-0.5 rounded border border-purple-200">
                      Termina em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}
                    </span>
                  </div>
                )}
                
                <div className="p-5 md:p-6">
                  <div className="mb-4">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 leading-tight">{votacao.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{votacao.description}</p>
                  </div>

                  {/* Resultados Parciais / Finais */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Resultados</span>
                      <span className="text-xs text-gray-500 font-medium">
                        {votacao.votes.total} votos ({participation}% de participação)
                      </span>
                    </div>
                    
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
                       <div style={{ width: `${favorPercent}%` }} className="bg-green-500 h-full transition-all duration-500"></div>
                       <div style={{ width: `${contraPercent}%` }} className="bg-red-500 h-full transition-all duration-500"></div>
                       <div style={{ width: `${abstencaoPercent}%` }} className="bg-gray-400 h-full transition-all duration-500"></div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-200/50">
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-600">{favorPercent}%</p>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">A Favor</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-red-600">{contraPercent}%</p>
                        <p className="text-[10px] text-gray-500 uppercase font-bold">Contra</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-500">{abstencaoPercent}%</p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Abstenção</p>
                      </div>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  {votacao.user_vote ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-center gap-2 text-blue-800">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-sm font-bold">Voto Registrado: {votacao.user_vote.toUpperCase()}</span>
                    </div>
                  ) : !isEnded ? (
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => votar(votacao.id, 'favor')} className="flex flex-col items-center justify-center py-3 bg-white border-2 border-green-100 text-green-700 rounded-xl hover:bg-green-50 hover:border-green-300 transition group">
                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">👍</span>
                        <span className="text-xs font-bold">SIM</span>
                      </button>
                      <button onClick={() => votar(votacao.id, 'contra')} className="flex flex-col items-center justify-center py-3 bg-white border-2 border-red-100 text-red-700 rounded-xl hover:bg-red-50 hover:border-red-300 transition group">
                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">👎</span>
                        <span className="text-xs font-bold">NÃO</span>
                      </button>
                      <button onClick={() => votar(votacao.id, 'abstencao')} className="flex flex-col items-center justify-center py-3 bg-white border-2 border-gray-100 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition group">
                        <span className="text-xl mb-1 group-hover:scale-110 transition-transform">🤷</span>
                        <span className="text-xs font-bold">ABSTER</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                      <p className="text-sm text-gray-500 font-medium flex items-center justify-center gap-2">
                        <span className="text-lg">🔒</span> Votação encerrada
                      </p>
                    </div>
                  )}
                </div>
              </div>
             )
          })}
        </div>
      ) : (
        <EmptyState icon="🗳️" title="Nenhuma votação encontrada" description="Não há votações correspondentes ao filtro selecionado." action={{ label: 'Ver todas', onClick: () => setFilter('all') }} />
      )}
    </PageLayout>
  )
}