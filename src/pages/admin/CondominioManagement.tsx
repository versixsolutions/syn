import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/ui/Modal'
import toast from 'react-hot-toast'

// Interface completa do Condomínio
interface Condominio {
  id: string
  name: string
  slug: string
  created_at: string
  theme_config: {
    colors: {
      primary: string
      secondary: string
    }
    branding: {
      logoUrl: string
    }
    modules: {
      faq: boolean
      reservas: boolean
      ocorrencias: boolean
      votacoes: boolean
      financeiro: boolean
    }
    structure: {
      totalUnits: number
      blocks: string[] // Lista de Blocos/Ruas
    }
    cadastro: {
      cnpj: string
      razaoSocial: string
      address: string
      city: string
      state: string
      contact: {
        email: string
        phone: string
      }
      location: {
        plusCode: string
      }
    }
  }
}

// Estado inicial do formulário
const INITIAL_FORM = {
  // 1. Cadastrais
  name: '',
  razaoSocial: '',
  cnpj: '',
  slug: '',
  address: '',
  city: '',
  state: '',
  email: '',
  phone: '',
  
  // 1.1 Localização
  plusCode: '', 
  
  // 2. Identidade Visual
  primaryColor: '#1F4080',
  secondaryColor: '#00A86B',
  logoUrl: '',
  
  // 3. Estrutura
  totalUnits: '',
  blocks: [] as string[], 
  
  // 4. Módulos
  modules: {
    faq: true,
    reservas: false,
    ocorrencias: true,
    votacoes: true,
    financeiro: true
  }
}

export default function CondominioManagement() {
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Estados para o CRUD de Blocos
  const [newBlockInput, setNewBlockInput] = useState('')
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null)
  const blockInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCondominios()
  }, [])

  async function loadCondominios() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('condominios')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCondominios(data || [])
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao carregar condomínios')
    } finally {
      setLoading(false)
    }
  }

  // --- CRUD DE BLOCOS / RUAS ---
  
  const handleAddOrUpdateBlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    const val = newBlockInput.trim()
    if (!val) return

    // MODO EDIÇÃO (UPDATE)
    if (editingBlockIndex !== null) {
      // Verifica duplicidade (excluindo o próprio item que está sendo editado)
      if (formData.blocks.some((b, idx) => b.toLowerCase() === val.toLowerCase() && idx !== editingBlockIndex)) {
        toast.error('Este nome já existe na lista.')
        return
      }

      setFormData(prev => {
        const newBlocks = [...prev.blocks]
        newBlocks[editingBlockIndex] = val
        return { ...prev, blocks: newBlocks }
      })
      
      toast.success('Item atualizado!')
      setEditingBlockIndex(null)
    } 
    // MODO CRIAÇÃO (CREATE)
    else {
      if (formData.blocks.some(b => b.toLowerCase() === val.toLowerCase())) {
        toast.error('Este bloco/rua já foi adicionado.')
        return
      }

      setFormData(prev => ({
        ...prev,
        blocks: [...prev.blocks, val]
      }))
      toast.success('Adicionado!')
    }

    setNewBlockInput('')
    // Mantém o foco no input para digitação rápida
    setTimeout(() => blockInputRef.current?.focus(), 0)
  }

  const handleEditBlock = (index: number) => {
    setNewBlockInput(formData.blocks[index])
    setEditingBlockIndex(index)
    blockInputRef.current?.focus()
  }

  const handleCancelEditBlock = () => {
    setNewBlockInput('')
    setEditingBlockIndex(null)
  }

  const handleRemoveBlock = (indexToRemove: number) => {
    // Se estiver editando o item que vai ser removido, cancela a edição
    if (editingBlockIndex === indexToRemove) {
        handleCancelEditBlock()
    } else if (editingBlockIndex !== null && indexToRemove < editingBlockIndex) {
        // Ajusta o índice se remover um item anterior ao que está sendo editado
        setEditingBlockIndex(editingBlockIndex - 1)
    }

    setFormData(prev => ({
      ...prev,
      blocks: prev.blocks.filter((_, index) => index !== indexToRemove)
    }))
  }

  // --- BUSCA CNPJ VIA BRASILAPI ---
  const handleCnpjSearch = async () => {
    const cleanCnpj = formData.cnpj.replace(/\D/g, '')
    
    if (cleanCnpj.length !== 14) {
      toast.error('CNPJ inválido. Digite apenas números (14 dígitos).')
      return
    }

    setIsSearchingCnpj(true)
    const toastId = toast.loading('Consultando Receita Federal...')

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`)
      
      if (!response.ok) {
        if (response.status === 404) throw new Error('CNPJ não encontrado.')
        if (response.status === 429) throw new Error('Muitas requisições. Tente novamente em instantes.')
        throw new Error('Erro ao consultar CNPJ.')
      }

      const data = await response.json()

      const addressSimple = `${data.logradouro}, ${data.numero}`
      const addressFull = `${addressSimple}, ${data.bairro}, ${data.municipio} - ${data.uf}`
      const displayName = data.nome_fantasia || data.razao_social
      
      const suggestedSlug = displayName
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, '')

      setFormData(prev => ({
        ...prev,
        razaoSocial: data.razao_social,
        name: displayName,
        address: addressFull,
        city: data.municipio,
        state: data.uf,
        email: data.email || '',
        phone: data.ddd_telefone_1 || '',
        slug: !prev.slug ? suggestedSlug : prev.slug,
      }))

      toast.success('Dados preenchidos! Verifique o Plus Code manualmente.', { id: toastId })

    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Falha na consulta', { id: toastId })
    } finally {
      setIsSearchingCnpj(false)
    }
  }

  const handleOpenNew = () => {
    setFormData(INITIAL_FORM)
    setNewBlockInput('')
    setEditingBlockIndex(null)
    setEditingId(null)
    setIsModalOpen(true)
  }

  const handleEdit = (cond: Condominio) => {
    const config = cond.theme_config || {}
    const cadastro = config.cadastro || {}
    const contact = cadastro.contact || {}
    const location = cadastro.location || {}
    const colors = config.colors || {}
    const branding = config.branding || {}
    const structure = config.structure || {}
    const modules = config.modules || {}

    setFormData({
      name: cond.name,
      slug: cond.slug,
      razaoSocial: cadastro.razaoSocial || '',
      cnpj: cadastro.cnpj || '',
      address: cadastro.address || '',
      city: cadastro.city || '',
      state: cadastro.state || '',
      email: contact.email || '',
      phone: contact.phone || '',
      plusCode: location.plusCode || '',
      
      primaryColor: colors.primary || '#1F4080',
      secondaryColor: colors.secondary || '#00A86B',
      logoUrl: branding.logoUrl || '',
      
      totalUnits: structure.totalUnits?.toString() || '',
      blocks: Array.isArray(structure.blocks) ? structure.blocks : [], 
      
      modules: {
        faq: modules.faq ?? true,
        reservas: modules.reservas ?? false,
        ocorrencias: modules.ocorrencias ?? true,
        votacoes: modules.votacoes ?? true,
        financeiro: modules.financeiro ?? true
      }
    })
    
    setNewBlockInput('')
    setEditingBlockIndex(null)
    setEditingId(cond.id)
    setIsModalOpen(true)
  }

  const handleAccess = (slug: string) => {
    const url = `/login?slug=${slug}`
    window.open(url, '_blank')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const toastId = toast.loading(editingId ? 'Atualizando...' : 'Criando condomínio...')

    try {
      const themeConfig = {
        colors: {
          primary: formData.primaryColor,
          secondary: formData.secondaryColor
        },
        branding: {
          logoUrl: formData.logoUrl || '/assets/logos/versix-solutions-logo.png',
        },
        modules: formData.modules,
        structure: {
          totalUnits: parseInt(formData.totalUnits) || 0,
          blocks: formData.blocks // Array de strings
        },
        cadastro: {
          cnpj: formData.cnpj,
          razaoSocial: formData.razaoSocial,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          contact: {
            email: formData.email,
            phone: formData.phone
          },
          location: {
            plusCode: formData.plusCode
          }
        }
      }

      if (editingId) {
        const { error } = await supabase
          .from('condominios')
          .update({
            name: formData.name,
            slug: formData.slug,
            theme_config: themeConfig
          })
          .eq('id', editingId)

        if (error) throw error
        toast.success('Condomínio atualizado!', { id: toastId })
      } else {
        const { error } = await supabase.from('condominios').insert({
          name: formData.name,
          slug: formData.slug,
          theme_config: themeConfig
        })

        if (error) throw error
        toast.success('Condomínio criado com sucesso!', { id: toastId })
      }

      setIsModalOpen(false)
      setFormData(INITIAL_FORM)
      setEditingId(null)
      
      loadCondominios()

    } catch (error: any) {
      console.error(error)
      toast.error('Erro: ' + error.message, { id: toastId })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Condomínios</h1>
          <p className="text-gray-500 text-sm">Gerencie os clientes e tenants do sistema.</p>
        </div>
        <button
          onClick={handleOpenNew}
          className="bg-primary text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-primary-dark transition flex items-center gap-2"
        >
          <span>+</span> Novo Condomínio
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : condominios.length === 0 ? (
        <EmptyState icon="🏢" title="Nenhum condomínio" description="Cadastre o primeiro cliente para começar." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {condominios.map((cond) => (
            <div key={cond.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition group flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                    🏢
                  </div>
                  <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded border border-blue-100">
                    {cond.slug}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-1 truncate" title={cond.name}>{cond.name}</h3>
                <p className="text-xs text-gray-500 mb-4 line-clamp-2" title={cond.theme_config?.cadastro?.address}>
                  {cond.theme_config?.cadastro?.address || 'Endereço não informado'}
                </p>
                
                {cond.theme_config?.cadastro?.location?.plusCode && (
                  <div className="mb-4 bg-blue-50 p-2 rounded text-center">
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cond.theme_config.cadastro.location.plusCode)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-700 font-mono hover:underline flex items-center justify-center gap-1"
                    >
                      📍 {cond.theme_config.cadastro.location.plusCode}
                    </a>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 border-t border-gray-100 pt-3 mt-auto">
                <button 
                  onClick={() => handleEdit(cond)}
                  className="flex-1 text-xs font-bold text-gray-600 hover:bg-gray-50 py-2 rounded transition border border-gray-200"
                >
                  Editar
                </button>
                <button 
                  onClick={() => handleAccess(cond.slug)}
                  className="flex-1 text-xs font-bold text-blue-600 hover:bg-blue-50 py-2 rounded transition border border-blue-100"
                >
                  Acessar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO/EDIÇÃO */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Editar Condomínio" : "Novo Condomínio"}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION 1: DADOS BÁSICOS */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-blue-900 text-sm">1. Dados Cadastrais</h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">CNPJ (apenas números)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={formData.cnpj} 
                    onChange={e => setFormData({...formData, cnpj: e.target.value})} 
                    placeholder="00000000000191"
                    maxLength={18}
                  />
                  <button
                    type="button"
                    onClick={handleCnpjSearch}
                    disabled={isSearchingCnpj || !formData.cnpj}
                    className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSearchingCnpj ? '...' : '🔍 Buscar'}
                  </button>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Razão Social</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={formData.razaoSocial} onChange={e => setFormData({...formData, razaoSocial: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Nome Fantasia (Exibição)</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-lg text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Pinheiro Park" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Slug (URL)</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-mono" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s/g, '')})} placeholder="ex: versix" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Telefone</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Endereço Completo</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              
              <div className="col-span-2 bg-white p-3 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1">
                  Google Plus Code 
                  <a href="https://plus.codes/map" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-[10px] font-normal ml-1">(Onde encontrar?)</a>
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono uppercase placeholder-gray-300" 
                    value={formData.plusCode} 
                    onChange={e => setFormData({...formData, plusCode: e.target.value.toUpperCase()})} 
                    placeholder="Ex: 87Q3+22 Teresina, PI" 
                  />
                  {formData.plusCode && (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.plusCode)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 flex items-center justify-center border border-gray-300"
                      title="Testar Link"
                    >
                      📍
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: VISUAL */}
          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-3">2. Identidade Visual</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Cor Primária</label>
                <div className="flex gap-2">
                  <input type="color" className="h-9 w-9 rounded cursor-pointer border border-gray-200 p-1" value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                  <input type="text" className="flex-1 px-3 py-2 border rounded-lg text-sm uppercase font-mono" value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Cor Secundária</label>
                <div className="flex gap-2">
                  <input type="color" className="h-9 w-9 rounded cursor-pointer border border-gray-200 p-1" value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                  <input type="text" className="flex-1 px-3 py-2 border rounded-lg text-sm uppercase font-mono" value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Logo URL</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://..." value={formData.logoUrl} onChange={e => setFormData({...formData, logoUrl: e.target.value})} />
              </div>
            </div>
          </div>

          {/* SECTION 3: ESTRUTURA & MÓDULOS */}
          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-3">3. Configuração</h4>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Total Unidades</label>
                <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={formData.totalUnits} onChange={e => setFormData({...formData, totalUnits: e.target.value})} />
              </div>
              
              {/* GERENCIADOR CRUD DE BLOCOS / RUAS */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-gray-600 mb-2">Cadastro de Blocos / Ruas</label>
                
                {/* FORMULÁRIO DE ADIÇÃO/EDIÇÃO */}
                <div className="flex gap-2 mb-3">
                  <input 
                    ref={blockInputRef}
                    type="text" 
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${editingBlockIndex !== null ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}`}
                    placeholder="Ex: Bloco A ou Rua 1" 
                    value={newBlockInput}
                    onChange={e => setNewBlockInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddOrUpdateBlock(e) }}
                  />
                  <button 
                    type="button" 
                    onClick={handleAddOrUpdateBlock}
                    disabled={!newBlockInput.trim()}
                    className={`text-white text-xs font-bold px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed
                      ${editingBlockIndex !== null ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
                    `}
                  >
                    {editingBlockIndex !== null ? 'Atualizar' : 'Adicionar'}
                  </button>
                  
                  {editingBlockIndex !== null && (
                    <button 
                      type="button"
                      onClick={handleCancelEditBlock}
                      className="bg-gray-200 text-gray-600 text-xs font-bold px-3 rounded-lg hover:bg-gray-300 transition"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                
                {/* LISTA DE ITENS */}
                {formData.blocks.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {formData.blocks.map((block, index) => (
                            <div 
                              key={index} 
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition group
                                ${editingBlockIndex === index ? 'bg-blue-100 border-blue-300 text-blue-800 ring-1 ring-blue-300' : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'}
                              `}
                            >
                                <span className="cursor-default">{block}</span>
                                
                                <div className="flex items-center border-l border-gray-300 pl-2 ml-1 gap-1 opacity-60 group-hover:opacity-100 transition">
                                  {/* Botão Editar */}
                                  <button 
                                      type="button"
                                      onClick={() => handleEditBlock(index)}
                                      className="text-blue-500 hover:text-blue-700 p-0.5 rounded hover:bg-blue-50"
                                      title="Editar"
                                  >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                  
                                  {/* Botão Remover */}
                                  <button 
                                      type="button"
                                      onClick={() => handleRemoveBlock(index)}
                                      className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"
                                      title="Remover"
                                  >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg">
                      <p className="text-xs text-gray-400 italic">Nenhum bloco ou rua cadastrado.</p>
                    </div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Módulos Ativos</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(formData.modules).map((key) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none hover:bg-gray-100 p-1 rounded transition">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      checked={(formData.modules as any)[key]}
                      onChange={e => setFormData({
                        ...formData, 
                        modules: { ...formData.modules, [key]: e.target.checked }
                      })}
                    />
                    <span className="text-sm capitalize font-medium text-gray-700">{key}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition">Cancelar</button>
            <button type="submit" className="flex-1 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark shadow-lg transition">{editingId ? 'Salvar Alterações' : 'Criar Condomínio'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}