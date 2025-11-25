import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { UserRole } from '../types'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  first_name?: string | null // Novo
  last_name?: string | null // Novo
  role: UserRole
  phone: string | null
  unit_number: string | null
  block?: string | null // Novo
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
  signIn: (email: string, password: string) => Promise<void>
  signUp: (data: any) => Promise<void> // Simplificado para any ou tipar com SignupFormData
  signOut: () => Promise<void>
  isAdmin: boolean
  isSindico: boolean
  isSubSindico: boolean
  isConselho: boolean
  isMorador: boolean
  canManage: boolean
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, condominios(name)')
        .eq('id', userId)
        .maybeSingle()

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
    } catch (error) {
      console.error('Erro ao carregar perfil:', error)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  // ATUALIZADO: Recebe objeto completo
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
          full_name: fullName, // Mantém retrocompatibilidade
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
      localStorage.clear()
    }
  }

  const role = profile?.role || 'morador'
  
  const value = {
    user,
    profile,
    session,
    loading,
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