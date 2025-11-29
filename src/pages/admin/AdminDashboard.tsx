import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../../contexts/AdminContext'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatCurrency } from '../../lib/utils'

// Interface para os dados da tabela de saúde
interface CondominioHealth {
  id: string
  name: string
  slug: string
  total_users: number
  pending_users: number
  open_issues: number
  active_polls: number
  last_activity?: string
}

// Componente de Gráfico de Barras CSS (Financeiro)
const SimpleBarChart = ({ data }: { data: number[] }) => {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end justify-between h-32 gap-2 mt-4">
      {data.map((value, i) => (
        <div key={i} className="w-full flex flex-col items-center group">
          <div 
            className="w-full bg-indigo-200 rounded-t-md transition-all duration-500 group-hover:bg-indigo-500 relative"
            style={{ height: `${(value / max) * 100}%` }}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {formatCurrency(value)}
            </div>
          </div>
          <span className="text-[10px] text-gray-400 mt-1">M-{i+1}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { setSelectedCondominioId } = useAdmin()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCondominios: 0,
    totalUsers: 0,
    totalPending: 0,
    totalOpenIssues: 0,
    financialVolume: 0
  })
  const [condominioHealth, setCondominioHealth] = useState<CondominioHealth[]>([])

  // Mock de dados financeiros para o gráfico (Últimos 6 meses)
  // Em produção, isso viria de uma query agregada
  const financialTrend = [12500, 15000, 14200, 18000, 22000, stats.financialVolume || 25000]

  useEffect(() => {
    if (isAdmin) {
      loadGlobalStats()
    }
  }, [isAdmin])

  async function loadGlobalStats() {
    try {
      setLoading(true)

      // ✅ OTIMIZAÇÃO: Usar RPC ÚNICA em lugar de 40 queries
      const { data: healthData, error: healthError } = await supabase
        .rpc('get_condominios_health')

      if (healthError) throw healthError

      setCondominioHealth(healthData || [])

      // ✅ Calcular totais globais (dados já agregados pelo RPC)
      const totalUsers = (healthData || []).reduce((acc, curr) => acc + Number(curr.total_users), 0)
      const totalPending = (healthData || []).reduce((acc, curr) => acc + Number(curr.pending_users), 0)
      const totalOpenIssues = (healthData || []).reduce((acc, curr) => acc + Number(curr.open_issues), 0)

      // ✅ Contar condomínios
      const { count: totalCondominios } = await supabase
        .from('condominios')
        .select('*', { count: 'exact', head: true })

      // ✅ Volume Financeiro Global (com RPC)
      const { data: financialData } = await supabase
        .rpc('get_financial_summary', {
          start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        })

      const financialVolume = financialData?.[0]?.total_amount || 0

      setStats({
        totalCondominios: totalCondominios || 0,
        totalUsers,
        totalPending,
        totalOpenIssues,
        financialVolume: Number(financialVolume)
      })

    } catch (error) {
      console.error('❌ Erro ao carregar dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAccessCondominio = (id: string) => {
    setSelectedCondominioId(id)
    // Feedback visual de mudança de contexto
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <LoadingSpinner message="Carregando visão global..." />

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* Header Executivo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-indigo-900 p-6 rounded-2xl shadow-lg text-white">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">Olá, Super! 👋</h1>
          <p className="text-indigo-200 text-sm">Visão Macro da Plataforma Versix Norma.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="bg-indigo-800/50 p-3 rounded-lg backdrop-blur-sm border border-indigo-700">
            <p className="text-xs text-indigo-300 uppercase font-bold">Volume Mensal</p>
            <p className="text-xl font-bold text-green-400">{formatCurrency(stats.financialVolume)}</p>
          </div>
          <button
            onClick={() => navigate('/admin/condominios')}
            className="bg-white text-indigo-900 px-4 py-3 rounded-lg font-bold shadow-md hover:bg-indigo-50 transition flex items-center justify-center gap-2"
          >
            <span>🏢</span> Novo Condomínio
          </button>
        </div>
      </div>

      {/* 1. KPIs Globais (Grid Responsivo) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Condomínios */}
        <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden group hover:shadow-md transition">
          <div className="absolute right-0 top-0 p-3 opacity-10 text-4xl group-hover:scale-110 transition-transform">🏢</div>
          <p className="text-xs font-bold text-gray-400 uppercase">Condomínios</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.totalCondominios}</p>
          <p className="text-[10px] text-green-600 font-bold mt-1">Ativos na base</p>
        </div>

        {/* Usuários */}
        <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden group hover:shadow-md transition">
          <div className="absolute right-0 top-0 p-3 opacity-10 text-4xl group-hover:scale-110 transition-transform">👥</div>
          <p className="text-xs font-bold text-gray-400 uppercase">Usuários</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
          <p className="text-[10px] text-blue-600 font-bold mt-1">Total cadastrado</p>
        </div>

        {/* Pendências (Alerta) */}
        <div className={`bg-white p-4 md:p-5 rounded-xl shadow-sm border relative overflow-hidden group hover:shadow-md transition ${stats.totalPending > 0 ? 'border-red-200' : 'border-gray-200'}`}>
          <div className="absolute right-0 top-0 p-3 opacity-10 text-4xl group-hover:scale-110 transition-transform">⏳</div>
          <p className="text-xs font-bold text-gray-400 uppercase">Aprovações</p>
          <p className={`text-2xl md:text-3xl font-bold mt-1 ${stats.totalPending > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.totalPending}</p>
          <p className="text-[10px] text-gray-500 font-bold mt-1">Fila de espera</p>
          {stats.totalPending > 0 && <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
        </div>

        {/* Suporte */}
        <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 relative overflow-hidden group hover:shadow-md transition">
          <div className="absolute right-0 top-0 p-3 opacity-10 text-4xl group-hover:scale-110 transition-transform">🚨</div>
          <p className="text-xs font-bold text-gray-400 uppercase">Ocorrências</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.totalOpenIssues}</p>
          <p className="text-[10px] text-orange-600 font-bold mt-1">Abertas agora</p>
        </div>
      </div>

      {/* 2. Seção Gráfica e Tabela */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Esquerda: Financeiro */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-1">Volume Financeiro</h3>
          <p className="text-xs text-gray-500 mb-4">Movimentação estimada (6 meses)</p>
          <div className="h-px bg-gray-100 mb-4"></div>
          <SimpleBarChart data={financialTrend} />
          <div className="mt-4 text-center">
            <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
              +12% vs. mês anterior
            </span>
          </div>
        </div>

        {/* Coluna Direita: Tabela de Saúde */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-900">Saúde dos Condomínios</h3>
            <span className="text-xs font-bold bg-white border border-gray-200 px-2 py-1 rounded">
              {condominioHealth.length} clientes
            </span>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[10px] uppercase text-gray-400 font-bold border-b border-gray-100">
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3 text-center">Usuários</th>
                  <th className="px-5 py-3 text-center">Pendentes</th>
                  <th className="px-5 py-3 text-center">Ocorrências</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {condominioHealth.map((cond) => (
                  <tr key={cond.id} className="hover:bg-gray-50 transition group">
                    <td className="px-5 py-3">
                      <div className="font-bold text-gray-900">{cond.name}</div>
                      <div className="text-xs text-gray-400 font-mono">@{cond.slug}</div>
                    </td>
                    <td className="px-5 py-3 text-center font-medium text-gray-600">
                      {cond.total_users}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {cond.pending_users > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded text-xs font-bold bg-red-100 text-red-700">
                          {cond.pending_users}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {cond.open_issues > 0 ? (
                        <span className="text-orange-600 font-bold">{cond.open_issues}</span>
                      ) : (
                        <span className="text-green-500 text-xs">OK</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleAccessCondominio(cond.id)}
                        className="text-indigo-600 font-bold text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition"
                      >
                        Acessar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {condominioHealth.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              Nenhum condomínio cadastrado.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}