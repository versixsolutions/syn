import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useDashboardStats } from '../../hooks/useDashboardStats'
import { formatCurrency } from '../../lib/utils'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext' // Importar contexto para verificar permissão de IA

export default function AdminDashboard() {
  const { stats } = useDashboardStats()
  const navigate = useNavigate()
  const { isAdmin } = useAuth() // Para verificar se pode ver o botão de IA
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  useEffect(() => {
    async function fetchPendingUsers() {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'pending')
      
      setPendingCount(count || 0)
    }
    fetchPendingUsers()
  }, [])

  const cards = [
    {
      title: 'Ocorrências Abertas',
      value: stats.ocorrencias.abertas,
      label: 'Aguardando atenção',
      icon: '🚨',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      link: '/admin/ocorrencias'
    },
    {
      title: 'Despesas do Mês',
      value: formatCurrency(stats.despesas.totalMes),
      label: stats.despesas.monthLabel,
      icon: '💰',
      color: 'text-green-600',
      bg: 'bg-green-50',
      link: '/admin/financeiro'
    },
    {
      title: 'Votações Ativas',
      value: stats.votacoes.ativas,
      label: 'Em andamento',
      icon: '🗳️',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      link: '/admin/votacoes'
    },
    {
      title: 'Aprovar Cadastros',
      value: pendingCount !== null ? pendingCount : '-', 
      label: pendingCount === 1 ? '1 pendente' : `${pendingCount || 0} pendentes`,
      icon: '👥',
      color: pendingCount && pendingCount > 0 ? 'text-red-600' : 'text-blue-600', 
      bg: pendingCount && pendingCount > 0 ? 'bg-red-50' : 'bg-blue-50',
      link: '/admin/usuarios'
    }
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-gray-500">Resumo das atividades do condomínio.</p>
      </div>

      <div className="
        flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-4 pb-4
        md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:pb-0 md:snap-none
        scrollbar-hide
      ">
        {cards.map((card) => (
          <div 
            key={card.title} 
            onClick={() => navigate(card.link)}
            className={`
              min-w-[260px] snap-center md:min-w-0
              bg-white p-6 rounded-xl shadow-sm border transition-all cursor-pointer
              ${card.title === 'Aprovar Cadastros' && (pendingCount || 0) > 0 ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'}
              hover:shadow-md hover:-translate-y-1
            `}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${card.bg}`}>
                {card.icon}
              </div>
              {card.title === 'Aprovar Cadastros' && (pendingCount || 0) > 0 && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">{card.title}</h3>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-4">Atalhos Operacionais</h3>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => navigate('/admin/comunicados')} 
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left text-sm font-medium text-gray-700 transition group"
            >
              <span className="group-hover:scale-110 inline-block transition-transform mr-2">📢</span> Criar Comunicado
            </button>
            
            <button 
              onClick={() => navigate('/admin/votacoes')} 
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left text-sm font-medium text-gray-700 transition group"
            >
              <span className="group-hover:scale-110 inline-block transition-transform mr-2">🗳️</span> Nova Assembleia
            </button>
            
            {/* Botão de IA só aparece se tiver a rota ou permissão, 
                mas como é um atalho, pode redirecionar para a gestão de conhecimento 
                ou uma página de FAQ Admin se houver */}
            {isAdmin && (
              <button 
                onClick={() => navigate('/admin/ia')} 
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left text-sm font-medium text-gray-700 transition group"
              >
                <span className="group-hover:scale-110 inline-block transition-transform mr-2">🧠</span> Treinar Chatbot
              </button>
            )}
            
            <button 
              onClick={() => navigate('/admin/financeiro')} 
              className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-left text-sm font-medium text-gray-700 transition group"
            >
              <span className="group-hover:scale-110 inline-block transition-transform mr-2">💰</span> Lançar Despesa
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-2">Inteligência Artificial</h3>
            <p className="text-blue-100 text-sm mb-4">A Norma respondeu a 45 dúvidas esta semana. Mantenha a base de conhecimento atualizada para melhorar as respostas.</p>
            
            {isAdmin && (
              <button 
                onClick={() => navigate('/admin/ia')}
                className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2"
              >
                <span>🧠</span> Ver logs da IA
              </button>
            )}
          </div>
          <div className="absolute -right-4 -bottom-8 text-9xl opacity-10 pointer-events-none">🤖</div>
        </div>
      </div>
    </div>
  )
}