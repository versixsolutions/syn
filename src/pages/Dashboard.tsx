import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { formatCurrency } from '../lib/utils'
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
  isPinned?: boolean
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { stats } = useDashboardStats()
  const [updates, setUpdates] = useState<DashboardUpdate[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(true)

  useEffect(() => {
    if (profile?.id) {
      loadUnifiedFeed()
    }
  }, [profile?.id])

  async function loadUnifiedFeed() {
    setLoadingUpdates(true)
    
    // Função auxiliar para buscar dados com tratamento de erro individual
    const fetchData = async (table: string, queryBuilder: any) => {
      try {
        const { data, error } = await queryBuilder
        if (error) {
          console.error(`Erro ao buscar ${table}:`, error.message)
          return []
        }
        return data
      } catch (err) {
        console.error(`Exceção ao buscar ${table}:`, err)
        return []
      }
    }

    // Buscas individuais
    const comunicados = await fetchData('comunicados', 
      supabase.from('comunicados').select('*').order('published_at', { ascending: false }).limit(5)
    )

    const despesas = await fetchData('despesas', 
      supabase.from('despesas').select('*').order('created_at', { ascending: false }).limit(5)
    )

    const ocorrencias = await fetchData('ocorrencias', 
      supabase.from('ocorrencias').select('*').order('created_at', { ascending: false }).limit(5)
    )

    const votacoes = await fetchData('votacoes', 
      supabase.from('votacoes').select('*').order('created_at', { ascending: false }).limit(3)
    )

    const faqs = await fetchData('faqs', 
      supabase.from('faqs').select('*').order('created_at', { ascending: false }).limit(3)
    )

    const newUpdates: DashboardUpdate[] = []

    // Processamento dos dados
    comunicados?.forEach((c: any) => {
      const isUrgent = c.priority === 'urgente' || c.type === 'urgente'
      newUpdates.push({
        id: `com-${c.id}`,
        type: 'comunicado',
        title: isUrgent ? `COMUNICADO URGENTE: ${c.title}` : c.title,
        description: c.content,
        date: c.published_at, 
        icon: isUrgent ? '📢' : '📌',
        color: isUrgent ? 'text-red-600' : 'text-blue-600',
        bgColor: isUrgent ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100',
        link: '/comunicados',
        isPinned: isUrgent
      })
    })

    despesas?.forEach((d: any) => {
      newUpdates.push({
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

    ocorrencias?.forEach((o: any) => {
      newUpdates.push({
        id: `oco-${o.id}`,
        type: 'ocorrencia',
        title: `Atualização em Ocorrência`,
        description: o.title,
        date: o.updated_at || o.created_at,
        icon: '🚨',
        color: 'text-orange-600',
        bgColor: 'bg-white border-gray-100',
        link: '/ocorrencias'
      })
    })

    votacoes?.forEach((v: any) => {
      const isActive = new Date(v.end_date) > new Date()
      newUpdates.push({
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

    faqs?.forEach((f: any) => {
      newUpdates.push({
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

    const sorted = newUpdates.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    setUpdates(sorted.slice(0, 20))
    setLoadingUpdates(false)
  }

  function formatTimeAgo(dateString: string) {
    if (!dateString) return ''
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
    <div className="max-w-7xl mx-auto">
      {/* Saudação */}
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
          Olá, {profile?.full_name?.split(' ')[0]}! 👋
        </h2>
        <p className="text-gray-600">Bem-vindo ao seu painel de gestão condominial</p>
      </div>

      {/* Stats Cards */}
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
          {/* CORREÇÃO AQUI: Texto dinâmico do mês */}
          <p className="text-xs text-gray-500">
            {stats.despesas.count} lançamentos em {stats.despesas.monthLabel}
          </p>
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

      {/* Últimas Atualizações */}
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
                  {/* Linha vertical (Desktop) */}
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
    </div>
  )
}