import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCondominios } from '../hooks/useCondominios'
import { signupSchema, type SignupFormData } from '../lib/schemas'
import type { Condominio } from '../types'
import { ZodError } from 'zod'

const logo = '/assets/logos/versix-solutions-logo.png'

// Componente de Card Selecionável para Titularidade
const ResidentTypeCard = ({ 
  type, 
  label, 
  icon, 
  selected, 
  onClick 
}: { 
  type: string, 
  label: string, 
  icon: string, 
  selected: boolean, 
  onClick: () => void 
}) => (
  <div 
    onClick={onClick}
    className={`
      flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200
      ${selected 
        ? 'border-primary bg-blue-50/50 text-primary shadow-sm scale-[1.02]' 
        : 'border-gray-200 bg-white text-gray-500 hover:border-blue-200 hover:bg-gray-50'}
    `}
  >
    <span className="text-2xl mb-1">{icon}</span>
    <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
  </div>
)

export default function Signup() {
  const [formData, setFormData] = useState<SignupFormData>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    condominioId: '',
    residentType: 'titular',
    unitNumber: '',
    block: '',
    phone: '',
    isWhatsapp: true
  })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignedUp, setIsSignedUp] = useState(false)
  const [availableBlocks, setAvailableBlocks] = useState<string[]>([])

  const { signUp } = useAuth()
  const { condominios, loading: loadingCondominios } = useCondominios()

  // Atualiza blocos disponíveis quando condomínio muda
  useEffect(() => {
    if (formData.condominioId) {
      const selectedCondo = condominios.find(c => c.id === formData.condominioId)
      const blocksConfig = selectedCondo?.theme_config?.structure?.blocks || []
      setAvailableBlocks(blocksConfig)
    } else {
      setAvailableBlocks([])
    }
  }, [formData.condominioId, condominios])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 11) value = value.slice(0, 11)
    if (value.length > 2) value = `(${value.substring(0, 2)}) ${value.substring(2)}`
    if (value.length > 10) value = `${value.substring(0, 10)}-${value.substring(10)}`
    
    setFormData(prev => ({ ...prev, phone: value }))
    if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError('')
    setFieldErrors({})
    setLoading(true)

    try {
      const validData = signupSchema.parse(formData)

      await signUp(validData)
      
      setIsSignedUp(true)

    } catch (err: any) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {}
        err.errors.forEach(error => {
          if (error.path[0]) errors[error.path[0] as string] = error.message
        })
        setFieldErrors(errors)
      } else {
        setGeneralError(err.message || 'Erro ao criar conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (isSignedUp) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-secondary flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center animate-fade-in">
          <div className="text-center mb-8">
            <img src={logo} alt="Versix" className="w-40 h-auto mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900">Quase lá!</h1>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-semibold">Sua conta foi criada com sucesso!</p>
            <p className="text-green-700 mt-2 text-sm">
              Aguarde a <strong>aprovação do síndico</strong> para acessar o sistema. Você receberá um e-mail quando seu acesso for liberado.
            </p>
          </div>
          <Link to="/login" className="w-full inline-block bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary-dark transition">
            Voltar para o Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-secondary flex items-center justify-center p-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 md:p-8 animate-fade-in my-4">
        <div className="text-center mb-6">
          <img src={logo} alt="Versix" className="w-32 h-auto mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-900">Meu Condomínio</h1>
          <p className="text-gray-600 text-sm">Crie sua conta de morador</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {generalError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm text-center">{generalError}</p>
            </div>
          )}

          {/* 1. Nome e Sobrenome (Grid) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nome</label>
              <input
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none ${fieldErrors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="João"
              />
              {fieldErrors.firstName && <p className="text-red-500 text-[10px] mt-1">{fieldErrors.firstName}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Sobrenome</label>
              <input
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none ${fieldErrors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Silva"
              />
              {fieldErrors.lastName && <p className="text-red-500 text-[10px] mt-1">{fieldErrors.lastName}</p>}
            </div>
          </div>

          {/* 2. Condomínio */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Condomínio</label>
            <select
              name="condominioId"
              value={formData.condominioId}
              onChange={handleChange}
              disabled={loadingCondominios}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white ${fieldErrors.condominioId ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="" disabled>
                {loadingCondominios ? 'Carregando...' : 'Selecione seu condomínio'}
              </option>
              {condominios.map((cond: Condominio) => (
                <option key={cond.id} value={cond.id}>{cond.name}</option>
              ))}
            </select>
            {fieldErrors.condominioId && <p className="text-red-500 text-xs mt-1">{fieldErrors.condominioId}</p>}
          </div>

          {/* 3. Tipo de Morador (Seleção Visual) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Eu sou:</label>
            <div className="grid grid-cols-3 gap-2">
              <ResidentTypeCard 
                type="titular" 
                label="Titular" 
                icon="🔑" 
                selected={formData.residentType === 'titular'}
                onClick={() => setFormData(p => ({ ...p, residentType: 'titular' }))}
              />
              <ResidentTypeCard 
                type="inquilino" 
                label="Inquilino" 
                icon="📄" 
                selected={formData.residentType === 'inquilino'}
                onClick={() => setFormData(p => ({ ...p, residentType: 'inquilino' }))}
              />
              <ResidentTypeCard 
                type="morador" 
                label="Morador" 
                icon="🏠" 
                selected={formData.residentType === 'morador'}
                onClick={() => setFormData(p => ({ ...p, residentType: 'morador' }))}
              />
            </div>
          </div>

          {/* 4. Endereço (Bloco e Unidade) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Bloco / Rua</label>
              {availableBlocks.length > 0 ? (
                <select
                  name="block"
                  value={formData.block}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white ${fieldErrors.block ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Selecione</option>
                  {availableBlocks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              ) : (
                <input
                  name="block"
                  type="text"
                  value={formData.block}
                  onChange={handleChange}
                  placeholder="Bl 01"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none ${fieldErrors.block ? 'border-red-500' : 'border-gray-300'}`}
                />
              )}
              {fieldErrors.block && <p className="text-red-500 text-[10px] mt-1">{fieldErrors.block}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nº Unidade</label>
              <input
                name="unitNumber"
                type="text"
                value={formData.unitNumber}
                onChange={handleChange}
                placeholder="Ex: 102"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none ${fieldErrors.unitNumber ? 'border-red-500' : 'border-gray-300'}`}
              />
              {fieldErrors.unitNumber && <p className="text-red-500 text-[10px] mt-1">{fieldErrors.unitNumber}</p>}
            </div>
          </div>

          {/* 5. Contato */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Celular / WhatsApp</label>
            <input
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handlePhoneChange}
              placeholder="(99) 99999-9999"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none ${fieldErrors.phone ? 'border-red-500' : 'border-gray-300'}`}
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input 
                type="checkbox"
                checked={formData.isWhatsapp}
                onChange={(e) => setFormData(prev => ({ ...prev, isWhatsapp: e.target.checked }))}
                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              />
              <span className="text-xs text-gray-600">Este número é WhatsApp</span>
            </label>
          </div>

          {/* 6. Login */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Email</label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none ${fieldErrors.email ? 'border-red-500' : 'border-gray-300'}`}
            />
            {fieldErrors.email && <p className="text-red-500 text-[10px] mt-1">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Senha</label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none ${fieldErrors.password ? 'border-red-500' : 'border-gray-300'}`}
            />
            {fieldErrors.password && <p className="text-red-500 text-[10px] mt-1">{fieldErrors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || loadingCondominios}
            className="w-full bg-gradient-to-r from-primary to-secondary text-white py-3 rounded-lg font-bold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? 'Criando Conta...' : 'Criar Conta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Já tem conta?{' '}
          <Link to="/login" className="text-primary font-semibold hover:text-primary-dark">
            Fazer Login
          </Link>
        </p>
      </div>
    </div>
  )
}