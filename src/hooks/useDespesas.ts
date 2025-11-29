import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Despesa } from '../types'

/**
 * Hook para carregar despesas (finances) do condomínio
 * @function useDespesas
 * @returns {Object} Objeto contendo despesas, loading e error
 * @returns {Despesa[]} despesas - Array de despesas com descrição, valor e categoria
 * @returns {boolean} loading - Indica se os dados estão sendo carregados
 * @returns {string|null} error - Mensagem de erro, se houver
 * @example
 * const { despesas, loading } = useDespesas()
 * if (!loading) despesas.map(d => <p>{d.description}: R$ {d.amount}</p>)
 */
export function useDespesas() {
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDespesas()
  }, [])

  async function loadDespesas() {
    try {
      setLoading(true)
      setError(null)

      // Ajustado para o Schema Real:
      // - description (ao invés de title)
      // - category (texto simples)
      const { data, error: queryError } = await supabase
        .from('despesas')
        .select(`
          id,
          description,
          amount,
          due_date,
          paid_at,
          category,
          created_at,
          author_id
        `)
        .order('due_date', { ascending: false })

      if (queryError) throw queryError

      setDespesas(data || [])
    } catch (err: any) {
      console.error('Erro ao carregar despesas:', err)
      setError(err.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  return { despesas, loading, error, reload: loadDespesas }
}