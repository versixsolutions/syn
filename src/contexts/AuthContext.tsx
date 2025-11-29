import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { UserRole } from '../types'

/**
 * Interface para perfil de usuário
 * @interface UserProfile
 * @property {string} id - ID único do usuário
 * @property {string} email - Email do usuário
 * @property {string|null} full_name - Nome completo
 * @property {UserRole} role - Papel do usuário (admin, sindico, morador, etc)
 * @property {string|null} condominio_id - ID do condomínio associado
 */
interface UserProfile {
  id: string
  email: string
  full_name: string | null
  first_name?: string | null
  last_name?: string | null
  role: UserRole
  phone: string | null
  unit_number: string | null
  block?: string | null
  resident_type: string | null
  is_whatsapp: boolean | null
  condominio_id: string | null
  condominio_name: string | null
  avatar_url?: string | null
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  authError: string | null // Novo estado para erros de integridade
  signIn: (email: string, password: string) => Promise<void>
  signUp: (data: any) => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
  isSindico: boolean
  isSubSindico: boolean
  isConselho: boolean
  isMorador: boolean
  canManage: boolean
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Hook para usar contexto de autenticação
 * @function useAuth
 * @returns {AuthContextType} Contexto de autenticação com user, profile, session, etc
 * @throws Erro se usado fora de AuthProvider
 * @example
 * const { session, profile, signIn } = useAuth()
 */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Verifica sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Escuta mudanças de estado (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        // Se usuário logou, carrega perfil
        loadProfile(session.user.id)
      } else {
        // Se deslogou, limpa tudo
        setProfile(null)
        setAuthError(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    try {
      setAuthError(null) // Limpa erros anteriores
      
      const { data, error } = await supabase
        .from('users')
        .select('*, condominios(name)')
        .eq('id', userId)
        .single()  // ✅ CORREÇÃO: Usa .single() em vez de .maybeSingle()
        // Isso lança erro se nenhum perfil encontrado, garantindo integridade

      if (error) throw error
      
      if (data) {
        const mappedProfile: UserProfile = {
          ...data,
          condominio_name: data.condominios?.name || null,
          condominio_id: data.condominio_id,
          role: (data.role as UserRole) || 'morador' 
        }
        setProfile(mappedProfile)
      }
    } catch (error: any) {
      // ✅ CORREÇÃO CRÍTICA: Inconsistência detectada - logout automático
      console.error('❌ Erro de Integridade de Dados: Usuário autenticado sem perfil público.', error)
      setProfile(null)
      setAuthError('Perfil de usuário não encontrado. Desconectando...')
      
      // Fazer logout automático se houver inconsistência
      try {
        await supabase.auth.signOut()
      } catch (signOutError) {
        console.error('Erro ao desconectar:', signOutError)
      }
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(formData: {
    email: string, 
    password: string, 
    firstName: string,
    lastName: string,
    condominioId: string,
    phone: string,
    unitNumber: string,
    block: string,
    residentType: string,
    isWhatsapp: boolean
  }) {
    const fullName = `${formData.firstName} ${formData.lastName}`.trim()

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: fullName,
          first_name: formData.firstName,
          last_name: formData.lastName,
          condominio_id: formData.condominioId,
          phone: formData.phone,
          unit_number: formData.unitNumber,
          block: formData.block,
          resident_type: formData.residentType,
          is_whatsapp: formData.isWhatsapp,
          role: 'pending'
        },
      },
    })
    if (error) throw error
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) console.warn('Aviso no logout:', error.message)
    } catch (err) {
      console.warn('Sessão já encerrada:', err)
    } finally {
      setProfile(null)
      setUser(null)
      setSession(null)
      setAuthError(null)
      localStorage.clear()
    }
  }

  const role = profile?.role || 'morador'
  
  const value = {
    user,
    profile,
    session,
    loading,
    authError, // Exportando o erro
    signIn,
    signUp,
    signOut,
    isAdmin: role === 'admin',
    isSindico: role === 'sindico',
    isSubSindico: role === 'sub_sindico',
    isConselho: role === 'conselho',
    isMorador: role === 'morador' || role === 'pending',
    canManage: ['admin', 'sindico', 'sub_sindico'].includes(role)
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}