import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
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
  const { canManage } = useAuth()
  const navigate = useNavigate()
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
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
    <PageLayout title="Perguntas Frequentes" subtitle="Tire suas dúvidas sobre o condomínio" icon="❓">
      
      {/* --- Header de Ações --- */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        
        {/* Barra de Busca */}
        <div className="relative flex-1">
          <input 
            type="text" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            placeholder="Buscar dúvida..." 
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent text-sm shadow-sm" 
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        {/* Botão Importar (Apenas Admin/Síndico) */}
        {canManage && (
          <button 
            onClick={() => navigate('/admin/faq-import')}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition flex items-center justify-center gap-2 shadow-sm shrink-0"
          >
            <span>📥</span> <span className="hidden sm:inline">Importar CSV</span>
          </button>
        )}
      </div>
      
      {/* --- Filtros de Categoria (Scroll Horizontal) --- */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        <button onClick={() => setSelectedCategory(null)} className={`px-4 py-2 rounded-full text-xs font-bold border transition shrink-0 ${!selectedCategory ? 'bg-gray-800 text-white border-gray-800 shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Todas</button>
        {Object.keys(CATEGORIES).filter(k => k !== 'default').map(key => (
          <button key={key} onClick={() => setSelectedCategory(key)} className={`px-4 py-2 rounded-full text-xs font-bold border transition shrink-0 flex items-center gap-1 ${selectedCategory === key ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            <span>{CATEGORIES[key].icon}</span> {CATEGORIES[key].label}
          </button>
        ))}
      </div>

      {/* --- Lista de FAQs --- */}
      {filtered.length > 0 ? (
        <div className="space-y-3 pb-20">
          {filtered.map(f => {
            const style = getCategoryStyle(f.category)
            return (
              <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition group">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base ${style.iconBg}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${style.color}`}>
                          {style.label}
                        </span>
                        {/* Botão de editar rápido para admin (futuro) */}
                        {/* {canManage && <button className="text-gray-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>} */}
                      </div>
                      <h3 className="font-bold text-gray-900 mb-2 text-sm sm:text-base">{f.question}</h3>
                      <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                        {f.answer}
                      </p>
                      {f.article_reference && (
                        <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase tracking-wider">
                          Fonte: {f.article_reference}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState 
          icon="🔍" 
          title="Nada encontrado" 
          description="Tente outro termo ou use nossa Assistente Virtual." 
          action={{ label: 'Limpar Filtros', onClick: () => { setSearchTerm(''); setSelectedCategory(null) } }} 
        />
      )}

      {/* --- FAB (Floating Action Button) para Chatbot --- */}
      {/* Substitui o card grande por um botão flutuante amigável */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white w-14 h-14 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition transform hover:scale-110 z-50 group border-2 border-white"
        title="Falar com Norma"
      >
        <span className="text-2xl group-hover:animate-pulse">🤖</span>
        {/* Tooltip Mobile */}
        <span className="absolute right-full mr-3 bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
          Ajuda com IA
        </span>
      </button>

      {/* Componente de Chat */}
      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      
    </PageLayout>
  )
}