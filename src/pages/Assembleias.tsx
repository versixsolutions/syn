import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAssembleias } from '../hooks/useAssembleias'
import { useAuth } from '../contexts/AuthContext'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import type { Assembleia } from '../types'

export default function Assembleias() {
  const navigate = useNavigate()
  const { isAdmin, isSindico } = useAuth()
  const { assembleias, loading } = useAssembleias()
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  const canManage = isAdmin || isSindico

  const assembleiasFiltered = assembleias.filter((a) => {
    if (filtroStatus === 'todos') return true
    return a.status === filtroStatus
  })

  const statusColors: Record<string, string> = {
    agendada: 'bg-blue-50 border-blue-200 text-blue-800',
    em_andamento: 'bg-green-50 border-green-200 text-green-800',
    encerrada: 'bg-gray-50 border-gray-200 text-gray-800',
    cancelada: 'bg-red-50 border-red-200 text-red-800',
  }

  const statusLabels: Record<string, string> = {
    agendada: '📅 Agendada',
    em_andamento: '🟢 Em Andamento',
    encerrada: '✅ Encerrada',
    cancelada: '❌ Cancelada',
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

  if (loading) return <LoadingSpinner message="Carregando assembleias..." />

  return (
    <PageLayout
      title="Assembleias"
      subtitle="Consulte editais, atas e participe das votações"
      icon="🗳️"
    >
      <div className="max-w-5xl mx-auto">
        {/* Header com filtros */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            {['todos', 'agendada', 'em_andamento', 'encerrada', 'cancelada'].map((status) => (
              <button
                key={status}
                onClick={() => setFiltroStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                  filtroStatus === status
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {status === 'todos' ? 'Todas' : statusLabels[status]}
              </button>
            ))}
          </div>

          {canManage && (
            <button
              onClick={() => navigate('/admin/assembleias')}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold hover:shadow-lg transition flex items-center gap-2"
            >
              <span>➕</span>
              Gerenciar
            </button>
          )}
        </div>

        {/* Lista de Assembleias */}
        {assembleiasFiltered.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 p-12 rounded-2xl text-center">
            <div className="text-5xl mb-4">🗳️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {filtroStatus === 'todos' 
                ? 'Nenhuma assembleia cadastrada' 
                : `Nenhuma assembleia ${filtroStatus}`}
            </h3>
            <p className="text-gray-600">
              {canManage
                ? 'Clique em "Gerenciar" para criar uma nova assembleia.'
                : 'Quando houver assembleias, elas aparecerão aqui.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {assembleiasFiltered.map((assembleia) => (
              <AssembleiaCard
                key={assembleia.id}
                assembleia={assembleia}
                statusColors={statusColors}
                statusLabels={statusLabels}
                formatDateTime={formatDateTime}
                onClick={() => navigate(`/transparencia/assembleias/${assembleia.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

interface AssembleiaCardProps {
  assembleia: Assembleia
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  formatDateTime: (date: string) => string
  onClick: () => void
}

function AssembleiaCard({ assembleia, statusColors, statusLabels, formatDateTime, onClick }: AssembleiaCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
              {assembleia.titulo}
            </h3>
            <span className={`text-xs px-3 py-1 rounded-full font-medium border ${statusColors[assembleia.status]}`}>
              {statusLabels[assembleia.status]}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
            <div className="flex items-center gap-1.5">
              <span>📅</span>
              <span>{formatDateTime(assembleia.data_hora)}</span>
            </div>
            {assembleia.edital_topicos && assembleia.edital_topicos.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span>📋</span>
                <span>{assembleia.edital_topicos.length} tópicos no edital</span>
              </div>
            )}
            {assembleia.ata_topicos && assembleia.ata_topicos.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span>📝</span>
                <span>Ata disponível</span>
              </div>
            )}
          </div>

          {/* Preview dos tópicos do edital */}
          {assembleia.edital_topicos && assembleia.edital_topicos.length > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-800">
              <span className="font-bold">Tópicos do Edital:</span>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                {assembleia.edital_topicos.slice(0, 3).map((topico, idx) => (
                  <li key={idx} className="truncate">{topico}</li>
                ))}
                {assembleia.edital_topicos.length > 3 && (
                  <li className="text-purple-600 font-medium">
                    +{assembleia.edital_topicos.length - 3} tópicos...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  )
}
