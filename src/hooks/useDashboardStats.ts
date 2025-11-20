import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface DashboardStats {
  faq: { answeredThisMonth: number }
  despesas: { 
    totalMes: number
    count: number
    monthLabel: string // Novo campo para mostrar o nome do mês
  }
  votacoes: { ativas: number; participation: number }
  ocorrencias: { abertas: number; em_andamento: number }
  comunicados: { nao_lidos: number }
}

const INITIAL_STATS: DashboardStats = {
  faq: { answeredThisMonth: 0 },
  despesas: { totalMes: 0, count: 0, monthLabel: 'mês atual' },
  votacoes: { ativas: 0, participation: 0 },
  ocorrencias: { abertas: 0, em_andamento: 0 },
  comunicados: { nao_lidos: 0 }
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS)
  const [loading, setLoading] = useState(true)
  const { profile, user } = useAuth()

  useEffect(() => {
    if (profile?.condominio_id) {
      loadStats()
    }
  }, [profile?.condominio_id, user?.id])

  async function loadStats() {
    try {
      setLoading(true)
      
      // 1. Lógica Inteligente de Despesas:
      // Primeiro, descobrimos qual é o último mês que tem dados
      const { data: latestExpense } = await supabase
        .from('despesas')
        .select('due_date')
        .order('due_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Define a data de referência (hoje ou a data da última despesa)
      let referenceDate = new Date()
      
      // Se a última despesa for anterior ao mês atual, usamos ela como referência
      // para não mostrar "R$ 0,00" vazio
      if (latestExpense?.due_date) {
        const lastExpenseDate = new Date(latestExpense.due_date)
        // Ajuste de fuso horário simples para garantir o mês correto
        lastExpenseDate.setMinutes(lastExpenseDate.getMinutes() + lastExpenseDate.getTimezoneOffset())
        
        if (lastExpenseDate < new Date()) {
            referenceDate = lastExpenseDate
        }
      }

      const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
      const endOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0)
      
      // Formata o nome do mês (ex: "novembro", "setembro")
      const monthLabel = referenceDate.toLocaleString('pt-BR', { month: 'long' })

      // Busca despesas desse mês de referência
      const { data: despesas } = await supabase
        .from('despesas')
        .select('amount')
        .gte('due_date', startOfMonth.toISOString())
        .lte('due_date', endOfMonth.toISOString())
      
      const totalDespesas = despesas?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

      // 2. Votações Ativas
      const now = new Date().toISOString()
      const { data: votacoes } = await supabase
        .from('votacoes')
        .select('id')
        .gt('end_date', now)
      
      // 3. Ocorrências por Status
      const { data: ocorrencias } = await supabase
        .from('ocorrencias')
        .select('status')
        .in('status', ['aberto', 'em_andamento'])

      const abertas = ocorrencias?.filter(o => o.status === 'aberto').length || 0
      const emAndamento = ocorrencias?.filter(o => o.status === 'em_andamento').length || 0

      // 4. FAQs
      const { count: faqCount } = await supabase
        .from('faqs')
        .select('*', { count: 'exact', head: true })

      // 5. Comunicados
      let unreadCount = 0
      if (user) {
        const { data: allComunicados } = await supabase.from('comunicados').select('id')
        const { data: reads } = await supabase
          .from('comunicado_reads')
          .select('comunicado_id')
          .eq('user_id', user.id)
        
        const readIds = new Set(reads?.map(r => r.comunicado_id) || [])
        unreadCount = allComunicados?.filter(c => !readIds.has(c.id)).length || 0
      }

      setStats({
        faq: { answeredThisMonth: faqCount || 0 },
        despesas: { 
          totalMes: totalDespesas, 
          count: despesas?.length || 0,
          monthLabel: monthLabel
        },
        votacoes: { 
          ativas: votacoes?.length || 0, 
          participation: 0 
        },
        ocorrencias: { 
          abertas, 
          em_andamento: emAndamento 
        },
        comunicados: {
          nao_lidos: unreadCount
        }
      })

    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  return { stats, loading, reload: loadStats }
}