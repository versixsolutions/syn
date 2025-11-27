import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useAdmin } from '../../contexts/AdminContext' // Importar
import { formatDateTime } from '../../lib/utils'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/ui/Modal'

interface Votacao {
  id: string
  title: string
  description: string
  status: string
  end_date: string
  options: Array<{ id: number; text: string }>
  total_voters: number
  created_at: string
}

export default function VotacoesManagement() {
  const { user } = useAuth()
  const { selectedCondominioId } = useAdmin() // Contexto Global

  const [votacoes, setVotacoes] = useState<Votacao[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    endDate: '',
    options: [{ id: 1, text: 'A Favor' }, { id: 2, text: 'Contra' }, { id: 3, text: 'Abstenção' }]
  })

  useEffect(() => {
    if (selectedCondominioId) {
      loadVotacoes()
    }
  }, [selectedCondominioId])

  async function loadVotacoes() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('votacoes')
        .select('*')
        .eq('condominio_id', selectedCondominioId) // Filtro Seguro
        .order('created_at', { ascending: false })

      if (error) throw error
      
      const now = new Date()
      const formatted = (data || []).map(v => ({
        ...v,
        status: new Date(v.end_date) > now ? 'ativa' : 'encerrada'
      }))
      
      setVotacoes(formatted)
    } catch (error) {
      console.error('Erro ao carregar votações:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza? Isso apagará todos os votos registrados!')) return
    try {
      const { error } = await supabase.from('votacoes').delete().eq('id', id)
      if (error) throw error
      setVotacoes(prev => prev.filter(v => v.id !== id))
    } catch (error: any) {
      alert('Erro ao excluir: ' + error.message)
    }
  }

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, { id: Date.now(), text: '' }]
    }))
  }

  const removeOption = (id: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter(opt => opt.id !== id)
    }))
  }

  const updateOptionText = (id: number, text: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map(opt => opt.id === id ? { ...opt, text } : opt)
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedCondominioId) return

    if (formData.options.length < 2) {
      alert('A votação precisa ter pelo menos 2 opções.')
      return
    }
    if (formData.options.some(opt => !opt.text.trim())) {
      alert('Preencha o texto de todas as opções.')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase.from('votacoes').insert({
        title: formData.title,
        description: formData.description,
        end_date: formData.endDate,
        options: formData.options,
        author_id: user.id,
        is_secret: false,
        condominio_id: selectedCondominioId // INSERÇÃO SEGURA
      })

      if (error) throw error

      alert('Votação criada com sucesso!')
      setIsModalOpen(false)
      setFormData({
        title: '',
        description: '',
        endDate: '',
        options: [{ id: 1, text: 'Sim' }, { id: 2, text: 'Não' }]
      })
      loadVotacoes()

    } catch (error: any) {
      alert('Erro ao criar: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assembleia Digital</h1>
          <p className="text-gray-500 text-sm">Crie votações e acompanhe resultados.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-purple-700 transition flex items-center gap-2"
        >
          <span>+</span> Nova Votação
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : votacoes.length === 0 ? (
        <EmptyState icon="🗳️" title="Nenhuma votação" description="Crie uma nova pauta para decisão dos moradores." />
      ) : (
        <div className="grid gap-4">
          {votacoes.map((votacao) => (
            <div key={votacao.id} className={`bg-white p-5 rounded-xl shadow-sm border-l-4 transition relative group ${votacao.status === 'ativa' ? 'border-l-green-500' : 'border-l-gray-300'}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {votacao.status === 'ativa' ? (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Ativa
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                        Encerrada
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      Fim: {formatDateTime(votacao.end_date)}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg">{votacao.title}</h3>
                </div>
                
                <button 
                  onClick={() => handleDelete(votacao.id)}
                  className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"
                  title="Excluir"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              
              <p className="text-gray-600 text-sm mb-3">{votacao.description}</p>
              
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Opções de Voto:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(votacao.options) && votacao.options.map((opt: any) => (
                    <span key={opt.id} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded text-gray-600 font-medium">
                      {opt.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nova Votação"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Título da Pauta</label>
            <input
              type="text"
              required
              placeholder="Ex: Aprovação da Reforma da Fachada"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Descrição Detalhada</label>
            <textarea
              required
              rows={3}
              placeholder="Explique o motivo da votação..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Data de Encerramento</label>
            <input
              type="datetime-local"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              value={formData.endDate}
              onChange={e => setFormData({...formData, endDate: e.target.value})}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-gray-700">Opções de Voto</label>
              <button type="button" onClick={addOption} className="text-xs text-purple-600 font-bold hover:underline">+ Adicionar Opção</button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {formData.options.map((opt, index) => (
                <div key={opt.id} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Opção ${index + 1}`}
                    required
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    value={opt.text}
                    onChange={e => updateOptionText(opt.id, e.target.value)}
                  />
                  {formData.options.length > 2 && (
                    <button 
                      type="button" 
                      onClick={() => removeOption(opt.id)}
                      className="text-red-500 hover:text-red-700 px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
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
              className="flex-1 py-2.5 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-md disabled:opacity-50 transition"
            >
              {isSaving ? 'Criando...' : 'Iniciar Votação'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}