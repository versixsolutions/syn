import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

/**
 * Hook para carregar votações (assembléias) do condomínio
 * @function useVotacoes
 * @returns {Object} Objeto contendo votações, loading, error e função votar
 * @returns {VotacaoWithStats[]} votacoes - Array de votações com estatísticas
 * @returns {boolean} loading - Indica se os dados estão sendo carregados
 * @returns {Error|null} error - Erro durante o carregamento, se houver
 * @returns {Function} votar - Função para registrar voto (com validação de duplicação em 3 níveis)
 * @example
 * const { votacoes, votar } = useVotacoes()
 * await votar(votacaoId, optionId) // retorna boolean indicando sucesso
 */

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
  user_vote_id?: number | null // ID da opção votada (para detecção de duplo voto)
  results?: Record<string, number> // Totais agregados da RPC
  user_already_voted?: boolean // Flag para blocar re-votação
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
            user_vote: userVoteText,
            user_vote_id: userVoteId,
            user_already_voted: !!userVoteId // ✅ Flag para blocar re-votação
          }
        })
      )

      setVotacoes(enrichedVotacoes)

    } catch (err) {
      console.error('Erro ao carregar votações:', err)
      setError(err instanceof Error ? err : new Error('Erro desconhecido'))
      toast.error('Erro ao carregar votações')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Votar em uma opção
   * ✅ Valida voto duplo antes de enviar
   * ✅ Trata erros específicos
   * ✅ Recarrega dados após sucesso
   */
  async function votar(votacaoId: string, optionId: number) {
    if (!user) {
      toast.error('Você precisa estar logado para votar')
      return false
    }

    try {
      // ✅ VALIDAÇÃO: Verificar voto duplo
      const votacao = votacoes.find(v => v.id === votacaoId)
      if (votacao?.user_already_voted) {
        toast.error('❌ Você já votou nesta pauta! Cada pessoa vota uma única vez.')
        return false
      }

      // ✅ VALIDAÇÃO: Votação aberta?
      if (votacao?.status !== 'ativa') {
        toast.error('❌ Esta votação foi encerrada. Não é mais possível votar.')
        return false
      }

      const toastLoading = toast.loading('Registrando seu voto...')
      
      const { error } = await supabase.from('votos').insert({
        votacao_id: votacaoId,
        user_id: user.id,
        option_id: optionId
      })
      
      if (error) {
        // ✅ Tratamento de erro: detectar constraint violation (voto duplo no banco)
        if (error.code === '23505') {
          toast.dismiss(toastLoading)
          toast.error('Você já votou nesta pauta!')
          return false
        }
        throw error
      }
      
      // ✅ Sucesso
      toast.dismiss(toastLoading)
      toast.success('✅ Seu voto foi registrado com sucesso!')
      
      // Recarregar para atualizar UI
      await loadVotacoes()
      return true
    } catch (err: any) {
      console.error('Erro ao votar:', err)
      toast.error(err.message || 'Erro ao registrar voto')
      return false
    }
  }

  return { votacoes, loading, error, reload: loadVotacoes, votar }
}