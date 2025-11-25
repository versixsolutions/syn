import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/ui/Modal'
import toast from 'react-hot-toast'
import { formatDateTime } from '../../lib/utils'

interface Documento {
  id: number
  title: string
  content: string
  created_at: string
  metadata: {
    category?: string
    source?: string
    url?: string
    is_chunk?: boolean
    parent_id?: number
  }
  embedding?: any 
}

export default function KnowledgeBaseManagement() {
  const [documents, setDocuments] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [docToDelete, setDocToDelete] = useState<Documento | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estados para Seleção Múltipla
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isMassDeleteModalOpen, setIsMassDeleteModalOpen] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [])

  async function loadDocuments() {
    setLoading(true)
    try {
      // Busca documentos ordenados por data de criação
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, content, created_at, metadata, embedding') 
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
      setSelectedIds(new Set())
    } catch (error: any) {
      console.error('Erro ao carregar documentos:', error)
      toast.error('Erro ao carregar base de conhecimento.')
    } finally {
      setLoading(false)
    }
  }

  // --- LÓGICA DE REPROCESSAMENTO MANUAL ---
  const handleReprocess = async (doc: Documento) => {
      const toastId = toast.loading('Reprocessando IA...');
      try {
        // Chama a Edge Function para gerar embedding (agora via Gemini 768)
        const { data, error } = await supabase.functions.invoke('ask-ai', {
            body: { action: 'embed', text: doc.content }
        });

        if (error) throw error;

        if (!data || !data.embedding) {
            throw new Error("A IA não retornou o vetor corretamente.");
        }

        // Salva o embedding no banco
        const { error: updateError } = await supabase
            .from('documents')
            .update({ embedding: data.embedding })
            .eq('id', doc.id);
        
        if (updateError) throw updateError;
        
        // Atualiza lista local visualmente
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, embedding: data.embedding } : d));
        toast.success('IA Atualizada!', { id: toastId });
      } catch (err: any) {
        console.error(err);
        toast.error('Falha ao reprocessar: ' + (err.message || 'Erro desconhecido'), { id: toastId });
      }
  }

  // --- LÓGICA DE SELEÇÃO ---
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDocs.length && filteredDocs.length > 0) {
      setSelectedIds(new Set())
    } else {
      const allIds = new Set(filteredDocs.map(d => d.id))
      setSelectedIds(allIds)
    }
  }

  const toggleSelectOne = (id: number) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  // --- LÓGICA DE EXCLUSÃO ---
  const deleteDocument = async (doc: Documento) => {
      // 1. Tenta excluir do Storage se for um documento pai (tem URL)
      if (doc.metadata?.url && !doc.metadata.is_chunk) {
        const pathRegex = /biblioteca\/(.*)/;
        const match = doc.metadata.url.match(pathRegex);
        
        if (match && match[1]) {
             const storagePath = match[1];
             await supabase.storage.from('biblioteca').remove([storagePath])
        }
      }

      // 2. Excluir do Banco de Dados
      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error
  }

  const handleSingleDelete = async () => {
    if (!docToDelete) return
    setIsDeleting(true)
    const toastId = toast.loading('Excluindo...')

    try {
      await deleteDocument(docToDelete)
      setDocuments(prev => prev.filter(d => d.id !== docToDelete.id))
      toast.success('Documento excluído!', { id: toastId })
      setDocToDelete(null)
    } catch (error: any) {
      toast.error('Erro: ' + error.message, { id: toastId })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMassDelete = async () => {
    setIsDeleting(true)
    const toastId = toast.loading(`Excluindo ${selectedIds.size} itens...`)
    
    try {
      const docsToDelete = documents.filter(d => selectedIds.has(d.id))
      await Promise.all(docsToDelete.map(doc => deleteDocument(doc)))
      
      setDocuments(prev => prev.filter(d => !selectedIds.has(d.id)))
      setSelectedIds(new Set())
      setIsMassDeleteModalOpen(false)
      
      toast.success(`${docsToDelete.length} itens excluídos!`, { id: toastId })
    } catch (error: any) {
      console.error(error)
      toast.error('Erro parcial na exclusão em massa.', { id: toastId })
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtro de busca local
  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Base de Conhecimento (IA)</h1>
          <p className="text-gray-500 text-sm">Gerencie os documentos que a Norma usa para aprender.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
            {selectedIds.size > 0 && (
                <button 
                    onClick={() => setIsMassDeleteModalOpen(true)}
                    className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition flex items-center gap-2 animate-fade-in"
                >
                    <span className="hidden md:inline">Excluir ({selectedIds.size})</span>
                    <span className="md:hidden">🗑️ ({selectedIds.size})</span>
                </button>
            )}

            <div className="relative flex-1 md:w-64">
                <input 
                    type="text" 
                    placeholder="Buscar documento..." 
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Carregando base de dados..." />
      ) : filteredDocs.length === 0 ? (
        <EmptyState 
            icon="🧠" 
            title="Nenhum documento encontrado" 
            description={searchTerm ? "Tente outro termo de busca." : "A base de conhecimento está vazia."} 
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                  <th className="px-4 py-4 w-10 text-center">
                    <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedIds.size === filteredDocs.length && filteredDocs.length > 0}
                        onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-4">Documento</th>
                  <th className="px-4 py-4">Tipo</th>
                  <th className="px-4 py-4 text-center">Status IA</th>
                  <th className="px-4 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className={`hover:bg-gray-50 transition ${selectedIds.has(doc.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-4 text-center">
                        <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedIds.has(doc.id)}
                            onChange={() => toggleSelectOne(doc.id)}
                        />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{doc.metadata?.is_chunk ? '🧩' : '📄'}</span>
                        <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm line-clamp-1" title={doc.title}>{doc.title}</p>
                            <p className="text-xs text-gray-400">{formatDateTime(doc.created_at)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {doc.metadata?.is_chunk ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          Trecho (Chunk)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          Documento Pai
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                        {doc.embedding ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200" title="Processado com sucesso">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Ativo
                            </span>
                        ) : (
                            <button 
                                onClick={() => handleReprocess(doc)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200 hover:bg-orange-100 transition cursor-pointer" 
                                title="Clique para reprocessar a IA deste documento"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span> Pendente ↻
                            </button>
                        )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button 
                        onClick={() => setDocToDelete(doc)}
                        className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition"
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

      {/* MODAL DELETE INDIVIDUAL */}
      <Modal
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        title="Confirmar Exclusão"
      >
        <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 text-3xl">🗑️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Apagar este item?</h3>
            <p className="text-gray-600 text-sm mb-6">"{docToDelete?.title}" será removido permanentemente.</p>
            <div className="flex gap-3 justify-center">
                <button onClick={() => setDocToDelete(null)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleSingleDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{isDeleting ? '...' : 'Excluir'}</button>
            </div>
        </div>
      </Modal>

      {/* MODAL DELETE EM MASSA */}
      <Modal
        isOpen={isMassDeleteModalOpen}
        onClose={() => setIsMassDeleteModalOpen(false)}
        title="Exclusão em Massa"
      >
        <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 text-3xl">⚠️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Apagar {selectedIds.size} itens?</h3>
            <p className="text-gray-600 text-sm mb-6">
                Você selecionou {selectedIds.size} documentos/trechos para exclusão. <br/>
                Essa ação limpará a memória da IA sobre estes tópicos e não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-center">
                <button onClick={() => setIsMassDeleteModalOpen(false)} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={handleMassDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</button>
            </div>
        </div>
      </Modal>
    </div>
  )
}