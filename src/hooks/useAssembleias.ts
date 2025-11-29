import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import type { Assembleia, AssembleiaPresenca, AssembleiaPauta, AssembleiaVoto, ResultadoVotacao } from '../types'

/**
 * Hook para gerenciar assembleias
 * @function useAssembleias
 * @returns {Object} Objeto contendo assembleias, presenças, pautas e funções de gerenciamento
 */
export function useAssembleias() {
  const [assembleias, setAssembleias] = useState<Assembleia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { user, profile } = useAuth()
  const storage = supabase.storage.from('assembleias')

  // Carregar assembleias do condomínio
  const loadAssembleias = useCallback(async () => {
    if (!profile?.condominio_id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('assembleias')
        .select('*')
        .eq('condominio_id', profile.condominio_id)
        .order('data_hora', { ascending: false })

      if (err) throw err

      setAssembleias(data || [])
    } catch (err) {
      const error = err as Error
      setError(error)
      console.error('Erro ao carregar assembleias:', error)
    } finally {
      setLoading(false)
    }
  }, [profile?.condominio_id])

  useEffect(() => {
    loadAssembleias()
  }, [loadAssembleias])

  /**
   * Registrar presença em assembleia via link/QR code
   */
  const registrarPresenca = useCallback(
    async (assembleiaId: string): Promise<boolean> => {
      if (!user) {
        toast.error('❌ Você precisa estar logado')
        return false
      }

      try {
        // Verificar se já registrou presença
        const { data: existing } = await supabase
          .from('assembleias_presencas')
          .select('id')
          .eq('assembleia_id', assembleiaId)
          .eq('user_id', user.id)
          .single()

        if (existing) {
          toast.info('ℹ️ Presença já registrada')
          return true
        }

        const { error: err } = await supabase
          .from('assembleias_presencas')
          .insert({
            assembleia_id: assembleiaId,
            user_id: user.id,
          })

        if (err) throw err

        toast.success('✅ Presença registrada com sucesso!')
        return true
      } catch (err) {
        const error = err as Error
        toast.error(`❌ Erro ao registrar presença: ${error.message}`)
        console.error('Erro ao registrar presença:', error)
        return false
      }
    },
    [user]
  )

  /**
   * Votar em uma pauta
   */
  const votar = useCallback(
    async (pautaId: string, voto: string): Promise<boolean> => {
      if (!user) {
        toast.error('❌ Você precisa estar logado')
        return false
      }

      try {
        // Verificar se já votou
        const { data: existing } = await supabase
          .from('assembleias_votos')
          .select('id')
          .eq('pauta_id', pautaId)
          .eq('user_id', user.id)
          .single()

        if (existing) {
          toast.error('❌ Você já votou nesta pauta')
          return false
        }

        const { error: err } = await supabase
          .from('assembleias_votos')
          .insert({
            pauta_id: pautaId,
            user_id: user.id,
            voto: voto,
          })

        if (err) throw err

        toast.success('✅ Voto registrado com sucesso!')
        return true
      } catch (err) {
        const error = err as Error
        toast.error(`❌ Erro ao votar: ${error.message}`)
        console.error('Erro ao votar:', error)
        return false
      }
    },
    [user]
  )

  /**
   * Carregar presenças de uma assembleia
   */
  const loadPresencas = useCallback(async (assembleiaId: string): Promise<AssembleiaPresenca[]> => {
    try {
      const { data, error: err } = await supabase
        .from('assembleias_presencas')
        .select(`
          *,
          user:user_id (
            full_name,
            unit_number
          )
        `)
        .eq('assembleia_id', assembleiaId)
        .order('registrado_em', { ascending: true })

      if (err) throw err

      return data || []
    } catch (err) {
      console.error('Erro ao carregar presenças:', err)
      return []
    }
  }, [])

  /**
   * Carregar pautas de uma assembleia
   */
  const loadPautas = useCallback(async (assembleiaId: string): Promise<AssembleiaPauta[]> => {
    try {
      const { data, error: err } = await supabase
        .from('assembleias_pautas')
        .select('*')
        .eq('assembleia_id', assembleiaId)
        .order('ordem', { ascending: true })

      if (err) throw err

      return data || []
    } catch (err) {
      console.error('Erro ao carregar pautas:', err)
      return []
    }
  }, [])

  /**
   * Carregar resultados de uma pauta
   */
  const loadResultados = useCallback(async (pautaId: string): Promise<ResultadoVotacao | null> => {
    try {
      const { data: pauta, error: pautaErr } = await supabase
        .from('assembleias_pautas')
        .select('*')
        .eq('id', pautaId)
        .single()

      if (pautaErr) throw pautaErr

      const { data: votos, error: votosErr } = await supabase
        .from('assembleias_votos')
        .select('voto')
        .eq('pauta_id', pautaId)

      if (votosErr) throw votosErr

      // Computar resultados
      const totalVotos = votos.length
      const contagem: Record<string, number> = {}

      votos.forEach((v) => {
        contagem[v.voto] = (contagem[v.voto] || 0) + 1
      })

      const resultados = pauta.opcoes.map((opcao: string) => ({
        opcao,
        votos: contagem[opcao] || 0,
        percentual: totalVotos > 0 ? ((contagem[opcao] || 0) / totalVotos) * 100 : 0,
      }))

      // Determinar vencedor (maior número de votos)
      const vencedor = resultados.reduce((prev, curr) =>
        curr.votos > prev.votos ? curr : prev
      ).opcao

      return {
        pauta_id: pautaId,
        titulo: pauta.titulo,
        total_votos: totalVotos,
        resultados,
        vencedor: totalVotos > 0 ? vencedor : null,
      }
    } catch (err) {
      console.error('Erro ao carregar resultados:', err)
      return null
    }
  }, [])

  // =========================
  // Funções Admin (CRUD)
  // =========================

  const createAssembleia = useCallback(async (payload: {
    titulo: string
    data_hora: string
    edital_topicos: string[]
    edital_pdf_file?: File | null
  }): Promise<Assembleia | null> => {
    if (!profile?.condominio_id) {
      toast.error('Condomínio não identificado')
      return null
    }

    try {
      const { data, error: err } = await supabase
        .from('assembleias')
        .insert({
          condominio_id: profile.condominio_id,
          titulo: payload.titulo,
          data_hora: payload.data_hora,
          status: 'agendada',
          edital_topicos: payload.edital_topicos,
        })
        .select('*')
        .single()

      if (err) throw err

      let updated = data as Assembleia

      if (payload.edital_pdf_file) {
        const path = `edital/${updated.id}-${Date.now()}-${payload.edital_pdf_file.name}`
        const up = await storage.upload(path, payload.edital_pdf_file, { upsert: true })
        if (up.error) throw up.error
        const publicUrl = storage.getPublicUrl(path).data.publicUrl
        const { data: upd, error: updErr } = await supabase
          .from('assembleias')
          .update({ edital_pdf_url: publicUrl })
          .eq('id', updated.id)
          .select('*')
          .single()
        if (updErr) throw updErr
        updated = upd as Assembleia
      }

      toast.success('Assembleia criada')
      await loadAssembleias()
      return updated
    } catch (err) {
      console.error('Erro ao criar assembleia:', err)
      toast.error('Erro ao criar assembleia')
      return null
    }
  }, [profile?.condominio_id, storage, loadAssembleias])

  const updateAssembleia = useCallback(async (id: string, updates: Partial<Pick<Assembleia,
    'titulo'|'data_hora'|'status'|'edital_topicos'|'ata_topicos'>> & {
      edital_pdf_file?: File | null
      ata_pdf_file?: File | null
    }): Promise<boolean> => {
    try {
      const { edital_pdf_file, ata_pdf_file, ...fields } = updates
      if (Object.keys(fields).length) {
        const { error: err } = await supabase
          .from('assembleias')
          .update(fields)
          .eq('id', id)
        if (err) throw err
      }

      if (edital_pdf_file) {
        const path = `edital/${id}-${Date.now()}-${edital_pdf_file.name}`
        const up = await storage.upload(path, edital_pdf_file, { upsert: true })
        if (up.error) throw up.error
        const publicUrl = storage.getPublicUrl(path).data.publicUrl
        const { error: updErr } = await supabase
          .from('assembleias')
          .update({ edital_pdf_url: publicUrl })
          .eq('id', id)
        if (updErr) throw updErr
      }

      if (ata_pdf_file) {
        const path = `ata/${id}-${Date.now()}-${ata_pdf_file.name}`
        const up = await storage.upload(path, ata_pdf_file, { upsert: true })
        if (up.error) throw up.error
        const publicUrl = storage.getPublicUrl(path).data.publicUrl
        const { error: updErr } = await supabase
          .from('assembleias')
          .update({ ata_pdf_url: publicUrl })
          .eq('id', id)
        if (updErr) throw updErr
      }

      toast.success('Assembleia atualizada')
      await loadAssembleias()
      return true
    } catch (err) {
      console.error('Erro ao atualizar assembleia:', err)
      toast.error('Erro ao atualizar assembleia')
      return false
    }
  }, [storage, loadAssembleias])

  const deleteAssembleia = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error: err } = await supabase.from('assembleias').delete().eq('id', id)
      if (err) throw err
      toast.success('Assembleia excluída')
      await loadAssembleias()
      return true
    } catch (err) {
      console.error('Erro ao excluir assembleia:', err)
      toast.error('Erro ao excluir assembleia')
      return false
    }
  }, [loadAssembleias])

  const setStatusAssembleia = useCallback(async (id: string, status: Assembleia['status']): Promise<boolean> => {
    try {
      const fields: any = { status }
      if (status === 'em_andamento') fields.iniciada_em = new Date().toISOString()
      if (status === 'encerrada') fields.encerrada_em = new Date().toISOString()
      const { error: err } = await supabase.from('assembleias').update(fields).eq('id', id)
      if (err) throw err
      toast.success('Status atualizado')
      await loadAssembleias()
      return true
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      toast.error('Erro ao atualizar status')
      return false
    }
  }, [loadAssembleias])

  // Pautas
  const addPauta = useCallback(async (assembleiaId: string, payload: Omit<AssembleiaPauta, 'id'|'created_at'|'votacao_iniciada_em'|'votacao_encerrada_em'|'status'> & { status?: AssembleiaPauta['status'] }): Promise<boolean> => {
    try {
      const { error: err } = await supabase.from('assembleias_pautas').insert({
        assembleia_id: assembleiaId,
        titulo: payload.titulo,
        descricao: payload.descricao,
        ordem: payload.ordem,
        tipo_votacao: payload.tipo_votacao,
        opcoes: payload.opcoes,
        status: payload.status || 'pendente',
      })
      if (err) throw err
      toast.success('Pauta adicionada')
      return true
    } catch (err) {
      console.error('Erro ao adicionar pauta:', err)
      toast.error('Erro ao adicionar pauta')
      return false
    }
  }, [])

  const updatePauta = useCallback(async (pautaId: string, updates: Partial<Pick<AssembleiaPauta, 'titulo'|'descricao'|'ordem'|'tipo_votacao'|'opcoes'|'status'>>): Promise<boolean> => {
    try {
      const { error: err } = await supabase.from('assembleias_pautas').update(updates).eq('id', pautaId)
      if (err) throw err
      toast.success('Pauta atualizada')
      return true
    } catch (err) {
      console.error('Erro ao atualizar pauta:', err)
      toast.error('Erro ao atualizar pauta')
      return false
    }
  }, [])

  const deletePauta = useCallback(async (pautaId: string): Promise<boolean> => {
    try {
      const { error: err } = await supabase.from('assembleias_pautas').delete().eq('id', pautaId)
      if (err) throw err
      toast.success('Pauta excluída')
      return true
    } catch (err) {
      console.error('Erro ao excluir pauta:', err)
      toast.error('Erro ao excluir pauta')
      return false
    }
  }, [])

  const abrirVotacao = useCallback(async (pautaId: string): Promise<boolean> => {
    try {
      const { error: err } = await supabase.from('assembleias_pautas').update({ status: 'em_votacao', votacao_iniciada_em: new Date().toISOString() }).eq('id', pautaId)
      if (err) throw err
      toast.success('Votação aberta')
      return true
    } catch (err) {
      console.error('Erro ao abrir votação:', err)
      toast.error('Erro ao abrir votação')
      return false
    }
  }, [])

  const encerrarVotacao = useCallback(async (pautaId: string): Promise<boolean> => {
    try {
      const { error: err } = await supabase.from('assembleias_pautas').update({ status: 'encerrada', votacao_encerrada_em: new Date().toISOString() }).eq('id', pautaId)
      if (err) throw err
      toast.success('Votação encerrada')
      return true
    } catch (err) {
      console.error('Erro ao encerrar votação:', err)
      toast.error('Erro ao encerrar votação')
      return false
    }
  }, [])

  return {
    assembleias,
    loading,
    error,
    registrarPresenca,
    votar,
    loadPresencas,
    loadPautas,
    loadResultados,
    reload: loadAssembleias,
    // admin
    createAssembleia,
    updateAssembleia,
    deleteAssembleia,
    setStatusAssembleia,
    addPauta,
    updatePauta,
    deletePauta,
    abrirVotacao,
    encerrarVotacao,
  }
}
