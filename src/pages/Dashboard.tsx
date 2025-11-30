import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { formatCurrency } from '../lib/utils'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import Chatbot from '../components/Chatbot'

interface DashboardUpdate {
  id: string
  type: 'comunicado' | 'despesa' | 'ocorrencia' | 'votacao' | 'faq' | 'documento'
  title: string
  description: string
  date: string
  icon: string
  color: string
  bgColor: string
  link: string
  isPinned?: boolean
}

interface BannerAd {
  id: string
  image_url: string
  link_url: string
  title: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const { stats } = useDashboardStats()
  
  const [updates, setUpdates] = useState<DashboardUpdate[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(true)
  const [banners, setBanners] = useState<BannerAd[]>([])
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
  
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      navigate('/admin', { replace: true })
    }
  }, [isAdmin, navigate])

  useEffect(() => {
    if (profile?.condominio_id && !isAdmin) {
      loadUnifiedFeed()
      loadBanner()
    } else {
      setLoadingUpdates(false)
    }
  }, [profile?.condominio_id, isAdmin])

  async function loadBanner() {
    try {
      const { data } = await supabase
        .from('marketplace_ads')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
      
      if (data && data.length > 0) {
        setBanners(data)
        // Tenta incrementar view do primeiro banner de forma segura (fire and forget)
        try {
           await supabase.rpc('increment_ad_view', { ad_id: data[0].id })
        } catch (err) {
           console.warn('Falha ao registrar view do banner (silencioso):', err)
        }
      }
    } catch (error) {
      console.error('Erro banner:', error)
    }
  }

  // Auto-rotação dos banners a cada 5 segundos
  useEffect(() => {
    if (banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => {
        const nextIndex = (prev + 1) % banners.length
        // Registra view do próximo banner
        try {
          supabase.rpc('increment_ad_view', { ad_id: banners[nextIndex].id })
        } catch (err) {
          console.warn('Falha ao registrar view do banner:', err)
        }
        return nextIndex
      })
    }, 5000) // 5 segundos

    return () => clearInterval(interval)
  }, [banners])

  const handleBannerClick = async (banner: BannerAd) => {
    if (banner) {
      // 1. Tenta registrar o clique (fire and forget)
      try {
        const { error } = await supabase.rpc('increment_ad_click', { ad_id: banner.id })
        if (error) console.warn('Erro RPC Click:', error)
      } catch (err) {
        console.warn('Erro ao chamar RPC Click:', err)
      }

      // 2. Abre o link (Prioridade)
      if (banner.link_url) {
        window.open(banner.link_url, '_blank')
      }
    }
  }

  const goToBanner = (index: number) => {
    setCurrentBannerIndex(index)
    // Registra view
    try {
      supabase.rpc('increment_ad_view', { ad_id: banners[index].id })
    } catch (err) {
      console.warn('Falha ao registrar view:', err)
    }
  }

  async function loadUnifiedFeed() {
    setLoadingUpdates(true)
    const fetchData = async (table: string, queryBuilder: any) => {
      try {
        const { data, error } = await queryBuilder
        return error ? [] : data
      } catch { return [] }
    }

    try {
      const [comunicados, despesas, ocorrencias, votacoes, faqs, documentos] = await Promise.all([
        fetchData('comunicados', supabase.from('comunicados').select('*').eq('condominio_id', profile?.condominio_id).order('published_at', { ascending: false }).limit(5)),
        fetchData('despesas', supabase.from('despesas').select('*').eq('condominio_id', profile?.condominio_id).order('created_at', { ascending: false }).limit(5)),
        fetchData('ocorrencias', supabase.from('ocorrencias').select('*').eq('condominio_id', profile?.condominio_id).order('created_at', { ascending: false }).limit(5)),
        fetchData('votacoes', supabase.from('votacoes').select('*').eq('condominio_id', profile?.condominio_id).order('created_at', { ascending: false }).limit(3)),
        fetchData('faqs', supabase.from('faqs').select('*').eq('condominio_id', profile?.condominio_id).order('created_at', { ascending: false }).limit(3)),
        fetchData('documents', supabase.from('documents').select('id, title, created_at, metadata').eq('condominio_id', profile?.condominio_id).is('metadata->>is_chunk', null).order('created_at', { ascending: false }).limit(5))
      ])

      const newUpdates: DashboardUpdate[] = []

      comunicados?.forEach((c: any) => {
        if (c.title.startsWith('Novo Documento:')) return;
        const isUrgent = c.priority >= 3
        newUpdates.push({ id: `com-${c.id}`, type: 'comunicado', title: isUrgent ? `URGENTE: ${c.title}` : c.title, description: c.content, date: c.published_at || c.created_at, icon: isUrgent ? '📢' : '📌', color: isUrgent ? 'text-red-600' : 'text-blue-600', bgColor: isUrgent ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100', link: '/comunicados', isPinned: isUrgent })
      })
      
      despesas?.forEach((d: any) => newUpdates.push({ id: `desp-${d.id}`, type: 'despesa', title: 'Nova Despesa', description: `${d.description} - ${formatCurrency(d.amount)}`, date: d.created_at, icon: '💰', color: 'text-green-600', bgColor: 'bg-green-50 border-green-100', link: '/transparencia' }))
      ocorrencias?.forEach((o: any) => newUpdates.push({ id: `oco-${o.id}`, type: 'ocorrencia', title: `Ocorrência: ${o.status}`, description: o.title, date: o.created_at, icon: '🚨', color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-100', link: '/ocorrencias' }))
      votacoes?.forEach((v: any) => newUpdates.push({ id: `vot-${v.id}`, type: 'votacao', title: 'Assembleia', description: v.title, date: v.created_at, icon: '🗳️', color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-100', link: '/votacoes' }))
      faqs?.forEach((f: any) => newUpdates.push({ id: `faq-${f.id}`, type: 'faq', title: 'Dúvida Respondida', description: f.question, date: f.created_at, icon: '❓', color: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-100', link: '/faq' }))
      documentos?.forEach((d: any) => newUpdates.push({ id: `doc-${d.id}`, type: 'documento', title: 'Novo Documento', description: d.title, date: d.created_at, icon: '📚', color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-100', link: '/biblioteca' }))

      const sorted = newUpdates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setUpdates(sorted.slice(0, 20))
    } catch (error) { console.error(error) } finally { setLoadingUpdates(false) }
  }

  function formatTimeAgo(dateString: string) {
    if (!dateString) return ''
    const diff = new Date().getTime() - new Date(dateString).getTime()
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (days > 0) return `há ${days}d`
    if (hours > 0) return `há ${hours}h`
    return 'agora'
  }

  if (isAdmin) return <LoadingSpinner message="Acessando painel..." />

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8">
      
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Olá, {profile?.full_name?.split(' ')[0]}! 👋
          </h2>
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mt-0.5">
            {profile?.condominio_name || 'Versix Norma'}
          </p>
        </div>
      </div>

      {/* GRID DE ATALHOS: 3 colunas */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <DashboardCard icon="📢" label="Avisos" kpi={stats.comunicados.nao_lidos > 0 ? `${stats.comunicados.nao_lidos} novos` : ''} alert={stats.comunicados.nao_lidos > 0} onClick={() => navigate('/comunicados')} />
        <DashboardCard icon="❓" label="Dúvidas" kpi={`${stats.faq.answeredThisMonth || 0} artigos`} onClick={() => navigate('/faq')} />
        <DashboardCard icon="💰" label="Contas" kpi={formatCurrency(stats.despesas.totalMes)} onClick={() => navigate('/transparencia')} accentColor="text-green-600" />
        <DashboardCard icon="🗳️" label="Assembleias" kpi={stats.votacoes.ativas > 0 ? `${stats.votacoes.ativas} ativas` : ''} alert={stats.votacoes.ativas > 0} onClick={() => navigate('/transparencia/assembleias')} />
        <DashboardCard icon="🚨" label="Ocorrências" kpi={stats.ocorrencias.abertas > 0 ? `${stats.ocorrencias.abertas} abertas` : ''} onClick={() => navigate('/ocorrencias')} />
        <DashboardCard icon="📚" label="Documentos" kpi="Biblioteca" onClick={() => navigate('/biblioteca')} />
      </div>

      {/* BANNER PUBLICITÁRIO COM CARROSSEL */}
      {banners.length > 0 && (
        <div className="mb-8 relative group">
          {/* Carrossel Container */}
          <div className="rounded-2xl overflow-hidden shadow-lg relative">
            {/* Badge Publicidade */}
            <div className="absolute top-2 right-2 bg-black/30 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm uppercase font-bold tracking-widest opacity-70 z-10">
              Publicidade
            </div>

            {/* Banner Atual */}
            <div
              onClick={() => handleBannerClick(banners[currentBannerIndex])}
              className="cursor-pointer transform transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <img
                src={banners[currentBannerIndex].image_url}
                alt={banners[currentBannerIndex].title}
                className="w-full h-auto object-cover max-h-40 md:max-h-52 transition-opacity duration-500"
              />
            </div>

            {/* Setas de Navegação (aparecem no hover se houver múltiplos banners) */}
            {banners.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    goToBanner((currentBannerIndex - 1 + banners.length) % banners.length)
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 w-8 h-8 rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  aria-label="Banner anterior"
                >
                  ←
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    goToBanner((currentBannerIndex + 1) % banners.length)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 w-8 h-8 rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  aria-label="Próximo banner"
                >
                  →
                </button>
              </>
            )}
          </div>

          {/* Indicadores de Posição (dots) */}
          {banners.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToBanner(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    index === currentBannerIndex
                      ? 'w-6 bg-primary'
                      : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Ir para banner ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* FEED */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">⚡ Atualizações</h3>
          <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Recentes</span>
        </div>
        
        {loadingUpdates ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl"></div>)}
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-gray-50">
            {updates.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma novidade hoje.</p>
            ) : (
              updates.map((item) => (
                <div key={item.id} onClick={() => navigate(item.link)} className="flex items-center gap-4 py-3 hover:bg-gray-50 transition cursor-pointer rounded-lg px-2 -mx-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg shadow-sm ${item.bgColor}`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-bold truncate ${item.color}`}>
                      {item.isPinned && <span className="mr-1.5 text-[9px] bg-red-100 text-red-600 px-1.5 rounded border border-red-200 align-middle">FIXO</span>}
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{item.description}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{formatTimeAgo(item.date)}</span>
                </div>
              ))
            )}
          </div>
        )}
        
        {updates.length > 0 && (
          <div className="mt-5 text-center border-t border-gray-50 pt-3">
            <button onClick={() => navigate('/comunicados')} className="text-primary text-xs font-bold hover:underline">Ver todos os comunicados &rarr;</button>
          </div>
        )}
      </div>

      {/* Botão Flutuante Norma */}
      <button onClick={() => setIsChatOpen(true)} className="hidden md:flex fixed bottom-8 right-8 bg-gradient-to-r from-primary to-secondary text-white w-16 h-16 rounded-full shadow-xl hover:shadow-2xl items-center justify-center transition-transform transform hover:scale-110 z-50 border-4 border-white group">
        <span className="text-3xl group-hover:animate-pulse">🤖</span>
        <span className="absolute right-full mr-4 bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg pointer-events-none">Falar com Norma</span>
      </button>
      <Chatbot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

    </div>
  )
}

function DashboardCard({ icon, label, kpi, alert, onClick, accentColor }: { icon: string, label: string, kpi?: string, alert?: boolean, onClick: () => void, accentColor?: string }) {
  return (
    <div onClick={onClick} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 hover:shadow-md transition h-28 relative overflow-hidden group">
      {alert && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></span>}
      <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <span className="text-xs font-bold text-gray-800 leading-tight">{label}</span>
      {kpi && <span className={`text-[10px] font-semibold mt-1 truncate w-full px-1 ${accentColor || (alert ? 'text-red-500' : 'text-gray-400')}`}>{kpi}</span>}
    </div>
  )
}