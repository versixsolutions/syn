import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/ui/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useAdmin } from '../../contexts/AdminContext'
import toast from 'react-hot-toast'

interface UserData {
  id: string
  email: string
  full_name: string
  role: string
  unit_number: string
  phone: string
  created_at: string
  condominio_id: string
}

const ROLES = [
  { value: 'morador', label: 'Morador' },
  { value: 'conselho', label: 'Conselho Fiscal' },
  { value: 'sub_sindico', label: 'Sub-Síndico' },
  { value: 'sindico', label: 'Síndico' },
  { value: 'admin', label: 'Administrador (Super)' },
  { value: 'portaria', label: 'Portaria' }
]

export default function UserManagement() {
  const { user: currentUser, profile, isAdmin } = useAuth()
  const { selectedCondominioId } = useAdmin() 
  
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'active'>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)

  useEffect(() => {
    if (selectedCondominioId) {
      loadUsers()
    }
  }, [selectedCondominioId])

  async function loadUsers() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('condominio_id', selectedCondominioId) 
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    if (!confirm('Confirmar aprovação deste morador?')) return
    setProcessingId(id)
    const toastId = toast.loading('Aprovando...')

    try {
      const { error } = await supabase
        .from('users')
        .update({ role: 'morador' })
        .eq('id', id)

      if (error) throw error
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: 'morador' } : u))
      toast.success('Usuário aprovado!', { id: toastId })
    } catch (error: any) {
      toast.error('Erro: ' + error.message, { id: toastId })
    } finally {
      setProcessingId(null)
    }
  }

  // Lógica de Exclusão Definitiva (Hard Delete)
  async function handleDeleteUser(id: string) {
    if (!confirm('ATENÇÃO: Isso excluirá PERMANENTEMENTE o usuário e todos os seus dados (login, perfil, histórico). Tem certeza?')) return

    setProcessingId(id)
    const toastId = toast.loading('Excluindo usuário...')

    try {
      // Chama a Edge Function para deletar do Auth (que cascateia para o DB)
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: id }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      // Remove da lista local
      setUsers(prev => prev.filter(u => u.id !== id))
      toast.success('Usuário excluído com sucesso!', { id: toastId })

    } catch (error: any) {
      console.error('Erro ao deletar:', error)
      // Fallback: Se a Edge Function falhar (ex: configuração), tenta deletar só do banco público
      if (confirm('A exclusão completa falhou. Deseja forçar a remoção apenas do painel (o login pode permanecer)?')) {
          const { error: dbError } = await supabase.from('users').delete().eq('id', id)
          if (!dbError) {
              setUsers(prev => prev.filter(u => u.id !== id))
              toast.success('Removido do painel (Soft Delete).', { id: toastId })
          } else {
              toast.error('Falha total na exclusão.', { id: toastId })
          }
      } else {
          toast.error('Erro: ' + error.message, { id: toastId })
      }
    } finally {
      setProcessingId(null)
    }
  }

  function openEditModal(targetUser: UserData) {
    if (!isAdmin && targetUser.role === 'admin') {
      toast.error('Apenas Super Administradores podem editar outros Administradores.')
      return
    }
    setEditingUser({ ...targetUser })
    setIsEditModalOpen(true)
  }

  // Função correta para salvar edição
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser || !currentUser) return

    if (!isAdmin && editingUser.role === 'admin') {
      toast.error('Você não tem permissão para promover usuários a Administrador.')
      return
    }

    setProcessingId(editingUser.id)
    const toastId = toast.loading('Salvando alterações...')
    
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: editingUser.full_name,
          unit_number: editingUser.unit_number,
          phone: editingUser.phone,
          role: editingUser.role
        })
        .eq('id', editingUser.id)

      if (error) throw error

      setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u))
      setIsEditModalOpen(false)
      setEditingUser(null)
      toast.success('Dados atualizados!', { id: toastId })

    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message, { id: toastId })
    } finally {
      setProcessingId(null)
    }
  }

  const filteredUsers = users.filter(u => {
    if (filter === 'pending') return u.role === 'pending'
    if (filter === 'active') return u.role !== 'pending'
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Usuários</h1>
          <p className="text-gray-500 text-sm">Administre permissões e cadastros deste condomínio.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <button onClick={() => setFilter('pending')} className={`px-4 py-2 rounded-md text-sm font-bold transition ${filter === 'pending' ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            Pendentes ({users.filter(u => u.role === 'pending').length})
          </button>
          <button onClick={() => setFilter('active')} className={`px-4 py-2 rounded-md text-sm font-bold transition ${filter === 'active' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            Ativos ({users.filter(u => u.role !== 'pending').length})
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filteredUsers.length === 0 ? (
        <EmptyState icon={filter === 'pending' ? '✅' : '👥'} title={filter === 'pending' ? 'Tudo limpo!' : 'Nenhum usuário'} description="Nenhum registro encontrado para este condomínio." />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Unidade</th>
                  <th className="px-6 py-4">Nível</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900 text-sm">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono text-xs font-bold border border-gray-200">{user.unit_number || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border 
                        ${user.role === 'admin' ? 'bg-red-100 text-red-800 border-red-200' : 
                          user.role === 'sindico' ? 'bg-purple-100 text-purple-800 border-purple-200' : 
                          'bg-green-100 text-green-800 border-green-200'}`}>
                        {user.role === 'sub_sindico' ? 'Sub-Síndico' : user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.role === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleDeleteUser(user.id)} 
                            disabled={processingId === user.id}
                            className="text-red-500 hover:bg-red-50 p-2 rounded border border-transparent hover:border-red-100 transition" 
                            title="Rejeitar e Excluir"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                          
                          <button 
                            onClick={() => handleApprove(user.id)} 
                            disabled={processingId === user.id}
                            className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow hover:bg-green-700 transition flex items-center gap-1"
                          >
                            {processingId === user.id ? '...' : 'Aprovar'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2 items-center">
                            {(!isAdmin && user.role === 'admin') ? (
                              <span className="text-xs text-gray-400 italic">Protegido</span>
                            ) : (
                              <>
                                <button onClick={() => openEditModal(user)} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded text-sm font-medium transition">Editar</button>
                                <button 
                                    onClick={() => handleDeleteUser(user.id)}
                                    disabled={processingId === user.id}
                                    className="text-red-500 hover:bg-red-50 p-1.5 rounded transition"
                                    title="Excluir Usuário"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </>
                            )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Usuário">
        {editingUser && (
          // CORREÇÃO: onSubmit agora chama handleSaveEdit (nome correto)
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={editingUser.full_name} onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                <input type="text" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={editingUser.unit_number} onChange={e => setEditingUser({ ...editingUser, unit_number: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={editingUser.phone || ''} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Acesso</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={editingUser.role}
                onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
              >
                {ROLES.map(role => (
                  (!isAdmin && role.value === 'admin') ? null : (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  )
                ))}
              </select>
            </div>
            <div className="pt-4 flex gap-3">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={!!processingId} className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-md">{processingId ? 'Salvando...' : 'Salvar Alterações'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}