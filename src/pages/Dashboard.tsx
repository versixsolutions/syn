import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Interface unificada para o feed de atualizações
interface DashboardUpdate {
  id: string
  type: 'comunicado' | 'despesa' | 'ocorrencia' | 'votacao' | 'faq'
  title: string
  description: string
  date: string
  icon: string
  color: string
  bgColor: string
  link: string
  isPinned?: boolean // Para comunicados urgentes
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { stats, loading: loadingStats } = useDashboardStats()
  const [unreadCount, setUnreadCount] = useState(0)
  const [updates, setUpdates] = useState<DashboardUpdate[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(true)

  useEffect(() => {
    loadUnreadCount()
    loadUnifiedFeed()
  }, [profile?.id])

  async function loadUnreadCount() {
    try {
      const { data: comunicados } = await supabase.from('comunicados').select('id')
      const { data: reads } = await supabase
        .from('comunicado_reads')
        .select('comunicado_id')
        .eq('user_id', profile?.id || '')

      const readIds = new Set(reads?.map(r => r.comunicado_id) || [])
      const unread = comunicados?.filter(c => !readIds.has(c.id)).length || 0
      setUnreadCount(unread)
    } catch (error) {
      console.error('Erro ao carregar não lidos:', error)
    }
  }

  // Função central que busca dados de todas as tabelas e unifica em uma timeline
  async function loadUnifiedFeed() {
    try {
      setLoadingUpdates(true)

      // 1. Buscar Comunicados Recentes (Limit 5)
      const { data: comunicados } = await supabase
        .from('comunicados')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      // 2. Buscar Despesas Recentes (Limit 5)
      const { data: despesas } = await supabase
        .from('despesas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      // 3. Buscar Ocorrências Recentes (Limit 5)
      const { data: ocorrencias } = await supabase
        .from('ocorrencias')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      // 4. Buscar Votações Recentes (Limit 3)
      const { data: votacoes } = await supabase
        .from('votacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)

      // 5. Buscar FAQs Recentes (Limit 3)
      const { data: faqs } = await supabase
        .from('faqs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3)

      // Normalizar dados para o formato DashboardUpdate
      const normalizedUpdates: DashboardUpdate[] = []

      comunicados?.forEach(c => {
        const isUrgent = c.priority === 'urgente' || c.type === 'urgente'
        normalizedUpdates.push({
          id: `com-${c.id}`,
          type: 'comunicado',
          title: isUrgent ? `COMUNICADO URGENTE: ${c.title}` : c.title,
          description: c.content.substring(0, 100) + (c.content.length > 100 ? '...' : ''),
          date: c.created_at,
          icon: isUrgent ? '📢' : '📌',
          color: isUrgent ? 'text-red-600' : 'text-blue-600',
          bgColor: isUrgent ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100',
          link: '/comunicados',
          isPinned: isUrgent
        })
      })

      despesas?.forEach(d => {
        normalizedUpdates.push({
          id: `desp-${d.id}`,
          type: 'despesa',
          title: 'Nova Despesa Registrada',
          description: `${d.description} - ${formatCurrency(d.amount)}`,
          date: d.created_at,
          icon: '💰',
          color: 'text-green-600',
          bgColor: 'bg-white border-gray-100',
          link: '/despesas'
        })
      })

      ocorrencias?.forEach(o => {
        normalizedUpdates.push({
          id: `oco-${o.id}`,
          type: 'ocorrencia',
          title: `Atualização em Ocorrência: ${o.status.replace('_', ' ')}`,
          description: o.title,
          date: o.updated_at || o.created_at,
          icon: '🚨',
          color: 'text-orange-600',
          bgColor: 'bg-white border-gray-100',
          link: '/ocorrencias'
        })
      })

      votacoes?.forEach(v => {
        const isActive = new Date(v.end_date) > new Date()
        normalizedUpdates.push({
          id: `vot-${v.id}`,
          type: 'votacao',
          title: isActive ? 'Nova Votação Iniciada' : 'Votação Encerrada',
          description: v.title,
          date: v.created_at,
          icon: '🗳️',
          color: 'text-purple-600',
          bgColor: 'bg-purple-50 border-purple-100',
          link: '/votacoes'
        })
      })

      faqs?.forEach(f => {
        normalizedUpdates.push({
          id: `faq-${f.id}`,
          type: 'faq',
          title: 'Nova Pergunta Respondida',
          description: f.question,
          date: f.created_at,
          icon: '❓',
          color: 'text-cyan-600',
          bgColor: 'bg-white border-gray-100',
          link: '/faq'
        })
      })

      // Ordenar por data (mais recente primeiro) e prioridade (pinned primeiro)
      const sorted = normalizedUpdates.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })

      setUpdates(sorted.slice(0, 20)) // Pegar apenas os 20 últimos eventos
    } catch (error) {
      console.error('Erro ao carregar feed:', error)
    } finally {
      setLoadingUpdates(false)
    }
  }

  function formatTimeAgo(dateString: string) {
    const diff = new Date().getTime() - new Date(dateString).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `há ${days} dia${days > 1 ? 's' : ''}`
    if (hours > 0) return `há ${hours}h`
    if (minutes > 0) return `há ${minutes}m`
    return 'agora'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                🏢
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Versix Meu Condominio</h1>
                <p className="text-xs md:text-sm text-white/80">{profile?.condominio_name || 'Carregando...'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/comunicados')}
                className="relative p-2 hover:bg-white/20 rounded-lg transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              <button
                onClick={signOut}
                className="hidden md:block bg-white/20 px-4 py-2 rounded-lg text-sm hover:bg-white/30 transition"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 pb-24 md:pb-6">
        {/* Saudação */}
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Olá, {profile?.full_name?.split(' ')[0]}! 👋
          </h2>
          <p className="text-gray-600">Bem-vindo ao seu painel de gestão condominial</p>
        </div>

        {/* Stats Cards com Rolagem Horizontal no Mobile */}
        <div className="
          flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-4 pb-4 mb-6
          md:grid md:grid-cols-4 md:overflow-visible md:pb-0 md:snap-none
          scrollbar-hide
        ">
          <div onClick={() => navigate('/faq')} className="min-w-[260px] snap-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg cursor-pointer transition-transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="text-4xl">❓</div>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">FAQ</h3>
            <p className="text-3xl font-bold text-primary mb-1">{stats.faq.answeredThisMonth}</p>
            <p className="text-xs text-gray-500">perguntas respondidas</p>
          </div>

          <div onClick={() => navigate('/despesas')} className="min-w-[260px] snap-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg cursor-pointer transition-transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="text-4xl">💰</div>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Despesas</h3>
            <p className="text-2xl font-bold text-green-600 mb-1">{formatCurrency(stats.despesas.totalMes)}</p>
            <p className="text-xs text-gray-500">{stats.despesas.count} lançamentos no mês</p>
          </div>

          <div onClick={() => navigate('/votacoes')} className="min-w-[260px] snap-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg cursor-pointer relative transition-transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="text-4xl">🗳️</div>
              {stats.votacoes.ativas > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                  {stats.votacoes.ativas}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Votações</h3>
            <p className="text-3xl font-bold text-primary mb-1">{stats.votacoes.ativas}</p>
            <p className="text-xs text-gray-500">
              {stats.votacoes.ativas > 0 ? 'Votações ativas' : 'Nenhuma ativa'}
            </p>
          </div>

          <div onClick={() => navigate('/ocorrencias')} className="min-w-[260px] snap-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg cursor-pointer transition-transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="text-4xl">🚨</div>
              {(stats.ocorrencias.abertas + stats.ocorrencias.em_andamento) > 0 && (
                <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {stats.ocorrencias.abertas + stats.ocorrencias.em_andamento}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Ocorrências</h3>
            <p className="text-3xl font-bold text-orange-600 mb-1">
              {stats.ocorrencias.abertas + stats.ocorrencias.em_andamento}
            </p>
            <p className="text-xs text-gray-500">{stats.ocorrencias.abertas} abertas</p>
          </div>
        </div>

        {/* Feed Unificado: Últimas Atualizações */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              ⚡ Últimas Atualizações
            </h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Em tempo real
            </span>
          </div>
          
          {loadingUpdates ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-100 rounded-lg"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-0">
              {updates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhuma atualização recente.</p>
              ) : (
                updates.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(item.link)}
                    className={`
                      relative flex gap-4 p-4 transition cursor-pointer hover:bg-gray-50
                      ${index !== updates.length - 1 ? 'border-b border-gray-100' : ''}
                      ${item.isPinned ? 'bg-yellow-50/50 hover:bg-yellow-50' : ''}
                    `}
                  >
                    {/* Linha do tempo vertical */}
                    <div className="absolute left-[2rem] top-0 bottom-0 w-px bg-gray-100 -z-10 md:block hidden"></div>

                    {/* Ícone */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl shadow-sm z-10 ${item.bgColor}`}>
                      {item.icon}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={`text-sm md:text-base font-bold truncate pr-2 ${item.color}`}>
                          {item.isPinned && <span className="mr-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded uppercase tracking-wide">Fixo</span>}
                          {item.title}
                        </h4>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatTimeAgo(item.date)}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-gray-600 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          <div className="mt-6 text-center">
             <button onClick={() => navigate('/comunicados')} className="text-primary text-sm font-semibold hover:underline">
               Ver todos os comunicados &rarr;
             </button>
          </div>
        </div>
      </main>

      {/* Mobile Menu */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 safe-area-pb">
        <div className="grid grid-cols-5 gap-1">
          <button onClick={() => navigate('/')} className="flex flex-col items-center py-3 text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </button>
          <button onClick={() => navigate('/faq')} className="flex flex-col items-center py-3 text-gray-400 hover:text-primary transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
          <button onClick={() => navigate('/despesas')} className="flex flex-col items-center py-3 text-gray-400 hover:text-primary transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
          <button onClick={() => navigate('/votacoes')} className="flex flex-col items-center py-3 text-gray-400 hover:text-primary transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </button>
          <button onClick={() => navigate('/ocorrencias')} className="flex flex-col items-center py-3 text-gray-400 hover:text-primary transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </button>
        </div>
      </nav>
    </div>
  )
}