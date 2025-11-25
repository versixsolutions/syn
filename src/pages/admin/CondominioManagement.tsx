import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { extractTextFromPDF } from '../../lib/pdfUtils'
import PageLayout from '../../components/PageLayout' // Caminho corrigido se necessário, verifique se PageLayout está em ../../components
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/ui/Modal'
import toast from 'react-hot-toast'

// ... (Interfaces e INITIAL_FORM mantidos iguais)

interface Condominio {
  id: string
  name: string
  slug: string
  created_at: string
  theme_config: any
}

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
  
  // 2. Identidade Visual
  primaryColor: '#1F4080',
  secondaryColor: '#00A86B',
  logoUrl: '',
  
  // 3. Estrutura
  totalUnits: '',
  blocks: '', 
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
  const [isProcessingPdf, setIsProcessingPdf] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // --- PARSER ROBUSTO DA RECEITA FEDERAL ---
  const parseReceitaPDF = (text: string) => {
    // 1. Limpeza agressiva para normalizar espaços e remover quebras de linha
    // Substitui qualquer sequência de whitespace por um único espaço
    const cleanText = text.replace(/\s+/g, ' ').trim()
    console.log("Texto Extraído (Clean):", cleanText)

    // Helper para extrair texto entre dois marcadores
    const extractField = (startRegex: RegExp, stopRegexes: RegExp[]) => {
      const match = cleanText.match(startRegex)
      if (!match || !match.index) return ''
      
      const startIndex = match.index + match[0].length
      const textAfterStart = cleanText.slice(startIndex)
      
      let bestStopIndex = textAfterStart.length
      
      // Procura o marcador de parada mais próximo
      stopRegexes.forEach(stopRegex => {
        const stopMatch = textAfterStart.match(stopRegex)
        if (stopMatch && stopMatch.index !== undefined && stopMatch.index < bestStopIndex) {
          bestStopIndex = stopMatch.index
        }
      })

      // Limpa o resultado: remove asteriscos e trim
      return textAfterStart.slice(0, bestStopIndex).trim().replace(/[*]+/g, '') 
    }

    // 2. Extração de Campos

    // CNPJ: Regex ultra flexível. Procura padrão XX . XXX . XXX / XXXX - XX
    // Aceita pontos, vírgulas ou espaços entre os grupos numéricos
    // Ex: 08.610,757/0007-02 ou 08 610 757 / 0007 - 02
    const cnpjMatch = cleanText.match(/(\d{2})[\.\,\s]*(\d{3})[\.\,\s]*(\d{3})[\.\,\s]*\/[\.\,\s]*(\d{4})[\.\,\s-]*(\d{2})/)
    
    let cnpj = ''
    if (cnpjMatch) {
        // Reconstrói o CNPJ limpo: XX.XXX.XXX/XXXX-XX
        cnpj = `${cnpjMatch[1]}.${cnpjMatch[2]}.${cnpjMatch[3]}/${cnpjMatch[4]}-${cnpjMatch[5]}`
    }

    // Razão Social
    const razaoSocial = extractField(/NOME EMPRESARIAL\s+/i, [/TÍTULO DO ESTABELECIMENTO/i, /PORTE/i, /TITULO/i])
    
    // Nome Fantasia
    const nomeFantasia = extractField(/NOME DE FANTASIA\)\s+/i, [/PORTE/i, /CÓDIGO E DESCRIÇÃO/i])

    // Endereço
    const logradouro = extractField(/LOGRADOURO\s+/i, [/CEP/i, /NÚMERO/i, /BAIRRO/i, /NUMERO/i])
    const numero = extractField(/N[UÚ]MERO\s+/i, [/COMPLEMENTO/i, /MUNICÍPIO/i, /BAIRRO/i, /MUNICIPIO/i])
    const bairro = extractField(/BAIRRO\/?\s*DISTRITO\s+/i, [/MUNICÍPIO/i, /CEP/i, /ENDEREÇO ELETRÔNICO/i, /MUNICIPIO/i])
    const municipio = extractField(/MUNIC[IÍ]PIO\s+/i, [/UF/i, /TELEFONE/i])

    // UF: Procura UF seguido de 2 letras maiúsculas, com segurança de borda
    const ufMatch = cleanText.match(/\bUF\s+([A-Z]{2})\b/i)
    const uf = ufMatch ? ufMatch[1] : ''

    // Contatos
    let email = extractField(/ENDEREÇO ELETRÔNICO\s+/i, [/TELEFONE/i, /ENTE FEDERATIVO/i])
    // Fallback para email: procura padrão @ se o extrator falhar
    if (!email.includes('@')) {
      const emailRegexMatch = cleanText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/)
      if (emailRegexMatch) email = emailRegexMatch[0]
    }

    const telefone = extractField(/TELEFONE\s+/i, [/ENTE FEDERATIVO/i, /SITUAÇÃO CADASTRAL/i, /SITUACAO/i])

    // Lógica de Nome de Exibição
    const displayName = (nomeFantasia && nomeFantasia.length > 2 && !nomeFantasia.includes('***')) 
        ? nomeFantasia 
        : razaoSocial

    // Monta endereço completo
    const addressParts = []
    if (logradouro) addressParts.push(logradouro)
    if (numero && !numero.includes('***')) addressParts.push(numero)
    if (bairro) addressParts.push(bairro)

    return {
      cnpj,
      razaoSocial,
      name: displayName,
      address: addressParts.join(', '),
      city: municipio,
      state: uf,
      email: email.toLowerCase(),
      phone: telefone
    }
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return
    const file = e.target.files[0]
    
    setIsProcessingPdf(true)
    const toastId = toast.loading('Lendo Cartão CNPJ...')

    try {
      const text = await extractTextFromPDF(file)
      
      if (!text || text.trim().length < 50) {
          throw new Error('O PDF parece estar vazio ou ilegível (imagem?). Tente um PDF de texto selecionável.')
      }

      const extractedData = parseReceitaPDF(text)

      // VALIDAÇÃO
      if (!extractedData.cnpj) {
        console.warn("Falha na extração de CNPJ. Texto bruto:", text)
        throw new Error('Não foi possível encontrar um CNPJ válido. Verifique se é o documento correto.')
      }

      setFormData(prev => ({
        ...prev,
        ...extractedData,
        // Gera slug apenas se não houver um definido
        slug: !prev.slug ? (extractedData.name ? extractedData.name.toLowerCase().replace(/[^a-z0-9]/g, '') : '') : prev.slug
      }))

      toast.success('Dados extraídos com sucesso!', { id: toastId })
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Falha ao processar PDF', { id: toastId })
    } finally {
      setIsProcessingPdf(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const toastId = toast.loading('Criando condomínio...')

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
          blocks: formData.blocks.split(',').map(b => b.trim()).filter(Boolean)
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
          }
        }
      }

      const { error } = await supabase.from('condominios').insert({
        name: formData.name,
        slug: formData.slug,
        theme_config: themeConfig
      })

      if (error) throw error

      toast.success('Condomínio criado com sucesso!', { id: toastId })
      setIsModalOpen(false)
      setFormData(INITIAL_FORM)
      loadCondominios()

    } catch (error: any) {
      toast.error('Erro ao criar: ' + error.message, { id: toastId })
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
          onClick={() => setIsModalOpen(true)}
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
            <div key={cond.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition group">
              <div className="flex justify-between items-start mb-3">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                  🏢
                </div>
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded border border-blue-100">
                  {cond.slug}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-1">{cond.name}</h3>
              <p className="text-xs text-gray-500 mb-4 truncate">
                {cond.theme_config?.cadastro?.address || 'Endereço não informado'}
              </p>
              
              <div className="flex gap-2 border-t border-gray-100 pt-3">
                <button className="flex-1 text-xs font-bold text-gray-600 hover:bg-gray-50 py-2 rounded">
                  Editar
                </button>
                <button className="flex-1 text-xs font-bold text-blue-600 hover:bg-blue-50 py-2 rounded">
                  Acessar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Novo Condomínio"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-blue-900 text-sm">1. Dados Cadastrais</h4>
              
              <div>
                <input 
                  type="file" 
                  accept=".pdf" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handlePdfUpload} 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingPdf}
                  className="bg-white text-blue-600 text-xs font-bold px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-50 transition flex items-center gap-2 shadow-sm"
                >
                  {isProcessingPdf ? 'Lendo...' : '📄 Importar Cartão CNPJ'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Nome Fantasia (Exibição)</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-lg text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Pinheiro Park" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Razão Social</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={formData.razaoSocial} onChange={e => setFormData({...formData, razaoSocial: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">CNPJ</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Slug (URL)</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-lg text-sm bg-white font-mono" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s/g, '')})} placeholder="ex: versix" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Endereço Completo</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Cidade</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">UF</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm bg-white" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-3">2. Identidade Visual</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Cor Primária</label>
                <div className="flex gap-2">
                  <input type="color" className="h-9 w-9 rounded cursor-pointer border border-gray-200" value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                  <input type="text" className="flex-1 px-3 py-2 border rounded-lg text-sm uppercase" value={formData.primaryColor} onChange={e => setFormData({...formData, primaryColor: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Cor Secundária</label>
                <div className="flex gap-2">
                  <input type="color" className="h-9 w-9 rounded cursor-pointer border border-gray-200" value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                  <input type="text" className="flex-1 px-3 py-2 border rounded-lg text-sm uppercase" value={formData.secondaryColor} onChange={e => setFormData({...formData, secondaryColor: e.target.value})} />
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">Logo URL</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="https://..." value={formData.logoUrl} onChange={e => setFormData({...formData, logoUrl: e.target.value})} />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 text-sm mb-3">3. Configuração</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Total Unidades</label>
                <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={formData.totalUnits} onChange={e => setFormData({...formData, totalUnits: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Blocos (sep. vírgula)</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="A, B, C..." value={formData.blocks} onChange={e => setFormData({...formData, blocks: e.target.value})} />
              </div>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Módulos Ativos</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(formData.modules).map((key) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-primary rounded"
                      checked={(formData.modules as any)[key]}
                      onChange={e => setFormData({
                        ...formData, 
                        modules: { ...formData.modules, [key]: e.target.checked }
                      })}
                    />
                    <span className="text-sm capitalize">{key}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 flex gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="flex-1 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark shadow-lg">Criar Condomínio</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}