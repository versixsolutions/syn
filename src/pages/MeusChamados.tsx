import { useState } from 'react'
import { useChamados } from '../hooks/useChamados'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MeusChamados() {
  const { chamados, loading } = useChamados()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  const filteredChamados = chamados.filter(c => 
    statusFilter === 'todos' || c.status === statusFilter
  )

  const statusColors = {
    'aberto': 'bg-yellow-50 border-yellow-200 text-yellow-800',
    'em_andamento': 'bg-blue-50 border-blue-200 text-blue-800',
    'resolvido': 'bg-green-50 border-green-200 text-green-800',
    'fechado': 'bg-gray-50 border-gray-200 text-gray-800'
  }

  const statusLabels = {
    'aberto': '🔴 Aberto',
    'em_andamento': '🟡 Em Andamento',
    'resolvido': '🟢 Resolvido',
    'fechado': '⚫ Fechado'
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) return <LoadingSpinner message="Carregando seus chamados..." />

  return (
    <PageLayout 
      title="Meus Chamados"
      subtitle="Histórico de comunicações com a administração"
      icon="📞"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          {['todos', 'aberto', 'em_andamento', 'resolvido', 'fechado'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                statusFilter === status
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {status === 'todos' ? 'Todos' : statusLabels[status as keyof typeof statusLabels]}
            </button>
          ))}
        </div>

        {/* Lista de Chamados */}
        {filteredChamados.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 p-8 rounded-xl text-center">
            <p className="text-gray-600 text-lg">
              {chamados.length === 0 
                ? '📭 Você ainda não criou nenhum chamado'
                : `📭 Nenhum chamado com o status "${statusFilter}"`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredChamados.map(chamado => (
              <div
                key={chamado.id}
                className={`border rounded-xl overflow-hidden transition hover:shadow-md ${statusColors[chamado.status as keyof typeof statusColors]}`}
              >
                {/* Header do Chamado */}
                <button
                  onClick={() => setExpandedId(expandedId === chamado.id ? null : chamado.id)}
                  className="w-full p-4 flex items-start gap-4 hover:opacity-80 transition text-left"
                >
                  {/* Status Indicator */}
                  <div className="flex-shrink-0 pt-1">
                    {chamado.status === 'aberto' && <span className="text-2xl">🔴</span>}
                    {chamado.status === 'em_andamento' && <span className="text-2xl">🟡</span>}
                    {chamado.status === 'resolvido' && <span className="text-2xl">🟢</span>}
                    {chamado.status === 'fechado' && <span className="text-2xl">⚫</span>}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg break-words">{chamado.subject}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full bg-white bg-opacity-60`}>
                        {statusLabels[chamado.status as keyof typeof statusLabels]}
                      </span>
                    </div>
                    <p className="text-sm opacity-75 mt-1 line-clamp-2">{chamado.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs opacity-60">
                      <span>📅 {formatDate(chamado.created_at)}</span>
                      {chamado.response && <span>💬 Com resposta</span>}
                    </div>
                  </div>

                  {/* Expand Icon */}
                  <div className="flex-shrink-0 text-2xl transition-transform" style={{
                    transform: expandedId === chamado.id ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    ▼
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedId === chamado.id && (
                  <div className="border-t border-current border-opacity-20 p-4 space-y-4 bg-white bg-opacity-40">
                    {/* Descrição completa */}
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Sua Mensagem:</h4>
                      <div className="bg-white bg-opacity-60 p-3 rounded-lg text-sm whitespace-pre-wrap break-words">
                        {chamado.description}
                      </div>
                    </div>

                    {/* Resposta do Síndico */}
                    {chamado.response && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">💬 Resposta do Síndico:</h4>
                        <div className="bg-white bg-opacity-60 p-3 rounded-lg text-sm whitespace-pre-wrap break-words border-l-4 border-primary">
                          {chamado.response}
                        </div>
                      </div>
                    )}

                    {/* Status Timeline */}
                    <div>
                      <h4 className="font-semibold text-sm mb-2">📋 Timeline:</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span>✅</span>
                          <span>Criado em {formatDate(chamado.created_at)}</span>
                        </div>
                        {chamado.updated_at && (
                          <div className="flex items-center gap-2">
                            <span>🔄</span>
                            <span>Atualizado em {formatDate(chamado.updated_at)}</span>
                          </div>
                        )}
                        {chamado.closed_at && (
                          <div className="flex items-center gap-2">
                            <span>🔒</span>
                            <span>Fechado em {formatDate(chamado.closed_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    {chamado.status !== 'fechado' && chamado.response && (
                      <div className="pt-2">
                        <p className="text-xs text-center opacity-60 mb-2">
                          Seu chamado foi respondido. Você pode fechá-lo se o problema foi resolvido.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </PageLayout>
  )
}
