import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import toast from 'react-hot-toast'

const CATEGORIAS_DOCS = [
  { id: 'atas', label: 'Atas', icon: '📝', color: 'bg-blue-100 text-blue-700' },
  { id: 'regimento', label: 'Regimento', icon: '📜', color: 'bg-purple-100 text-purple-700' },
  { id: 'convencao', label: 'Convenção', icon: '⚖️', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'financeiro', label: 'Financeiro', icon: '💰', color: 'bg-green-100 text-green-700' },
  { id: 'outros', label: 'Outros', icon: '📁', color: 'bg-gray-100 text-gray-600' }
]

export default function Biblioteca() {
  const { profile, canManage } = useAuth()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('regimento')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile?.condominio_id) loadDocs()
  }, [profile?.condominio_id])

  async function loadDocs() {
    try {
      // Agora buscamos da tabela simples 'library_files'
      const { data, error } = await supabase
        .from('library_files')
        .select('*')
        .eq('condominio_id', profile?.condominio_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocs(data || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  const handleUpload = async () => {
    if (!selectedFile || !profile) return
    setUploading(true)
    const toastId = toast.loading('Iniciando pipeline RAG...')

    try {
      const fileName = `${profile.condominio_id}/${Date.now()}_${selectedFile.name}`
      
      // 1. Upload Storage (Backup)
      toast.loading('Enviando arquivo...', { id: toastId })
      const { error: upError } = await supabase.storage.from('biblioteca').upload(fileName, selectedFile)
      if (upError) throw upError
      const { data: { publicUrl } } = supabase.storage.from('biblioteca').getPublicUrl(fileName)

      // 2. Processamento Inteligente (LlamaParse + Qdrant)
      toast.loading('Norma Lendo (LlamaParse)...', { id: toastId })
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('condominio_id', profile.condominio_id)
      formData.append('category', uploadCategory)
      formData.append('file_url', publicUrl)

      const { data, error } = await supabase.functions.invoke('process-document', {
        body: formData
      })

      if (error) throw error
      
      toast.success(`Sucesso! ${data.chunks} tópicos aprendidos.`, { id: toastId })
      setIsModalOpen(false)
      setSelectedFile(null)
      loadDocs()

    } catch (error: any) {
      console.error(error)
      toast.error('Erro: ' + error.message, { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <PageLayout title="Biblioteca Digital" subtitle="Arquivos & Inteligência" icon="📚"
      headerAction={canManage ? <button onClick={() => setIsModalOpen(true)} className="bg-white/20 text-white px-4 py-2 rounded-lg font-bold text-sm">+ Novo</button> : null}>
      
      {docs.length === 0 ? <EmptyState icon="📭" title="Vazio" description="Nenhum documento indexado." /> : (
        <div className="grid gap-4">
          {docs.map(doc => (
            <div key={doc.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase mb-1 block">{doc.category}</span>
                <h3 className="font-bold text-gray-900">{doc.title}</h3>
                <a href={doc.file_url} target="_blank" className="text-xs text-gray-500 underline mt-1 block">Ver PDF Original</a>
              </div>
              <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                Indexado no Qdrant
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Documento (RAG Pipeline)">
            <div className="space-y-4">
                <p className="text-xs text-gray-500 bg-gray-100 p-2 rounded">Pipeline: PDF &rarr; LlamaParse &rarr; Qdrant &rarr; Groq</p>
                <select className="w-full border p-2 rounded" value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}>
                    {CATEGORIAS_DOCS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <input type="file" accept=".pdf" className="w-full" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                <button onClick={handleUpload} disabled={uploading || !selectedFile} className="w-full bg-primary text-white py-3 rounded-lg font-bold disabled:opacity-50">
                    {uploading ? 'Processando...' : 'Enviar'}
                </button>
            </div>
        </Modal>
      )}
    </PageLayout>
  )
}