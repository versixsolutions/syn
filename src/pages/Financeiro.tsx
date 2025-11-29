import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/utils'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

interface Despesa {
  id: string
  description: string
  amount: number
  category: string
  due_date: string
  paid_at: string | null
  receipt_url: string | null
  created_at: string
}

const CATEGORY_CONFIG: Record<string, any> = {
  'administrativa': { label: 'Administrativa', icon: '📁', color: 'bg-purple-100 text-purple-700', barColor: 'bg-purple-500' },
  'pessoal': { label: 'Pessoal', icon: '👥', color: 'bg-blue-100 text-blue-700', barColor: 'bg-blue-500' },
  'serviços': { label: 'Serviços', icon: '🛠️', color: 'bg-indigo-100 text-indigo-700', barColor: 'bg-indigo-500' },
  'manutenção': { label: 'Manutenção', icon: '🔧', color: 'bg-orange-100 text-orange-700', barColor: 'bg-orange-500' },
  'aquisições': { label: 'Aquisições', icon: '🛒', color: 'bg-green-100 text-green-700', barColor: 'bg-green-500' },
  'impostos': { label: 'Impostos', icon: '🏛️', color: 'bg-red-100 text-red-700', barColor: 'bg-red-500' },
  'financeira': { label: 'Financeira', icon: '🏦', color: 'bg-yellow-100 text-yellow-700', barColor: 'bg-yellow-500' },
  'default': { label: 'Outros', icon: '📝', color: 'bg-gray-100 text-gray-600', barColor: 'bg-gray-500' }
}

function getCategoryStyle(category: string | null) {
  if (!category) return CATEGORY_CONFIG.default
  const normalized = category.toLowerCase()
  const foundKey = Object.keys(CATEGORY_CONFIG).find(key => normalized.includes(key))
  return foundKey ? CATEGORY_CONFIG[foundKey] : CATEGORY_CONFIG.default
}

export default function Financeiro() {
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'open'>('all')
  const [selectedMonth, setSelectedMonth] = useState<string>('') 

  useEffect(() => {
    loadDespesas()
  }, [])

  async function loadDespesas() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('despesas')
        .select('*')
        .order('due_date', { ascending: false })

      if (error) throw error
      
      const loadedData = data || []
      setDespesas(loadedData)

      if (loadedData.length > 0 && !selectedMonth) {
        const mostRecentDate = loadedData[0].due_date
        const recentMonth = mostRecentDate.substring(0, 7)
        setSelectedMonth(recentMonth)
      } else if (!selectedMonth) {
        const now = new Date()
        setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
      }

    } catch (error) {
      console.error('Erro ao carregar despesas:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDespesas = useMemo(() => {
    return despesas.filter(d => {
      if (selectedCategory) {
        const style = getCategoryStyle(d.category)
        const selectedStyle = getCategoryStyle(selectedCategory)
        if (style.label !== selectedStyle.label) return false
      }

      if (statusFilter === 'paid' && !d.paid_at) return false
      if (statusFilter === 'open' && d.paid_at) return false

      if (selectedMonth) {
        const expenseMonth = d.due_date.substring(0, 7)
        if (expenseMonth !== selectedMonth) return false
      }

      return true
    })
  }, [despesas, selectedCategory, statusFilter, selectedMonth])

  const handleExport = () => {
    const headers = ['Descrição', 'Categoria', 'Vencimento', 'Valor', 'Status', 'Pago Em']
    const rows = filteredDespesas.map(d => [
      `"${d.description}"`,
      d.category,
      formatDate(d.due_date),
      d.amount.toFixed(2).replace('.', ','),
      d.paid_at ? 'Pago' : 'Pendente',
      d.paid_at ? formatDate(d.paid_at) : '-'
    ])

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    // Atualizado o nome do arquivo para versix_norma
    link.setAttribute("download", `prestacao_contas_versix_norma_${selectedMonth || 'geral'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const totalPago = filteredDespesas.filter(d => d.paid_at).reduce((sum, d) => sum + Number(d.amount), 0)
  const totalPendente = filteredDespesas.filter(d => !d.paid_at).reduce((sum, d) => sum + Number(d.amount), 0)

  const categoryData = useMemo(() => {
    const groups: Record<string, number> = {}
    let totalAmount = 0
    filteredDespesas.forEach(d => {
      const label = getCategoryStyle(d.category).label
      groups[label] = (groups[label] || 0) + Number(d.amount)
      totalAmount += Number(d.amount)
    })
    return Object.entries(groups)
      .map(([label, value]) => ({ label, value, percent: totalAmount ? (value / totalAmount) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [filteredDespesas])

  const historyData = useMemo(() => {
    const refDate = selectedMonth ? new Date(selectedMonth + '-02') : new Date()
    const months: Record<string, number> = {}
    const sixMonthsAgo = new Date(refDate.getFullYear(), refDate.getMonth() - 5, 1)

    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months[key] = 0
    }

    despesas.forEach(d => {
      const dueDate = d.due_date.substring(0, 7)
      if (months[dueDate] !== undefined) {
        months[dueDate] += Number(d.amount)
      }
    })

    return Object.entries(months).map(([key, value]) => {
      const [year, month] = key.split('-')
      const dateObj = new Date(Number(year), Number(month) - 1, 2)
      return {
        label: dateObj.toLocaleString('pt-BR', { month: 'short' }).toUpperCase(),
        value,
        fullDate: key
      }
    })
  }, [despesas, selectedMonth])

  const maxHistoryValue = Math.max(...historyData.map(d => d.value), 1)
  const availableCategories = Array.from(new Set(despesas.map(d => getCategoryStyle(d.category).label)))

  if (loading) return <LoadingSpinner message="Carregando balancete..." />

  return (
    <PageLayout
      title="Prestação de Contas"
      subtitle="Transparência financeira do condomínio"
      icon="⚖️"
      headerAction={
        <button 
          onClick={handleExport}
          className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-bold hover:bg-white/30 transition text-sm flex items-center gap-2 border border-white/30"
        >
          <span className="text-lg">📥</span> Exportar CSV
        </button>
      }
    >
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 sticky top-20 z-30">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-auto flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
            <span className="text-gray-500 pl-2">📅</span>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent border-none focus:ring-0 text-gray-700 font-medium text-sm py-1"/>
            <button onClick={() => setSelectedMonth('')} className="text-xs text-primary font-bold px-2 hover:underline" title="Ver todo o histórico">Ver Tudo</button>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
            {(['all', 'paid', 'open'] as const).map((status) => (
              <button key={status} onClick={() => setStatusFilter(status)} className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-xs font-bold transition ${statusFilter === status ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{status === 'all' ? 'Todos' : status === 'paid' ? 'Pagos' : 'Abertos'}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
          <button onClick={() => setSelectedCategory(null)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${!selectedCategory ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Todas Categorias</button>
          {availableCategories.map((catLabel) => {
            const configEntry = Object.values(CATEGORY_CONFIG).find(c => c.label === catLabel)
            const isSelected = selectedCategory === catLabel
            return (
              <button key={catLabel} onClick={() => setSelectedCategory(isSelected ? null : catLabel)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1 ${isSelected ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <span>{configEntry?.icon}</span> {catLabel}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">Balanço do Período</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-1">Total Pago</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPago)}</p>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: '100%' }}></div></div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">A Pagar / Pendente</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPendente)}</p>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2"><div className="bg-orange-400 h-1.5 rounded-full" style={{ width: totalPendente > 0 ? '100%' : '0%' }}></div></div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">{filteredDespesas.length} lançamentos encontrados</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">Evolução de Gastos (6 meses)</h3>
          <div className="flex-1 flex items-end justify-between gap-2 h-32 mt-2">
            {historyData.map((data) => {
              const isCurrentMonth = data.fullDate === selectedMonth
              const heightPercent = (data.value / maxHistoryValue) * 100
              return (
                <div key={data.label} className="flex flex-col items-center flex-1 group cursor-pointer" onClick={() => setSelectedMonth(data.fullDate)}>
                  <div className="relative w-full flex justify-center items-end h-full">
                    <div className="absolute -top-8 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{formatCurrency(data.value)}</div>
                    <div className={`w-full max-w-[24px] rounded-t-sm transition-all duration-500 ${isCurrentMonth ? 'bg-primary' : 'bg-gray-200 group-hover:bg-primary/50'}`} style={{ height: `${heightPercent}%` }}></div>
                  </div>
                  <span className={`text-[10px] mt-2 font-medium ${isCurrentMonth ? 'text-primary font-bold' : 'text-gray-400'}`}>{data.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">Onde gastamos mais?</h3>
          <div className="space-y-3">
            {categoryData.length > 0 ? (
              categoryData.map((cat) => {
                 const config = Object.values(CATEGORY_CONFIG).find(c => c.label === cat.label) || CATEGORY_CONFIG.default
                 return (
                  <div key={cat.label}>
                    <div className="flex justify-between text-xs mb-1"><span className="font-medium text-gray-700 flex items-center gap-1"><span>{config.icon}</span> {cat.label}</span><span className="text-gray-500">{Math.round(cat.percent)}%</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${config.barColor}`} style={{ width: `${cat.percent}%` }}></div></div>
                  </div>
                 )
              })
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">Sem dados para este período</div>
            )}
          </div>
        </div>
      </div>

      {filteredDespesas.length > 0 ? (
        <div className="space-y-3">
          {filteredDespesas.map((despesa) => {
            const style = getCategoryStyle(despesa.category)
            const isPaid = !!despesa.paid_at
            return (
              <div key={despesa.id} className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition relative group ${isPaid ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-orange-400'}`}>
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${style.iconBg} flex-shrink-0 text-lg sm:text-xl`}>{style.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                           <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${style.color.replace('text-', 'bg-').replace('100', '50')} ${style.color.split(' ')[1]}`}>{style.label}</span>
                           <span className="text-xs text-gray-400 whitespace-nowrap">• Venc: {formatDate(despesa.due_date)}</span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base line-clamp-1" title={despesa.description}>{despesa.description}</h3>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="block text-base sm:text-xl font-bold text-gray-900">{formatCurrency(Number(despesa.amount))}</span>
                      {isPaid ? <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✅ Pago</span> : <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">⏳ Aberto</span>}
                    </div>
                  </div>
                  {(despesa.receipt_url || isPaid) && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
                      {despesa.receipt_url ? (
                        <button className="flex items-center gap-1.5 text-primary text-xs sm:text-sm font-semibold hover:underline">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Comprovante
                        </button>
                      ) : (<span className="text-xs text-gray-300 italic"></span>)}
                      {isPaid && <span className="text-xs text-gray-500">Pago em: {formatDate(despesa.paid_at!)}</span>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState icon="📊" title="Nenhum lançamento encontrado" description="Não há despesas para exibir neste período." action={{ label: 'Limpar Filtros', onClick: () => { setSelectedCategory(null); setStatusFilter('all'); setSelectedMonth('') }}} />
      )}
    </PageLayout>
  )
}