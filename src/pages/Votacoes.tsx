import { useState } from 'react'
// CORREÇÃO: Ajuste nos caminhos de importação para apontar para os locais corretos
import { useVotacoes } from '../hooks/useVotacoes'
import { useAuth } from '../contexts/AuthContext'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

export default function Votacoes() {
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active')
  const { votacoes, loading, votar, reload } = useVotacoes(filter)
  const { canManage } = useAuth()
  const [votingId, setVotingId] = useState<string | null>(null)

  const handleVote = async (votacaoId: string, optionId: number) => {
    if (!confirm('Confirmar seu voto nesta opção?')) return
    setVotingId(votacaoId)
    try {
      await votar(votacaoId, optionId)
      alert('Voto registrado com sucesso!')
    } catch (error: any) {
      alert('Erro: ' + (error.message || 'Não foi possível votar.'))
    } finally {
      setVotingId(null)
    }
  }

  const filteredVotacoes = filter === 'all' 
    ? votacoes 
    : votacoes.filter(v => v.status === filter)

  if (loading) return <LoadingSpinner message="Carregando pautas..." />

  return (
    <PageLayout
      title="Assembleia Digital"
      subtitle="Participe das decisões com segurança e sigilo"
      icon="🗳️"
      headerAction={
        canManage ? (
          <button 
            onClick={() => alert('Em breve: Criar votação')} 
            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-bold hover:bg-white/30 transition text-sm flex items-center gap-2 border border-white/30"
          >
            <span className="text-lg">+</span> Nova Pauta
          </button>
        ) : null
      }
    >
      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 sticky top-20 z-30">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
           <button onClick={() => setFilter('active')} className={`px-5 py-2 rounded-full text-xs font-bold transition border shrink-0 ${filter === 'active' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>🔥 Ativas</button>
           <button onClick={() => setFilter('closed')} className={`px-5 py-2 rounded-full text-xs font-bold transition border shrink-0 ${filter === 'closed' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>📁 Encerradas</button>
           <button onClick={() => setFilter('all')} className={`px-5 py-2 rounded-full text-xs font-bold transition border shrink-0 ${filter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Todas</button>
        </div>
      </div>

      {/* Lista */}
      {filteredVotacoes.length > 0 ? (
        <div className="space-y-6">
          {filteredVotacoes.map((votacao) => {
             const totalVotes = Object.values(votacao.results || {}).reduce((a, b) => Number(a) + Number(b), 0)
             const isEnded = votacao.status === 'encerrada'
             const daysLeft = Math.ceil((new Date(votacao.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

             return (
              <div key={votacao.id} className={`bg-white rounded-xl shadow-sm border-l-4 overflow-hidden transition ${isEnded ? 'border-l-gray-300' : 'border-l-purple-500'}`}>
                
                {/* Cabeçalho */}
                <div className={`${isEnded ? 'bg-gray-50' : 'bg-purple-50'} border-b border-gray-100 px-5 py-3 flex justify-between items-center`}>
                    <div className="flex items-center gap-2">
                        {isEnded ? <span className="text-xs font-bold text-gray-500">🔒 ENCERRADA</span> : <span className="text-xs font-bold text-purple-700 flex items-center gap-1"><span className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></span> ABERTA</span>}
                        {votacao.is_secret && <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">🙈 Voto Secreto</span>}
                    </div>
                    {!isEnded && <span className="text-[10px] font-medium text-purple-600 bg-white px-2 py-0.5 rounded border border-purple-200">Fim em {daysLeft}d</span>}
                </div>
                
                <div className="p-5 md:p-6">
                  <div className="mb-5">
                    <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">{votacao.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{votacao.description}</p>
                  </div>

                  {/* Área de Resultados */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-xs font-bold text-gray-500 uppercase">Parcial de Votos</span>
                      <span className="text-xs text-gray-500 font-medium">{totalVotes} votos computados</span>
                    </div>
                    
                    <div className="space-y-3">
                        {votacao.options.map(opt => {
                            const count = Number(votacao.results?.[opt.id] || 0)
                            const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                            const isMyVote = votacao.user_vote === opt.text

                            return (
                                <div key={opt.id}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className={`font-medium ${isMyVote ? 'text-purple-700 font-bold' : 'text-gray-700'}`}>
                                            {opt.text} {isMyVote && '(Seu Voto)'}
                                        </span>
                                        <span className="text-gray-500">{percent}% ({count})</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                  </div>

                  {/* Botões de Voto (Só mostra se ativa e não votou) */}
                  {!votacao.user_vote && !isEnded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {votacao.options.map(opt => (
                          <button 
                            key={opt.id}
                            onClick={() => handleVote(votacao.id, opt.id)}
                            disabled={votingId === votacao.id}
                            className="py-3 px-4 bg-white border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 text-gray-700 hover:text-purple-700 rounded-xl font-bold text-sm transition shadow-sm disabled:opacity-50"
                          >
                            {opt.text}
                          </button>
                      ))}
                    </div>
                  )}

                  {votacao.user_vote && (
                      <div className="text-center py-2 bg-green-50 border border-green-100 rounded-lg text-green-800 text-sm font-medium flex items-center justify-center gap-2">
                          <span>✅</span> Voto registrado em: <strong>{votacao.user_vote}</strong>
                      </div>
                  )}
                </div>
              </div>
             )
          })}
        </div>
      ) : (
        <EmptyState icon="🗳️" title="Nenhuma votação" description="Não há pautas neste status." action={{ label: 'Ver todas', onClick: () => setFilter('all') }} />
      )}
    </PageLayout>
  )
}