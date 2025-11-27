import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/utils'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/ui/Modal'
import { useAdmin } from '../../contexts/AdminContext' // Importar

interface OcorrenciaAdmin {
  id: string
  title: string
  description: string
  category: string
  status: string
  location: string
  photo_url: string | null
  created_at: string
  author: {
    full_name: string
    unit_number: string
    phone: string
  }
  admin_response?: string
  internal_notes?: string
}

const STATUS_OPTIONS = [
  { value: 'aberto', label: 'Aberto', color: 'bg-blue-100 text-blue-800' },
  { value: 'em_analise', label: 'Em Análise', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'em_andamento', label: 'Em Andamento', color: 'bg-orange-100 text-orange-800' },
  { value: 'resolvido', label: 'Resolvido', color: 'bg-green-100 text-green-800' },
  { value: 'arquivado', label: 'Arquivado', color: 'bg-gray-100 text-gray-800' },
]

export default function OcorrenciasManagement() {
  const { selectedCondominioId } = useAdmin() // Contexto Global
  
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  
  const [selectedOcorrencia, setSelectedOcorrencia] = useState<OcorrenciaAdmin | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [editForm, setEditForm] = useState({
    status: '',
    admin_response: '',
    internal_notes: ''
  })

  useEffect(() => {
    if (selectedCondominioId) {
      loadOcorrencias()
    }
  }, [selectedCondominioId])

  async function loadOcorrencias() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ocorrencias')
        .select(`
          *,
          author:author_id (
            full_name,
            unit_number,
            phone
          )
        `)
        .eq('condominio_id', selectedCondominioId) // Filtro Seguro
        .order('created_at', { ascending: false })

      if (error) throw error

      const formatted: OcorrenciaAdmin[] = (data || []).map(item => ({
        ...item,
        author: Array.isArray(item.author) ? item.author[0] : item.author
      }))

      setOcorrencias(formatted)
    } catch (error) {
      console.error('Erro ao carregar ocorrências:', error)
    } finally {
      setLoading(false)
    }
  }

  function openDetails(oco: OcorrenciaAdmin) {
    setSelectedOcorrencia(oco)
    setEditForm({
      status: oco.status,
      admin_response: oco.admin_response || '',
      internal_notes: oco.internal_notes || ''
    })
    setIsModalOpen(true)
  }

  async function handleSaveUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOcorrencia) return

    setIsSaving(true)
    try {
      const updates = {
        status: editForm.status,
        admin_response: editForm.admin_response,
        // internal_notes: editForm.internal_notes 
      }
      
      const { error } = await supabase
        .from('ocorrencias')
        .update(updates)
        .eq('id', selectedOcorrencia.id)

      if (error) throw error

      setOcorrencias(prev => prev.map(o => 
        o.id === selectedOcorrencia.id 
          ? { ...o, ...updates } 
          : o
      ))

      alert('Ocorrência atualizada!')
      setIsModalOpen(false)
    } catch (error: any) {
      alert('Erro ao atualizar: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const filtered = filterStatus === 'todos' 
    ? ocorrencias 
    : ocorrencias.filter(o => o.status === filterStatus)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Ocorrências</h1>
          <p className="text-gray-500 text-sm">Acompanhe e resolva as solicitações dos moradores.</p>
        </div>
        
        <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-transparent text-sm font-medium text-gray-600 outline-none px-2 py-1 cursor-pointer"
          >
            <option value="todos">Todos os Status</option>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon="✅" title="Tudo tranquilo" description="Nenhuma ocorrência encontrada com este filtro." />
      ) : (
        <div className="grid gap-4">
          {filtered.map((oco) => (
            <div 
              key={oco.id} 
              onClick={() => openDetails(oco)}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row gap-4"
            >
              <div className="w-full sm:w-24 h-24 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-200">
                {oco.photo_url ? (
                  <img src={oco.photo_url} alt="Evidência" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">📷</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-gray-900 truncate">{oco.title}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_OPTIONS.find(s => s.value === oco.status)?.color || 'bg-gray-100'}`}>
                    {STATUS_OPTIONS.find(s => s.value === oco.status)?.label || oco.status}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{oco.description}</p>
                
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                    👤 {oco.author?.full_name || 'Anônimo'}
                  </span>
                  <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                    🏠 Unid: {oco.author?.unit_number || '-'}
                  </span>
                  <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                    📍 {oco.location}
                  </span>
                  <span className="flex items-center gap-1">
                    📅 {formatDateTime(oco.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tratar Ocorrência"
      >
        {selectedOcorrencia && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h4 className="font-bold text-lg text-gray-900 mb-1">{selectedOcorrencia.title}</h4>
              <p className="text-sm text-gray-700 mb-3">{selectedOcorrencia.description}</p>
              
              <div className="flex gap-4 text-xs text-gray-500">
                <span><strong>Local:</strong> {selectedOcorrencia.location}</span>
                <span><strong>Categoria:</strong> {selectedOcorrencia.category}</span>
              </div>

              {selectedOcorrencia.photo_url && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-1">Evidência Anexada</p>
                  <a href={selectedOcorrencia.photo_url} target="_blank" rel="noreferrer">
                    <img src={selectedOcorrencia.photo_url} alt="Evidência" className="w-full h-48 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition" />
                  </a>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Alterar Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Resposta ao Morador
                  <span className="ml-2 text-xs font-normal text-gray-400">(Visível no app)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: A manutenção foi agendada para sexta-feira."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  value={editForm.admin_response}
                  onChange={(e) => setEditForm({...editForm, admin_response: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Notas Internas
                  <span className="ml-2 text-xs font-normal text-gray-400 bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Privado</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Orçamento aprovado com a empresa X. Valor R$ 500."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none resize-none bg-yellow-50/30"
                  value={editForm.internal_notes}
                  onChange={(e) => setEditForm({...editForm, internal_notes: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md disabled:opacity-50 transition"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Tratamento'}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  )
}