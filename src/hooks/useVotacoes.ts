import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Interfaces atualizadas para refletir o retorno da RPC
export interface VotacaoWithStats {
  id: string
  title: string
  description: string
  status: 'ativa' | 'encerrada'
  start_date: string
  end_date: string
  total_voters: number
  is_secret: boolean
  options: Array<{ id: number; text: string }>
  user_vote?: string | null // O voto do usuário logado (se houver)
  results?: Record<string, number> // Totais agregados da RPC
}

export function useVotacoes(filter: 'all' | 'ativa' | 'encerrada' = 'all') {
  const [votacoes, setVotacoes] = useState<VotacaoWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user, profile } = useAuth()

  useEffect(() => {
    if (profile?.condominio_id) {
      loadVotacoes()
    }
  }, [filter, profile?.condominio_id])

  async function loadVotacoes() {
    try {
      setLoading(true)
      setError(null)

      // 1. Buscar definições das votações
      let query = supabase
        .from('votacoes')
        .select('*')
        .eq('condominio_id', profile?.condominio_id) // Filtro de segurança (redundante com RLS mas boa prática)
        .order('end_date', { ascending: false })

      const { data: votacoesData, error: votacoesError } = await query
      if (votacoesError) throw votacoesError

      const now = new Date()

      // 2. Para cada votação, buscar resultados seguros e voto do usuário
      const enrichedVotacoes = await Promise.all(
        (votacoesData || []).map(async (v) => {
          const status = new Date(v.end_date) > now ? 'ativa' : 'encerrada'
          
          // Buscar Resultados via RPC (Função Segura)
          // A função get_votacao_results retorna um JSON { "1": 10, "2": 5 } onde chave é option_id
          const { data: resultsData } = await supabase
            .rpc('get_votacao_results', { votacao_uuid: v.id })

          // Buscar se o usuário atual já votou (permitido pela RLS "Ver próprio voto")
          let userVoteId = null
          if (user) {
            const { data: myVote } = await supabase
              .from('votos')
              .select('option_id')
              .eq('votacao_id', v.id)
              .eq('user_id', user.id)
              .maybeSingle()
            
            if (myVote) userVoteId = myVote.option_id
          }

          // Mapear ID da opção para Texto para facilitar no frontend
          const userVoteText = userVoteId 
            ? v.options.find((o: any) => o.id === userVoteId)?.text 
            : null

          return {
            ...v,
            status,
            results: resultsData || {},
            user_vote: userVoteText
          }
        })
      )

      setVotacoes(enrichedVotacoes)

    } catch (err) {
      console.error('Erro ao carregar votações:', err)
      setError(err instanceof Error ? err : new Error('Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  async function votar(votacaoId: string, optionId: number) {
    if (!user) return
    try {
      const { error } = await supabase.from('votos').insert({
        votacao_id: votacaoId,
        user_id: user.id,
        option_id: optionId
      })
      
      if (error) throw error
      
      // Recarregar para atualizar UI
      await loadVotacoes()
      return true
    } catch (err: any) {
      console.error('Erro ao votar:', err)
      throw err
    }
  }

  return { votacoes, loading, error, reload: loadVotacoes, votar }
}