import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import Chatbot from '../components/Chatbot'

interface FAQ {
  id: string
  category: string
  question: string
  answer: string
  votes_helpful: number | null
  votes_not_helpful: number | null
}

const CATEGORIES: Record<string, any> = {
  'geral': { label: 'Geral', icon: '📋', color: 'bg-blue-100 text-blue-700', iconBg: 'bg-blue-100' },
  'convivência': { label: 'Convivência', icon: '🤝', color: 'bg-purple-100 text-purple-700', iconBg: 'bg-purple-100' },
  'limpeza': { label: 'Limpeza', icon: '✨', color: 'bg-green-100 text-green-700', iconBg: 'bg-green-100' },
  'lazer': { label: 'Lazer', icon: '⚽', color: 'bg-orange-100 text-orange-700', iconBg: 'bg-orange-100' },
  'segurança': { label: 'Segurança', icon: '🛡️', color: 'bg-indigo-100 text-indigo-700', iconBg: 'bg-indigo-100' },
  'financeiro': { label: 'Financeiro', icon: '💰', color: 'bg-teal-100 text-teal-700', iconBg: 'bg-teal-100' },
  'default': { label: 'Outros', icon: '❓', color: 'bg-gray-100 text-gray-700', iconBg: 'bg-gray-100' }
}

function getCategoryStyle(category: string | null) {
  if (!category) return CATEGORIES.default
  const normalized = category.toLowerCase()
  const key = Object.keys(CATEGORIES).find(k => normalized.includes(k))
  return key ? CATEGORIES[key] : CATEGORIES.default
}

export default function FAQ() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  
  // Estado para controlar o Chatbot
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => { loadFAQs() }, [])

  async function loadFAQs() {
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .order('question', { ascending: true })
      if (error) throw error
      setFaqs(data || [])
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }

  const filtered = faqs.filter(f => {
    const matchesSearch = f.question.toLowerCase().includes(searchTerm.toLowerCase()) || f.answer.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !selectedCategory || getCategoryStyle(f.category).label === CATEGORIES[selectedCategory]?.label
    return matchesSearch && matchesCategory
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageLayout title="Perguntas Frequentes" subtitle="Tire suas dúvidas" icon="❓">
      
      {/* --- 1. CARDS DE RESUMO (LAYOUT COMPACTO EM LINHA) --- */}
      {/* grid-cols-2 em todas as telas para ficarem lado a lado e menores */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        
        {/* Card Estatística */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col justify-center h-24">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Artigos</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold text-primary">{faqs.length}</p>
            <span className="text-xs text-gray-400">total</span>
          </div>
        </div>

        {/* Card Assistente Virtual (Clicável) */}
        <div 
          onClick={() => setIsChatOpen(true)}
          className="bg-gradient-to-br from-purple-50 to-white rounded-xl shadow-sm border border-purple-100 p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition h-24 relative group"
        >
          <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform">
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-xs leading-tight mb-0.5">Assistente Virtual</h3>
            <p className="text-[10px] text-purple-600 font-semibold">Toque para falar</p>
          </div>
          {/* Indicador de pulso */}
          <span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        </div>

      </div>

      {/* --- 2. BARRA DE FILTROS + BUSCA --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 sticky top-20 z-30 space-y-4">
        <div className="relative">
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar dúvida..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide border-t border-gray-100 pt-3">
          <button onClick={() => setSelectedCategory(null)} className={`px-3 py-1 rounded-full text-xs font-bold border transition shrink-0 ${!selectedCategory ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Todas</button>
          {Object.keys(CATEGORIES).filter(k => k !== 'default').map(key => (
            <button key={key} onClick={() => setSelectedCategory(key)} className={`px-3 py-1 rounded-full text-xs font-bold border transition shrink-0 flex items-center gap-1 ${selectedCategory === key ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <span>{CATEGORIES[key].icon}</span> {CATEGORIES[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* --- 3. LISTA DE CARDS --- */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(f => {
            const style = getCategoryStyle(f.category)
            return (
              <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${style.iconBg}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mb-1 ${style.color}`}>
                        {style.label}
                      </span>
                      <h3 className="font-bold text-gray-900 mb-1 text-sm">{f.question}</h3>
                      <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{f.answer}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon="🔍" title="Nada encontrado" description="Tente outro termo ou use o Assistente Virtual." action={{ label: 'Limpar', onClick: () => { setSearchTerm(''); setSelectedCategory(null) } }} />
      )}

      {/* Componente de Chat controlado pela página */}
      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      
    </PageLayout>
  )
}