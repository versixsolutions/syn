import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
// CORREÇÃO DE ERRO 1: O logo é referenciado como um caminho absoluto (public folder)
// em vez de um import, para evitar erros de build se o arquivo não existir em src/assets.
// ATUALIZAÇÃO: Caminho do logo alterado para 'logo.png' que você enviou.
// Certifique-se que o ficheiro 'logo.png' está em 'public/assets/logos/logo.png'
const logo = '/assets/logos/versix-solutions-logo.png'

// CORREÇÃO DE ERRO 7: Revertendo para '../contexts/AuthContext'
// Este era o caminho no seu ficheiro original.
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { signIn } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      // Redireciona para a página inicial (Dashboard)
      // O Dashboard usará o profile.condominio_name para exibir o nome do condomínio.
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    // O gradiente de fundo já estava correto! (from-primary to-secondary)
    <div className="min-h-screen bg-gradient-to-br from-primary to-secondary flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          {/* Substituído o <div> de emoji pelo logo do Pinheiro Park */}
          {/* ATUALIZAÇÃO: Tamanho aumentado de w-20 h-20 para w-40 e h-auto para manter a proporção */}
          <img
            src={logo}
            alt="Versix Meu Condominio"
            className="w-40 h-auto mx-auto mb-4"
          />
          {/* Título atualizado para Pinheiro Park */}
          <h1 className="text-3xl font-bold text-gray-900">Meu Condomínio</h1>
          <p className="text-gray-600 mt-2">Versix - Gestão à vista. Confiança total.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              // Anel de foco atualizado (purple-500 -> primary)
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              // Anel de foco atualizado (purple-500 -> primary)
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            // Gradiente do botão atualizado (purple/blue -> primary/secondary)
            className="w-full bg-gradient-to-r from-primary to-secondary text-white py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* REMOÇÃO: A div de contas de teste foi removida conforme solicitado.
        */}

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Não tem conta?{' '}
          {/* Cor do link atualizada (purple-600 -> primary) */}
          <Link to="/signup" className="text-primary font-semibold hover:text-primary-dark">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}