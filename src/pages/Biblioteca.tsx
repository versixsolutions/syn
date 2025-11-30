// src/pages/Biblioteca.tsx

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCondominios } from '../hooks/useCondominios' // Importar o hook
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'

// Categorias de Documentos (Mantido igual)
const CATEGORIAS_DOCS = [
  { id: 'atas', label: 'Atas de Assembleia', icon: '📝', color: 'bg-blue-100 text-blue-700' },
  { id: 'regimento', label: 'Regimento Interno', icon: '📜', color: 'bg-purple-100 text-purple-700' },
  { id: 'convencao', label: 'Convenção', icon: '⚖️', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'editais', label: 'Editais', icon: '📢', color: 'bg-orange-100 text-orange-700' },
  { id: 'financeiro', label: 'Prestação de Contas', icon: '💰', color: 'bg-green-100 text-green-700' },
  { id: 'contratos', label: 'Contratos', icon: '🤝', color: 'bg-gray-100 text-gray-700' },
  { id: 'outros', label: 'Outros', icon: '📁', color: 'bg-gray-100 text-gray-600' }
]

interface Documento {
  id: number
  title: string
  content: string
  metadata: {
    title: string
    source: string
    url?: string
    category?: string
    is_chunk?: boolean
    file_name?: string
    processed_at?: string
  }
  created_at: string
}

function sanitizeFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase()
}

function splitMarkdownIntoChunks(markdown: string, docTitle: string): string[] {
    const splitRegex = /(?=\n#{1,3}\s+)|(?=\n\*\*\s*Artigo)/;
    const rawChunks = markdown.split(splitRegex);
    const chunks = rawChunks.map(c => c.trim()).filter(c => c.length > 50).map(c => `Documento: ${docTitle}.\n\n${c}`); 
    if (chunks.length === 0) return [markdown];
    return chunks;
}

function getVisualTopics(markdown: string): string[] {
    const lines = markdown.split('\n').map(l => l.trim()).filter(l => l.length > 20 && !l.startsWith('---') && !l.startsWith('Documento:')).filter(l => l.startsWith('#') || l.startsWith('**') || l.match(/^Artigo/i));
    return lines.slice(0, 3);
}

export default function Biblioteca() {
  const { profile, canManage, isAdmin, user } = useAuth()
  const { condominios } = useCondominios()
  const [docs, setDocs] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set())
  
  // Estado para controlar qual condomínio estamos vendo
  const [targetCondominioId, setTargetCondominioId] = useState<string | null>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('atas')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Efeito 1: Inicializa o ID alvo
  useEffect(() => {
    if (profile) {
      if (profile.condominio_id) {
        // Se for morador/síndico, fixa o ID
        setTargetCondominioId(profile.condominio_id)
      } else if (isAdmin) {
        // Se for Admin sem condomínio, para o loading e espera seleção
        setLoading(false)
      }
    }
  }, [profile, isAdmin])

  // Efeito 2: Carrega docs quando o ID alvo muda
  useEffect(() => {
    if (targetCondominioId) {
      loadDocs(targetCondominioId)
    }
  }, [targetCondominioId])

  async function loadDocs(condominioId: string) {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('condominio_id', condominioId) // Usa o ID passado, não o do profile
        .is('metadata->>is_chunk', null) 
        .order('id', { ascending: false })

      if (error) throw error
      setDocs(data || [])
    } catch (error) { 
      console.error('Erro ao carregar documentos:', error) 
      toast.error('Erro ao carregar lista.')
    } finally { 
      setLoading(false) 
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedDocs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const handleUpload = async () => {
    // Verifica se tem um condomínio alvo selecionado
    if (!selectedFile || !targetCondominioId || !canManage || !user) {
      if (!targetCondominioId) toast.error("Selecione um condomínio primeiro.")
      return
    }

    setUploading(true)
    const toastId = toast.loading('Iniciando processamento inteligente...')

    try {
      const docTitle = selectedFile.name.replace('.pdf', '');

      // UPLOAD PARA STORAGE
      toast.loading('Enviando arquivo...', { id: toastId })
      const cleanName = sanitizeFileName(selectedFile.name)
      const fileName = `${targetCondominioId}/${Date.now()}_${cleanName}` // Usa o ID alvo

      const { error: uploadError } = await supabase.storage
        .from('biblioteca')
        .upload(fileName, selectedFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('biblioteca').getPublicUrl(fileName)

      // PROCESSAR COM IA
      toast.loading('IA lendo o arquivo...', { id: toastId })
      
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('condominio_id', targetCondominioId) // Envia o ID alvo
      formData.append('category', uploadCategory)

      const { data: processData, error: processError } = await supabase.functions.invoke('process-document', {
        body: formData,
      })

      if (processError || !processData?.success) {
        throw new Error(processError?.message || processData?.error || 'Falha no processamento IA')
      }

      const textContent = processData.markdown || ''

      // SALVAR NO BANCO
      toast.loading('Salvando metadados...', { id: toastId })

      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          title: docTitle,
          content: textContent,
          condominio_id: targetCondominioId, // ID alvo
          metadata: {
            title: docTitle,
            source: 'upload',
            url: publicUrl,
            category: uploadCategory,
            file_name: selectedFile.name,
            processed_at: new Date().toISOString()
          }
        })

      if (insertError) throw insertError

      toast.success('Documento salvo e indexado!', { id: toastId })
      setIsModalOpen(false)
      setSelectedFile(null)
      loadDocs(targetCondominioId) // Recarrega lista do ID alvo

    } catch (error: any) {
      console.error('Erro upload:', error)
      toast.error(error.message || 'Erro ao processar documento.', { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc: Documento) => {
    if (!confirm(`Deletar "${doc.title}"?`)) return
    try {
      await supabase.from('documents').delete().eq('id', doc.id)
      
      if (doc.metadata?.url) {
        const filePath = doc.metadata.url.split('/').slice(-2).join('/')
        await supabase.storage.from('biblioteca').remove([filePath])
      }
      
      toast.success('Documento deletado')
      if (targetCondominioId) loadDocs(targetCondominioId)
    } catch (error) {
      toast.error('Erro ao deletar')
    }
  }

  // Filtros visuais
  const filteredDocs = docs.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !selectedFilter || doc.metadata?.category === selectedFilter
    return matchesSearch && matchesCategory
  })

  const categoryStats = CATEGORIAS_DOCS.map(cat => ({
    ...cat,
    count: docs.filter(d => d.metadata?.category === cat.id).length
  }))

  return (
    <PageLayout 
      title="Biblioteca Digital" 
      subtitle="Documentos oficiais e base de conhecimento"
    >
      {/* SELETOR DE CONDOMÍNIO (APENAS ADMIN) */}
      {isAdmin && (
        <div className="bg-indigo-900 text-white p-4 rounded-lg mb-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏢</span>
            <div>
              <p className="text-sm font-bold opacity-80 uppercase">Modo Super Admin</p>
              <p className="text-xs opacity-60">Selecione o condomínio para gerenciar os arquivos</p>
            </div>
          </div>
          <select 
            className="bg-indigo-800 border border-indigo-700 text-white rounded px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
            value={targetCondominioId || ''}
            onChange={(e) => setTargetCondominioId(e.target.value)}
          >
            <option value="" disabled>Selecione um condomínio...</option>
            {condominios.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* VIEW PRINCIPAL */}
      {loading ? (
        <LoadingSpinner />
      ) : !targetCondominioId && isAdmin ? (
        <EmptyState 
          icon="👆" 
          title="Selecione um Condomínio" 
          description="Escolha um condomínio na lista acima para visualizar a biblioteca." 
        />
      ) : (
        <>
          {/* Header da Biblioteca */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex-1 w-full">
                <input
                  type="text"
                  placeholder="🔍 Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              
              {canManage && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="whitespace-nowrap px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm"
                >
                  📤 Novo Documento
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedFilter(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!selectedFilter ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Todos ({docs.length})
              </button>
              {categoryStats.map(cat => (
                cat.count > 0 && (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedFilter(cat.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedFilter === cat.id ? `${cat.color} ring-2 ring-current` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {cat.icon} {cat.label} ({cat.count})
                  </button>
                )
              ))}
            </div>
          </div>

          {/* Lista de Documentos */}
          {filteredDocs.length === 0 ? (
            <EmptyState
              icon="📭"
              title={searchTerm ? "Nenhum documento encontrado" : "Biblioteca vazia"}
              description="Nenhum documento foi publicado neste condomínio ainda."
            />
          ) : (
            <div className="space-y-4">
              {filteredDocs.map(doc => {
                const category = CATEGORIAS_DOCS.find(c => c.id === doc.metadata?.category)
                const isExpanded = expandedDocs.has(doc.id)
                const topics = getVisualTopics(doc.content)

                return (
                  <div key={doc.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-3 mb-2">
                            {category && (
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${category.color}`}>
                                {category.icon} {category.label}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-bold text-gray-900 mb-2 truncate">{doc.title}</h3>

                          {topics.length > 0 && (
                            <div className="text-xs text-gray-500 space-y-1 mb-3 bg-gray-50 p-2 rounded border border-gray-100">
                              {topics.map((topic, i) => (
                                <div key={i} className="truncate opacity-80">
                                  • {topic.replace(/^#+\s*/, '').replace(/^\*\*\s*/, '')}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-xs font-medium text-indigo-600">
                            {doc.metadata?.url && (
                              <a href={doc.metadata.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                📥 Baixar PDF
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button onClick={() => toggleExpand(doc.id)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                            {isExpanded ? '🔼' : '🔽'}
                          </button>
                          {canManage && (
                            <button onClick={() => handleDelete(doc)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-6 animate-fade-in">
                        <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: doc.content.replace(/\n/g, '<br/>') }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modal de Upload */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedFile(null); }}
        title={`Novo Documento (${targetCondominioId ? condominios.find(c => c.id === targetCondominioId)?.name : '...' })`}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            💡 Este documento será lido pela IA (Norma) e ficará disponível para dúvidas dos moradores deste condomínio.
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Categoria</label>
            <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
              {CATEGORIAS_DOCS.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Arquivo PDF</label>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
          </div>

          <button onClick={handleUpload} disabled={!selectedFile || uploading} className="w-full py-3 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-md">
            {uploading ? 'Processando e Indexando...' : 'Salvar Documento'}
          </button>
        </div>
      </Modal>
    </PageLayout>
  )
}