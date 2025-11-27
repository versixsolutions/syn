import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useAdmin } from '../../contexts/AdminContext' // Importar
import { formatCurrency, formatDate } from '../../lib/utils'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/ui/Modal'

interface Despesa {
  id: string
  description: string
  amount: number
  category: string
  due_date: string
  paid_at: string | null
  receipt_url: string | null
}

const CATEGORIES = [
  'Manutenção', 'Administrativa', 'Pessoal', 'Serviços', 'Aquisições', 'Impostos', 'Financeira', 'Outros'
]

export default function FinanceiroManagement() {
  const { user } = useAuth()
  const { selectedCondominioId } = useAdmin() // Contexto Global

  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Manutenção',
    dueDate: '',
    isPaid: false
  })

  useEffect(() => {
    if (selectedCondominioId) {
      loadDespesas()
    }
  }, [selectedCondominioId])

  async function loadDespesas() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('despesas')
        .select('*')
        .eq('condominio_id', selectedCondominioId) // Filtro Seguro
        .order('due_date', { ascending: false })

      if (error) throw error
      setDespesas(data || [])
    } catch (error) {
      console.error('Erro ao carregar despesas:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return
    try {
      const { error } = await supabase.from('despesas').delete().eq('id', id)
      if (error) throw error
      setDespesas(prev => prev.filter(d => d.id !== id))
    } catch (error: any) {
      alert('Erro: ' + error.message)
    }
  }

  async function togglePaid(id: string, currentStatus: boolean) {
    try {
      const updates = {
        paid_at: currentStatus ? null : new Date().toISOString()
      }
      const { error } = await supabase.from('despesas').update(updates).eq('id', id)
      if (error) throw error
      
      setDespesas(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
    } catch (error: any) {
      alert('Erro: ' + error.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedCondominioId) {
      alert("Erro de sessão ou condomínio não selecionado.")
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase.from('despesas').insert({
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        due_date: formData.dueDate,
        paid_at: formData.isPaid ? new Date().toISOString() : null,
        author_id: user.id,
        condominio_id: selectedCondominioId // INSERÇÃO SEGURA
      })

      if (error) throw error

      alert('Despesa lançada com sucesso!')
      setIsModalOpen(false)
      setFormData({ description: '', amount: '', category: 'Manutenção', dueDate: '', isPaid: false })
      loadDespesas()

    } catch (error: any) {
      alert('Erro ao lançar: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão Financeira</h1>
          <p className="text-gray-500 text-sm">Lançamento de despesas para transparência.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-green-700 transition flex items-center gap-2"
        >
          <span>+</span> Nova Despesa
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : despesas.length === 0 ? (
        <EmptyState icon="💰" title="Sem lançamentos" description="Comece a registrar as despesas deste condomínio." />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {despesas.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(item.due_date)}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(item.amount)}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => togglePaid(item.id, !!item.paid_at)}
                        className={`px-2 py-1 rounded text-xs font-bold border transition ${item.paid_at ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200'}`}
                      >
                        {item.paid_at ? 'PAGO' : 'PENDENTE'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-red-400 hover:text-red-600 p-1 transition"
                        title="Excluir"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Lançar Despesa"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              required
              placeholder="Ex: Conta de Luz - Área Comum"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0,00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Vencimento</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                value={formData.dueDate}
                onChange={e => setFormData({...formData, dueDate: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Categoria</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isPaid"
              className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer"
              checked={formData.isPaid}
              onChange={e => setFormData({...formData, isPaid: e.target.checked})}
            />
            <label htmlFor="isPaid" className="text-sm font-medium text-gray-700 cursor-pointer">Já foi pago?</label>
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
              className="flex-1 py-2.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md disabled:opacity-50 transition"
            >
              {isSaving ? 'Salvando...' : 'Salvar Despesa'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}