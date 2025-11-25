import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
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
    // Divide por cabeçalhos Markdown (#, ##, ###) ou quebras duplas fortes
    // Isso ajuda a separar Artigos e Capítulos
    const splitRegex = /(?=\n#{1,3}\s+)|(?=\n\*\*\s*Artigo)/;
    
    const rawChunks = markdown.split(splitRegex);
    
    const chunks = rawChunks
        .map(c => c.trim())
        .filter(c => c.length > 50) // Filtra ruídos muito curtos
        .map(c => `Documento: ${docTitle}.\n\n${c}`); // Adiciona contexto para a IA

    if (chunks.length === 0) return [markdown]; // Fallback se não conseguir dividir
    return chunks;
}

// Helper para extrair tópicos visuais do Markdown (para o resumo do card)
function getVisualTopics(markdown: string): string[] {
    // Tenta pegar linhas que parecem títulos ou inícios de parágrafos importantes
    const lines = markdown.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 20 && !l.startsWith('---') && !l.startsWith('Documento:'))
        .filter(l => l.startsWith('#') || l.startsWith('**') || l.match(/^Artigo/i));
    
    return lines.slice(0, 3); // Retorna os 3 primeiros "tópicos" encontrados
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
        // Filtra para mostrar apenas documentos "pai" (não os chunks da IA)
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

      // 1. Upload do Arquivo para o Storage
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

      // 2. Extração Inteligente e Estruturada via LlamaParse (Edge Function)
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

      // 3. Fragmentação e Geração de Inteligência (Embeddings via Gemini)
      toast.loading('Gerando inteligência (Embeddings)...', { id: toastId })
      
      const chunks = splitMarkdownIntoChunks(textContent, docTitle); 

      // Inserir Documento Pai (Para exibição na lista)
      const parentDoc = {
        title: docTitle,
        content: textContent, // Markdown completo
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
      
      // Processar Chunks via Edge Function (ask-ai -> Embed)
      // Fazemos em lotes para não sobrecarregar
      const chunkSize = 3; 
      let processed = 0;

      for (let i = 0; i < chunks.length; i += chunkSize) {
        const batch = chunks.slice(i, i + chunkSize);
        const promises = batch.map(async (chunkText) => {
           // Chama a Edge Function 'ask-ai' com a ação 'embed' para usar o modelo do Gemini
           const { data: embedData, error: embedError } = await supabase.functions.invoke('ask-ai', {
             body: { action: 'embed', text: chunkText }
           })
           
           if (embedError) throw embedError
           const embedding = embedData.embedding;
           
           return {
             title: `${docTitle} (Trecho)`,
             content: chunkText,
             embedding: embedding, // Vetor de 768 dimensões
             tags: `chunk ia_context ${uploadCategory}`,
             condominio_id: profile.condominio_id,
             metadata: {
               source: categoryLabel,
               category: uploadCategory,
               is_chunk: true, // Marca como chunk oculto
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

      // 4. Criar Comunicado Automático
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
            
            // Gera tópicos visuais a partir do Markdown
            const topics = getVisualTopics(doc.content);
            const cleanTopics = topics.length > 0 ? topics : [doc.content.slice(0, 100).replace(/\s+/g, ' ') + '...'];

            return (
              <div key={doc.id} className={`bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:border-primary transition group relative overflow-hidden ${isExpanded ? 'ring-2 ring-primary ring-opacity-50' : ''}`}>
                
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
                    // --- MODO EXPANDIDO ---
                    <div className="animate-fade-in">
                       <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-4 max-h-96 overflow-y-auto custom-scrollbar">
                         <p className="text-sm text-gray-700 leading-relaxed font-sans whitespace-pre-line">
                           {/* Exibe o conteúdo. O Markdown pode conter caracteres especiais, 
                               então renderizamos como texto simples, mas preservando quebras */}
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
                    // --- MODO RESUMO (TÓPICOS) ---
                    <div className="mb-2">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wide">Resumo do conteúdo:</p>
                      <ul className="space-y-2">
                        {cleanTopics.map((topic, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="text-primary font-bold mt-0.5">•</span>
                            <span className="line-clamp-2 font-medium">{topic.replace(/^#+\s*/, '').replace(/\*\*/g, '')}</span>
                          </li>
                        ))}
                      </ul>
                      {/* Gradiente sutil */}
                      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                    </div>
                  )}

                </div>

                {/* Botão Toggle */}
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

      {canManage && isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900">Adicionar Documento</h3><button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-100 p-3 rounded-lg"><p className="text-xs text-purple-700 font-medium flex items-start gap-2"><span className="text-base">🤖</span>O conteúdo será estruturado e indexado para a Norma aprender.</p></div>
                
                <div><label className="block text-sm font-bold text-gray-700 mb-2">Categoria</label><div className="grid grid-cols-2 gap-2">{CATEGORIAS_DOCS.map((cat) => (<button key={cat.id} onClick={() => setUploadCategory(cat.id)} className={`text-xs font-semibold py-2 px-3 rounded-lg border text-left flex items-center gap-2 transition ${uploadCategory === cat.id ? `${cat.color} border-current ring-1 ring-current` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><span>{cat.icon}</span> {cat.label}</button>))}</div></div>
                
                <div><label className="block text-sm font-bold text-gray-700 mb-2">Arquivo PDF</label><input type="file" accept=".pdf" ref={fileInputRef} className="hidden" onChange={onFileSelect} /><div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-primary hover:bg-gray-50'}`}>{selectedFile ? (<div className="text-green-700"><div className="text-2xl mb-1">📄</div><p className="font-bold text-sm truncate">{selectedFile.name}</p></div>) : (<div className="text-gray-500"><div className="text-2xl mb-1">📤</div><p className="font-medium text-sm">Clique para selecionar PDF</p></div>)}</div></div>
                
                <button onClick={handleUpload} disabled={!selectedFile || uploading} className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition disabled:opacity-50">{uploading ? 'Processando...' : 'Enviar e Ensinar Norma'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}