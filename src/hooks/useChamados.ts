import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

/**
 * Interface para um chamado de suporte
 * @interface Chamado
 * @property {string} id - ID único do chamado
 * @property {string} user_id - ID do usuário que criou
 * @property {string} subject - Assunto do chamado
 * @property {string} description - Descrição/conteúdo
 * @property {'aberto'|'em_andamento'|'resolvido'|'fechado'} status - Status atual
 * @property {string|null} response - Resposta do administrador
 * @property {string} created_at - Data de criação
 * @property {string|null} updated_at - Última atualização
 * @property {string|null} closed_at - Data de fechamento
 */
export interface Chamado {
  id: string
  user_id: string
  subject: string
  description: string
  status: 'aberto' | 'em_andamento' | 'resolvido' | 'fechado'
  response: string | null
  created_at: string
  updated_at: string | null
  closed_at: string | null
}

/**
 * Hook para gerenciar chamados de suporte
 * @function useChamados
 * @returns {Object} Objeto contendo chamados, loading, error e funções
 * @returns {Chamado[]} chamados - Array de chamados do usuário
 * @returns {boolean} loading - Indica se os dados estão sendo carregados
 * @returns {Error|null} error - Erro durante o carregamento, se houver
 * @returns {Function} criarChamado - Função para criar novo chamado
 * @returns {Function} atualizarStatus - Função para atualizar status
 * @returns {Function} fecharChamado - Função para fechar um chamado
 * @example
 * const { chamados, criarChamado } = useChamados()
 * await criarChamado({ subject: 'Problema', description: '...' })
 */
export function useChamados() {
  const [chamados, setChamados] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user } = useAuth()

  // Carregar chamados do usuário
  const loadChamados = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('chamados')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (err) throw err

      setChamados(data || [])
    } catch (err) {
      const error = err as Error
      setError(error)
      console.error('Erro ao carregar chamados:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Carregar ao montar componente
  useEffect(() => {
    loadChamados()

    // Subscribe para atualizações em tempo real
    if (!user) return

    const subscription = supabase
      .channel('chamados-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chamados',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Chamado atualizado:', payload)
          if (payload.eventType === 'INSERT') {
            setChamados((prev) => [payload.new as Chamado, ...prev])
            toast.success('✅ Chamado criado com sucesso!')
          } else if (payload.eventType === 'UPDATE') {
            setChamados((prev) =>
              prev.map((c) =>
                c.id === payload.new.id ? (payload.new as Chamado) : c
              )
            )
            // Notificar se houver resposta
            if (payload.old.response !== payload.new.response && payload.new.response) {
              toast.success('💬 Você recebeu uma resposta do síndico!')
            }
            // Notificar se status mudou
            if (payload.old.status !== payload.new.status) {
              toast.info(`📋 Status do chamado: ${payload.new.status}`)
            }
          } else if (payload.eventType === 'DELETE') {
            setChamados((prev) => prev.filter((c) => c.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, loadChamados])

  /**
   * Criar novo chamado
   * @param {Object} data - Dados do chamado
   * @param {string} data.subject - Assunto
   * @param {string} data.description - Descrição
   * @returns {Promise<boolean>} True se sucesso
   */
  const criarChamado = useCallback(
    async (data: { subject: string; description: string }): Promise<boolean> => {
      if (!user) {
        toast.error('❌ Você precisa estar logado')
        return false
      }

      try {
        const { error: err } = await supabase.from('chamados').insert({
          user_id: user.id,
          subject: data.subject,
          description: data.description,
          status: 'aberto',
        })

        if (err) throw err

        return true
      } catch (err) {
        const error = err as Error
        toast.error(`❌ Erro ao criar chamado: ${error.message}`)
        console.error('Erro ao criar chamado:', error)
        return false
      }
    },
    [user]
  )

  /**
   * Atualizar status de um chamado
   * @param {string} chamadoId - ID do chamado
   * @param {'aberto'|'em_andamento'|'resolvido'|'fechado'} novoStatus - Novo status
   * @returns {Promise<boolean>} True se sucesso
   */
  const atualizarStatus = useCallback(
    async (
      chamadoId: string,
      novoStatus: 'aberto' | 'em_andamento' | 'resolvido' | 'fechado'
    ): Promise<boolean> => {
      try {
        const { error: err } = await supabase
          .from('chamados')
          .update({
            status: novoStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', chamadoId)
          .eq('user_id', user?.id)

        if (err) throw err

        toast.success(`✅ Status atualizado para ${novoStatus}`)
        return true
      } catch (err) {
        const error = err as Error
        toast.error(`❌ Erro ao atualizar: ${error.message}`)
        console.error('Erro ao atualizar chamado:', error)
        return false
      }
    },
    [user?.id]
  )

  /**
   * Fechar um chamado
   * @param {string} chamadoId - ID do chamado
   * @returns {Promise<boolean>} True se sucesso
   */
  const fecharChamado = useCallback(
    async (chamadoId: string): Promise<boolean> => {
      try {
        const { error: err } = await supabase
          .from('chamados')
          .update({
            status: 'fechado',
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', chamadoId)
          .eq('user_id', user?.id)

        if (err) throw err

        toast.success('✅ Chamado fechado')
        return true
      } catch (err) {
        const error = err as Error
        toast.error(`❌ Erro ao fechar: ${error.message}`)
        console.error('Erro ao fechar chamado:', error)
        return false
      }
    },
    [user?.id]
  )

  return {
    chamados,
    loading,
    error,
    criarChamado,
    atualizarStatus,
    fecharChamado,
    reload: loadChamados,
  }
}
