import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatDateTime } from '../lib/utils'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

interface Comunicado {
  id: string
  title: string
  content: string
  type: string
  priority: number
  published_at: string
  created_at: string
  author: {
    full_name: string
    role: string
  } | null
  is_read: boolean
}

const TYPE_CONFIG: Record<string, any> = {
  'assembleia': { label: 'Assembleia', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: '⚖️' },
  'financeiro': { label: 'Financeiro', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '💰' },
  'urgente': { label: 'Urgente', color: 'bg-red-100 text-red-800 border-red-200', icon: '🚨' },
  'informativo': { label: 'Informativo', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'ℹ️' },
  'importante': { label: 'Importante', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '⚠️' },
  'geral': { label: 'Geral', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: '📋' }
}

// Sub-componente Card
function ComunicadoCard({ comunicado, onMarkRead }: { comunicado: Comunicado, onMarkRead: (id: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const typeConfig = TYPE_CONFIG[comunicado.type] || TYPE_CONFIG['geral']
  const isHighPriority = comunicado.priority >= 3

  return (
    <div className={`relative bg-white rounded-xl shadow-sm border-l-4 overflow-hidden transition-all duration-300 ${!comunicado.is_read ? 'ring-1 ring-purple-400' : ''} ${isExpanded ? 'shadow-md' : ''}`} style={{ borderLeftColor: isHighPriority ? '#EF4444' : '#E5E7EB' }}>
      {!comunicado.is_read && (
        <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm z-10">NOVO</div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${typeConfig.color}`}>
                {typeConfig.icon} {typeConfig.label}
              </span>
              <span className="text-xs text-gray-400 font-medium">{formatDateTime(comunicado.published_at)}</span>
            </div>
            <h3 className={`text-lg font-bold leading-tight ${!comunicado.is_read ? 'text-gray-900' : 'text-gray-700'}`}>{comunicado.title}</h3>
          </div>
        </div>
        <div className={`prose prose-sm max-w-none text-gray-600 bg-gray-50/50 p-3 rounded-lg border border-gray-100 ${!isExpanded ? 'line-clamp-3 relative' : ''}`}>
          <p className="leading-relaxed whitespace-pre-line m-0">{comunicado.content}</p>
          {!isExpanded && <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" />}
        </div>
        <button onClick={() => setIsExpanded(!isExpanded)} className="mt-2 text-sm font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors">
          {isExpanded ? 'Ler menos' : 'Saiba mais...'}
        </button>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 mt-2 border-t border-gray-100 transition-all duration-300 ${!isExpanded && comunicado.is_read ? 'hidden' : 'flex'}`}>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium text-gray-900">{comunicado.author?.full_name || 'Administração'}</span>
          </div>
          {!comunicado.is_read ? (
            <button onClick={() => onMarkRead(comunicado.id)} className="w-full sm:w-auto bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-purple-700 transition shadow-sm flex items-center justify-center gap-2"><span>✓</span> Marcar lido</button>
          ) : (
            <span className="flex items-center gap-1 text-green-600 text-xs font-semibold">Lido</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Comunicados() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => { loadComunicados() }, [user])

  async function loadComunicados() {
    try {
      const { data, error } = await supabase.from('comunicados').select(`id, title, content, type, priority, published_at, created_at, author:author_id (full_name, role)`).order('priority', { ascending: false }).order('published_at', { ascending: false })
      if (error) throw error
      const { data: reads } = await supabase.from('comunicado_reads').select('comunicado_id').eq('user_id', user?.id || '')
      const readIds = new Set(reads?.map(r => r.comunicado_id) || [])
      const formatted = data?.map(c => ({ ...c, author: Array.isArray(c.author) ? c.author[0] : c.author, is_read: readIds.has(c.id), published_at: c.published_at || c.created_at })) || []
      setComunicados(formatted)
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }

  async function markAsRead(id: string) {
    if (!user) return
    await supabase.from('comunicado_reads').insert({ comunicado_id: id, user_id: user.id })
    setComunicados(prev => prev.map(c => c.id === id ? { ...c, is_read: true } : c))
  }

  const filtered = selectedType ? comunicados.filter(c => c.type === selectedType) : comunicados
  const unreadCount = comunicados.filter(c => !c.is_read).length

  if (loading) return <LoadingSpinner />

  return (
    <PageLayout title="Quadro de Avisos" subtitle="Fique por dentro de tudo" icon="📢">
      
      {/* --- 1. CARDS DE RESUMO (Layout Scrollável Horizontal no Mobile) --- */}
      <div className="
        flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-4 pb-4 mb-6
        md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:snap-none
        scrollbar-hide
      ">
        <div className="min-w-[240px] snap-center bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total de Avisos</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-gray-800">{comunicados.length}</p>
            <span className="text-2xl">📋</span>
          </div>
        </div>

        <div className="min-w-[240px] snap-center bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Não Lidos</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-purple-600">{unreadCount}</p>
            <span className="text-2xl">📬</span>
          </div>
        </div>

        <div className="min-w-[240px] snap-center bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Urgentes</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-bold text-red-600">{comunicados.filter(c => c.priority >= 3).length}</p>
            <span className="text-2xl">🚨</span>
          </div>
        </div>
      </div>

      {/* --- 2. BARRA DE FILTROS --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 sticky top-20 z-30">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setSelectedType(null)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition shrink-0 ${!selectedType ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Todos</button>
          {Object.entries(TYPE_CONFIG).map(([key, config]) => (
            <button key={key} onClick={() => setSelectedType(key)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition shrink-0 flex items-center gap-1 ${selectedType === key ? `${config.color} shadow-sm` : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <span>{config.icon}</span> {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map(c => <ComunicadoCard key={c.id} comunicado={c} onMarkRead={markAsRead} />)}
        </div>
      ) : (
        <EmptyState icon="📭" title="Nenhum comunicado" description="Não há avisos para esta categoria." action={{ label: 'Ver todos', onClick: () => setSelectedType(null) }} />
      )}
    </PageLayout>
  )
}