import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdmin } from '../../contexts/AdminContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/ui/Modal'
import toast from 'react-hot-toast'

interface Ad {
  id: string
  title: string
  image_url: string
  link_url: string
  active: boolean
  views: number
  clicks: number
}

export default function MarketplaceManagement() {
  const { selectedCondominioId } = useAdmin() // Contexto Global (se quiser filtrar por condomínio no futuro)
  
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Form
  const [title, setTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadAds()
  }, [])

  async function loadAds() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('marketplace_ads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAds(data || [])
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(ad: Ad) {
    try {
      const { error } = await supabase
        .from('marketplace_ads')
        .update({ active: !ad.active })
        .eq('id', ad.id)

      if (error) throw error
      setAds(prev => prev.map(a => a.id === ad.id ? { ...a, active: !a.active } : a))
      toast.success(`Anúncio ${!ad.active ? 'ativado' : 'desativado'}!`)
    } catch (error) {
      toast.error('Erro ao atualizar status.')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este anúncio?')) return
    try {
      await supabase.from('marketplace_ads').delete().eq('id', id)
      setAds(prev => prev.filter(a => a.id !== id))
      toast.success('Anúncio excluído.')
    } catch (error) {
      toast.error('Erro ao excluir.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile || !title) {
      toast.error('Preencha o título e selecione uma imagem.')
      return
    }

    setUploading(true)
    try {
      // 1. Upload Imagem
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('marketplace')
        .upload(fileName, selectedFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('marketplace')
        .getPublicUrl(fileName)

      // 2. Salvar no Banco
      const { error: dbError } = await supabase.from('marketplace_ads').insert({
        title,
        link_url: linkUrl,
        image_url: publicUrl,
        active: true,
        created_by: (await supabase.auth.getUser()).data.user?.id
      })

      if (dbError) throw dbError

      toast.success('Banner publicado com sucesso!')
      setIsModalOpen(false)
      setTitle('')
      setLinkUrl('')
      setSelectedFile(null)
      loadAds()

    } catch (error: any) {
      console.error(error)
      toast.error('Erro ao publicar: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Marketplace</h1>
          <p className="text-gray-500 text-sm">Gerencie os banners publicitários do app.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <span>📢</span> Novo Banner
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : ads.length === 0 ? (
        <EmptyState icon="🖼️" title="Sem anúncios" description="Nenhum banner ativo no momento." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => (
            <div key={ad.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden group ${ad.active ? 'border-gray-200' : 'border-red-200 opacity-75'}`}>
              <div className="relative h-32 bg-gray-100">
                <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                {!ad.active && (
                  <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-sm">
                    <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded uppercase">Inativo</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 truncate">{ad.title}</h3>
                <a href={ad.link_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline truncate block mb-3">
                  {ad.link_url || 'Sem link'}
                </a>
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>👁️ {ad.views} visualizações</span>
                  <span>👆 {ad.clicks} cliques</span>
                </div>

                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <button 
                    onClick={() => handleToggleActive(ad)}
                    className={`flex-1 py-1.5 rounded text-xs font-bold border transition ${ad.active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                  >
                    {ad.active ? 'Pausar' : 'Ativar'}
                  </button>
                  <button 
                    onClick={() => handleDelete(ad.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-gray-50"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Banner Publicitário">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-xs text-indigo-800">
             ℹ️ Tamanho recomendado: <strong>800x300px</strong> (formato paisagem).
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Título da Campanha</label>
            <input type="text" required className="w-full px-3 py-2 border rounded-lg" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Promoção Pizzaria" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Link de Destino (Opcional)</label>
            <input type="url" className="w-full px-3 py-2 border rounded-lg" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Imagem do Banner</label>
            <input ref={fileInputRef} type="file" accept="image/*" required onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
          </div>

          <button type="submit" disabled={uploading} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">
            {uploading ? 'Enviando...' : 'Publicar Banner'}
          </button>
        </form>
      </Modal>
    </div>
  )
}