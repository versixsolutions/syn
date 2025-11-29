import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Condominio } from '../types'

/**
 * Hook para carregar lista de condomínios (admin)
 * @function useCondominios
 * @returns {Object} Objeto contendo condominios e loading
 * @returns {Condominio[]} condominios - Array de condomínios
 * @returns {boolean} loading - Indica se os dados estão sendo carregados
 * @example
 * const { condominios } = useCondominios()
 * return condominios.map(c => <p>{c.name}</p>)
 */
export function useCondominios() {
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    loadCondominios()
  }, [])

  async function loadCondominios() {
    try {
      setLoading(true)
      setError(null)

      // A RLS para SELECT está como TRUE, então todos podem ler.
      const { data, error: queryError } = await supabase
        .from('condominios')
        .select('*')
        .order('name', { ascending: true })

      if (queryError) throw queryError

      setCondominios(data || [])

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro desconhecido ao carregar condomínios'))
    } finally {
      setLoading(false)
    }
  }

  return { condominios, loading, error, reload: loadCondominios }
}
