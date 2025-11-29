import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/utils'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/ui/Modal'
import { useAdmin } from '../../contexts/AdminContext'
import toast from 'react-hot-toast'

interface ChamadoAdmin {
  id: string
  subject: string
  description: string
  status: 'aberto' | 'em_andamento' | 'resolvido' | 'fechado'
  response: string | null
  created_at: string
  updated_at: string | null
  closed_at: string | null
  author: {
    full_name: string
    email: string
    phone?: string
  }
  internal_notes?: string
}

const STATUS_OPTIONS = [
  { value: 'aberto', label: '🔴 Aberto', color: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  { value: 'em_andamento', label: '🟡 Em Andamento', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { value: 'resolvido', label: '🟢 Resolvido', color: 'bg-green-50 text-green-800 border-green-200' },
  { value: 'fechado', label: '⚫ Fechado', color: 'bg-gray-50 text-gray-800 border-gray-200' },
]

export default function ChamadosManagement() {
  const { selectedCondominioId } = useAdmin()

  const [chamados, setChamados] = useState<ChamadoAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('todos')

  const [selectedChamado, setSelectedChamado] = useState<ChamadoAdmin | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [editForm, setEditForm] = useState({
    status: '',
    response: '',
    internal_notes: ''
  })

  useEffect(() => {
    if (selectedCondominioId) {
      loadChamados()
    }
  }, [selectedCondominioId])

  async function loadChamados() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('chamados')
        .select(`
          *,
          author:user_id (
            full_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted: ChamadoAdmin[] = (data || []).map(item => ({
        ...item,
        author: Array.isArray(item.author) ? item.author[0] : item.author
      }))

      setChamados(formatted)
    } catch (error) {
      console.error('Erro ao carregar chamados:', error)
      toast.error('❌ Erro ao carregar chamados')
    } finally {
      setLoading(false)
    }
  }

  function openDetails(chamado: ChamadoAdmin) {
    setSelectedChamado(chamado)
    setEditForm({
      status: chamado.status,
      response: chamado.response || '',
      internal_notes: chamado.internal_notes || ''
    })
    setIsModalOpen(true)
  }

  async function handleSaveUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedChamado) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('chamados')
        .update({
          status: editForm.status as typeof selectedChamado.status,
          response: editForm.response || null,
          internal_notes: editForm.internal_notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedChamado.id)

      if (error) throw error

      toast.success('✅ Chamado atualizado com sucesso!')
      setIsModalOpen(false)
      loadChamados()
    } catch (error) {
      console.error('Erro ao atualizar:', error)
      toast.error('❌ Erro ao atualizar chamado')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCloseChamado() {
    if (!selectedChamado) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('chamados')
        .update({
          status: 'fechado',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedChamado.id)

      if (error) throw error

      toast.success('✅ Chamado fechado')
      setIsModalOpen(false)
      loadChamados()
    } catch (error) {
      console.error('Erro:', error)
      toast.error('❌ Erro ao fechar chamado')
    } finally {
      setIsSaving(false)
    }
  }

  const filteredChamados = chamados.filter(c =>
    filterStatus === 'todos' || c.status === filterStatus
  )

  if (loading) return <LoadingSpinner message="Carregando chamados..." />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">💬 Gerenciar Chamados</h1>
          <p className="text-gray-600 mt-1">Responda mensagens dos moradores</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-primary">{chamados.length}</div>
          <div className="text-xs text-gray-600">Chamados totais</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['todos', 'aberto', 'em_andamento', 'resolvido', 'fechado'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filterStatus === status
                ? 'bg-primary text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status === 'todos'
              ? 'Todos'
              : STATUS_OPTIONS.find(s => s.value === status)?.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filteredChamados.length === 0 ? (
        <EmptyState 
          icon="📭"
          title={filterStatus === 'todos' ? 'Nenhum chamado' : `Nenhum chamado ${filterStatus}`}
          description="Quando os moradores enviarem mensagens, elas aparecerão aqui"
        />
      ) : (
        <div className="space-y-3 bg-white rounded-xl border border-gray-200 divide-y">
          {filteredChamados.map((chamado) => {
            const statusOption = STATUS_OPTIONS.find(s => s.value === chamado.status)

            return (
              <button
                key={chamado.id}
                onClick={() => openDetails(chamado)}
                className="w-full p-4 hover:bg-gray-50 transition text-left"
              >
                <div className="flex items-start gap-4">
                  {/* Status */}
                  <div className="flex-shrink-0">
                    {chamado.status === 'aberto' && <span className="text-2xl">🔴</span>}
                    {chamado.status === 'em_andamento' && <span className="text-2xl">🟡</span>}
                    {chamado.status === 'resolvido' && <span className="text-2xl">🟢</span>}
                    {chamado.status === 'fechado' && <span className="text-2xl">⚫</span>}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 break-words">
                        {chamado.subject}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded font-medium border ${statusOption?.color}`}>
                        {statusOption?.label}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {chamado.description}
                    </p>

                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>👤 {chamado.author?.full_name || 'Usuário'}</span>
                      <span>📧 {chamado.author?.email || 'N/A'}</span>
                      <span>📅 {formatDateTime(chamado.created_at)}</span>
                      {chamado.response && <span>💬 Com resposta</span>}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0 text-gray-400">
                    →
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedChamado && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
          <form onSubmit={handleSaveUpdate} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                📞 {selectedChamado.subject}
              </h2>

              {/* Status */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mensagem Original */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Mensagem do Morador
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm whitespace-pre-wrap break-words text-gray-700">
                  {selectedChamado.description}
                </div>
              </div>

              {/* Resposta */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  💬 Sua Resposta
                </label>
                <textarea
                  value={editForm.response}
                  onChange={e => setEditForm({ ...editForm, response: e.target.value })}
                  placeholder="Escreva sua resposta aqui..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none text-gray-700"
                />
              </div>

              {/* Notas Internas */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  📝 Notas Internas (apenas para admin)
                </label>
                <textarea
                  value={editForm.internal_notes}
                  onChange={e => setEditForm({ ...editForm, internal_notes: e.target.value })}
                  placeholder="Anote informações importantes..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none text-gray-700"
                />
              </div>

              {/* Informações do Morador */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-bold text-gray-900 mb-2">👤 Informações do Morador</h4>
                <div className="space-y-1 text-sm text-gray-700">
                  <div>
                    <span className="font-semibold">Nome:</span> {selectedChamado.author?.full_name}
                  </div>
                  <div>
                    <span className="font-semibold">Email:</span> {selectedChamado.author?.email}
                  </div>
                  {selectedChamado.author?.phone && (
                    <div>
                      <span className="font-semibold">Telefone:</span> {selectedChamado.author.phone}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold">Criado:</span> {formatDateTime(selectedChamado.created_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
                disabled={isSaving}
              >
                Cancelar
              </button>
              {selectedChamado.status !== 'fechado' && (
                <button
                  type="button"
                  onClick={handleCloseChamado}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
                  disabled={isSaving}
                >
                  🔒 Fechar Chamado
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold rounded-lg hover:shadow-lg transition disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? '⏳ Salvando...' : '💾 Salvar Alterações'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
