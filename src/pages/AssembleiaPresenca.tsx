import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAssembleias } from '../hooks/useAssembleias'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AssembleiaPresenca() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, session } = useAuth()
  const { registrarPresenca } = useAssembleias()

  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'ok'|'ja'|'erro'|'fora_status'>('ok')
  const [titulo, setTitulo] = useState<string>('')

  useEffect(() => {
    async function run() {
      if (!id) return
      setLoading(true)
      try {
        const { data: assembleia } = await supabase
          .from('assembleias')
          .select('titulo,status')
          .eq('id', id)
          .single()

        if (assembleia) {
          setTitulo(assembleia.titulo)
          if (assembleia.status !== 'em_andamento') {
            setStatus('fora_status')
            setLoading(false)
            return
          }
        }

        if (!session) {
          toast.error('Você precisa estar logado para registrar presença.')
          setLoading(false)
          return
        }
        const ok = await registrarPresenca(id)
        if (ok) {
          setStatus('ok')
        } else {
          setStatus('erro')
        }
      } catch (e) {
        setStatus('erro')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [id, registrarPresenca, session])

  if (loading) return <LoadingSpinner message="Registrando presença..." />

  return (
    <PageLayout title="Presença em Assembleia" subtitle={titulo || ''} icon="✅">
      <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-6 text-center" data-testid="presenca-page">
        {status === 'ok' && (
          <>
            <div className="text-4xl mb-2">🎉</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2" data-testid="presenca-status">Presença registrada com sucesso!</h3>
            <p className="text-gray-600 mb-6">Obrigado por confirmar sua presença.</p>
            <button onClick={()=>navigate(`/transparencia/assembleias/${id}`)} className="px-5 py-2 bg-purple-600 text-white rounded-lg font-bold" data-testid="presenca-voltar">Ir para a assembleia</button>
          </>
        )}
        {status === 'fora_status' && (
          <>
            <div className="text-4xl mb-2">ℹ️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2" data-testid="presenca-status">Registro indisponível</h3>
            <p className="text-gray-600">O registro de presença só é permitido durante a assembleia em andamento.</p>
          </>
        )}
        {status === 'erro' && (
          <>
            <div className="text-4xl mb-2">⚠️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2" data-testid="presenca-status">Não foi possível registrar</h3>
            <p className="text-gray-600 mb-6">Tente novamente pela página da assembleia.</p>
            <button onClick={()=>navigate(`/transparencia/assembleias/${id}`)} className="px-5 py-2 bg-gray-700 text-white rounded-lg font-bold" data-testid="presenca-voltar">Voltar</button>
          </>
        )}
      </div>
    </PageLayout>
  )
}
