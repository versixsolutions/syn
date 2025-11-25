import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import Modal from '../components/ui/Modal' // <--- IMPORTAÇÃO QUE FALTAVA
import toast from 'react-hot-toast'

// Categorias de Documentos
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
  }
  created_at: string
}

// Função para limpar nomes de arquivos
function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')               
    .replace(/[\u0300-\u036f]/g, '') 
    .replace(/\s+/g, '_')           
    .replace(/[^a-zA-Z0-9._-]/g, '') 
    .toLowerCase()
}

// Função de fragmentação de Markdown para visualização e IA
function splitMarkdownIntoChunks(markdown: string, docTitle: string): string[] {
    const splitRegex = /(?=\n#{1,3}\s+)|(?=\n\*\*\s*Artigo)/;
    const rawChunks = markdown.split(splitRegex);
    const chunks = rawChunks
        .map(c => c.trim())
        .filter(c => c.length > 50)
        .map(c => `Documento: ${docTitle}.\n\n${c}`); 
    if (chunks.length === 0) return [markdown];
    return chunks;
}

// Helper para extrair tópicos visuais do Markdown
function getVisualTopics(markdown: string): string[] {
    const lines = markdown.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 20 && !l.startsWith('---') && !l.startsWith('Documento:'))
        .filter(l => l.startsWith('#') || l.startsWith('**') || l.match(/^Artigo/i));
    return lines.slice(0, 3);
}

export default function Biblioteca() {
  const { profile, canManage, user } = useAuth()
  const [docs, setDocs] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set())
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('atas')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile?.condominio_id) {
      loadDocs()
    }
  }, [profile?.condominio_id])

  async function loadDocs() {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('condominio_id', profile?.condominio_id)
        .is('metadata->>is_chunk', null) 
        .order('id', { ascending: false })

      if (error) throw error
      setDocs(data || [])
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }

  const toggleExpand = (id: number) => {
    setExpandedDocs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleUpload = async () => {
    if (!selectedFile || !profile?.condominio_id || !canManage || !user) return

    setUploading(true)
    const toastId = toast.loading('Iniciando processamento inteligente...')

    try {
      const categoryLabel = CATEGORIAS_DOCS.find(c => c.id === uploadCategory)?.label || 'Documento'
      const docTitle = selectedFile.name.replace('.pdf', '');

      toast.loading('Enviando arquivo para o cofre...', { id: toastId })
      const cleanName = sanitizeFileName(selectedFile.name)
      const fileName = `${profile.condominio_id}/${Date.now()}_${cleanName}`

      const { error: uploadError } = await supabase.storage
        .from('biblioteca')
        .upload(fileName, selectedFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('biblioteca')
        .getPublicUrl(fileName)

      toast.loading('Norma está lendo e estruturando o documento...', { id: toastId })
      
      const formData = new FormData();
      formData.append('file', selectedFile);

      const { data: processData, error: processError } = await supabase.functions.invoke('process-document', {
        body: formData,
      })

      if (processError) throw processError;
      
      const textContent = processData.markdown;

      if (!textContent || textContent.length < 50) {
         throw new Error('O sistema não conseguiu extrair texto suficiente deste PDF.');
      }

      toast.loading('Gerando inteligência (Embeddings)...', { id: toastId })
      
      const chunks = splitMarkdownIntoChunks(textContent, docTitle); 

      const parentDoc = {
        title: docTitle,
        content: textContent, 
        tags: `${categoryLabel.toLowerCase()} ${uploadCategory} pdf llamaparse`,
        condominio_id: profile.condominio_id,
        metadata: {
          title: selectedFile.name,
          source: categoryLabel,
          category: uploadCategory,
          url: publicUrl,
          parser: 'llamaparse'
        }
      }

      const { data: parentData, error: parentError } = await supabase
        .from('documents')
        .insert(parentDoc)
        .select()
        .single()

      if (parentError) throw parentError
      
      const chunkSize = 3; 
      let processed = 0;

      for (let i = 0; i < chunks.length; i += chunkSize) {
        const batch = chunks.slice(i, i + chunkSize);
        const promises = batch.map(async (chunkText) => {
           const { data: embedData, error: embedError } = await supabase.functions.invoke('ask-ai', {
             body: { action: 'embed', text: chunkText }
           })
           
           if (embedError) throw embedError
           const embedding = embedData.embedding;
           
           return {
             title: `${docTitle} (Trecho)`,
             content: chunkText,
             embedding: embedding, 
             tags: `chunk ia_context ${uploadCategory}`,
             condominio_id: profile.condominio_id,
             metadata: {
               source: categoryLabel,
               category: uploadCategory,
               is_chunk: true, 
               parent_id: parentData.id 
             }
           }
        });

        const records = await Promise.all(promises);
        const { error: chunkError } = await supabase.from('documents').insert(records);
        if (chunkError) console.error('Erro ao salvar chunks:', chunkError);
        
        processed += batch.length;
        toast.loading(`Indexando conhecimento: ${processed}/${chunks.length} tópicos...`, { id: toastId });
      }

      await supabase.from('comunicados').insert({
        title: `Novo Documento: ${docTitle}`,
        content: `Um novo arquivo foi adicionado à Biblioteca Digital na categoria **${categoryLabel}**. \n\nA Norma já aprendeu o conteúdo e está pronta para tirar dúvidas.`,
        type: 'informativo', 
        priority: 1,
        author_id: user?.id,
        condominio_id: profile?.condominio_id
      })

      toast.success('Documento salvo e aprendido pela Norma!', { id: toastId })
      setIsModalOpen(false)
      setSelectedFile(null)
      loadDocs()

    } catch (error: any) {
      console.error(error)
      toast.error('Erro: ' + (error.message || 'Falha no processamento'), { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  const filteredDocs = docs.filter(d => {
    const matchesSearch = d.content.toLowerCase().includes(searchTerm.toLowerCase()) || d.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedFilter ? d.metadata?.category === selectedFilter : true
    return matchesSearch && matchesCategory
  })

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0])
  }

  if (loading) return <LoadingSpinner message="Carregando biblioteca..." />

  return (
    <PageLayout 
      title="Biblioteca Digital" 
      subtitle="Acervo de documentos oficiais" 
      icon="📚"
      headerAction={
        canManage ? (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-bold hover:bg-white/30 transition text-sm flex items-center gap-2 border border-white/30"
          >
            <span className="text-lg">+</span> Novo Documento
          </button>
        ) : null
      }
    >
      <div className="mb-6 space-y-4">
        <div className="relative">
          <input type="text" placeholder="Buscar nos documentos..." className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setSelectedFilter(null)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition shrink-0 ${!selectedFilter ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Todos</button>
          {CATEGORIAS_DOCS.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedFilter(cat.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition shrink-0 flex items-center gap-1 ${selectedFilter === cat.id ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 hover:bg-gray-50'}`}><span>{cat.icon}</span> {cat.label}</button>
          ))}
        </div>
      </div>

      {filteredDocs.length > 0 ? (
        <div className="grid gap-4">
          {filteredDocs.map((doc) => {
            const category = CATEGORIAS_DOCS.find(c => c.id === doc.metadata?.category) || CATEGORIAS_DOCS[6]
            const isExpanded = expandedDocs.has(doc.id)
            const topics = getVisualTopics(doc.content);
            const cleanTopics = topics.length > 0 ? topics : [doc.content.slice(0, 100).replace(/\s+/g, ' ') + '...'];

            return (
              <div key={doc.id} className={`bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-primary transition-all duration-300 group relative overflow-hidden ${isExpanded ? 'ring-2 ring-primary ring-opacity-50' : ''}`}>
                
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${category.color}`}>
                      {category.icon} {category.label}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-1">{doc.title || doc.metadata?.title}</h3>
                
                <div className={`relative transition-all duration-300`}>
                  
                  {isExpanded ? (
                    <div className="animate-fade-in">
                       <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-4 max-h-96 overflow-y-auto custom-scrollbar">
                         <p className="text-sm text-gray-700 leading-relaxed font-sans whitespace-pre-line">
                           {doc.content}
                         </p>
                       </div>
                       
                       {doc.metadata?.url && (
                          <a 
                            href={doc.metadata.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-full flex items-center justify-center gap-2 bg-primary text-white px-4 py-3 rounded-lg text-sm font-bold hover:bg-primary-dark transition shadow-md mb-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Abrir Documento PDF Original
                          </a>
                       )}
                    </div>
                  ) : (
                    <div className="mb-2">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wide">Principais Tópicos:</p>
                      <ul className="space-y-2">
                        {cleanTopics.map((topic, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="text-primary font-bold mt-0.5">•</span>
                            <span className="line-clamp-2 font-medium">{topic.replace(/^#+\s*/, '').replace(/\*\*/g, '')}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                    </div>
                  )}

                </div>

                <button 
                  onClick={() => toggleExpand(doc.id)}
                  className="w-full py-2 mt-3 text-xs font-bold text-primary uppercase tracking-wider border border-primary/20 rounded-lg hover:bg-primary/5 transition flex items-center justify-center gap-2"
                >
                  {isExpanded ? (
                    <>Recolher <svg className="w-3 h-3 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></>
                  ) : (
                    <>Leia Mais & Acessar PDF <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></>
                  )}
                </button>

              </div>
            )
          })}
        </div>
      ) : (<EmptyState icon="📭" title="Nenhum documento" description="A biblioteca está vazia." />)}

      {/* Modal de Upload */}
      {isModalOpen && (
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Documento Inteligente">
            <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded text-blue-800 text-xs">Este documento será lido e a Norma aprenderá o conteúdo automaticamente.</div>
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