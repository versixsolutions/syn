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
}

const CATEGORIES = {
  'Geral': { label: 'Geral', icon: '📋', color: 'blue' },
  'Convivência': { label: 'Convivência', icon: '🤝', color: 'purple' },
  'Limpeza': { label: 'Limpeza', icon: '✨', color: 'green' },
  'Lazer': { label: 'Lazer', icon: '⚽', color: 'orange' },
  'Segurança': { label: 'Segurança', icon: '🛡️', color: 'indigo' },
  'Financeiro': { label: 'Financeiro', icon: '💰', color: 'teal' },
}

export default function FAQ() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => { loadFAQs() }, [])

  async function loadFAQs() {
    try {
      const { data, error } = await supabase.from('faqs').select('*').order('question', { ascending: true })
      if (error) throw error
      setFaqs(data || [])
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }

  const filtered = faqs.filter(f => {
    const matchesSearch = f.question.toLowerCase().includes(searchTerm.toLowerCase()) || f.answer.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !selectedCategory || f.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  if (loading) return <LoadingSpinner />

  return (
    <PageLayout title="Perguntas Frequentes" subtitle="Tire suas dúvidas" icon="❓">
      
      {/* --- 1. CARDS DE RESUMO (PADRÃO ÚNICO) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Base de Conhecimento</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-primary">{faqs.length}</p>
            <span className="text-xs text-gray-400 font-medium">Artigos cadastrados</span>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-2xl">🤖</div>
          <div>
            <h3 className="font-bold text-gray-900">Assistente Virtual</h3>
            <p className="text-xs text-gray-500">Estou pronto para responder suas dúvidas sobre o Regimento!</p>
          </div>
        </div>
      </div>

      {/* --- 2. BARRA DE FILTROS + BUSCA (PADRÃO ÚNICO) --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 sticky top-20 z-30 space-y-4">
        <div className="relative">
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar dúvida..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide border-t border-gray-100 pt-3">
          <button onClick={() => setSelectedCategory(null)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition shrink-0 ${!selectedCategory ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Todas</button>
          {Object.keys(CATEGORIES).map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition shrink-0 ${selectedCategory === cat ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map(f => (
            <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition">
              <h3 className="font-bold text-gray-900 mb-2">{f.question}</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">{f.answer}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="🔍" title="Nada encontrado" description="Tente outro termo." action={{ label: 'Limpar', onClick: () => { setSearchTerm(''); setSelectedCategory(null) } }} />
      )}

      <Chatbot />
    </PageLayout>
  )
}