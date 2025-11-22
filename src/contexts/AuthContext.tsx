import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
// Importando o tipo atualizado
import type { UserRole } from '../types'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole // Tipagem forte
  phone: string | null
  unit_number: string | null
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
  signUp: (
    email: string, 
    password: string, 
    fullName: string, 
    condominioId: string,
    phone: string,
    unitNumber: string,
    residentType: string,
    isWhatsapp: boolean
  ) => Promise<void>
  signOut: () => Promise<void>
  
  // Helpers de Permissão (Novos)
  isAdmin: boolean       // Acesso total
  isSindico: boolean     // Gestão
  isSubSindico: boolean  // Apoio
  isConselho: boolean    // Auditoria/Leitura avançada
  isMorador: boolean     // Acesso básico
  
  // Helper de função composta (Ex: Pode gerenciar?)
  canManage: boolean     // True para Admin, Sindico e Sub
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
          // Força o cast para o tipo UserRole para garantir compatibilidade
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

  async function signUp(
    email: string, 
    password: string, 
    fullName: string, 
    condominioId: string,
    phone: string,
    unitNumber: string,
    residentType: string,
    isWhatsapp: boolean
  ) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          condominio_id: condominioId,
          phone: phone,
          unit_number: unitNumber,
          resident_type: residentType,
          is_whatsapp: isWhatsapp,
          role: 'pending' // Todo cadastro começa como pendente/morador até aprovação
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

  // Lógica de Permissões
  const role = profile?.role || 'morador'
  
  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    
    // Helpers Booleanos para facilitar o uso nos componentes
    isAdmin: role === 'admin',
    isSindico: role === 'sindico',
    isSubSindico: role === 'sub_sindico',
    isConselho: role === 'conselho',
    isMorador: role === 'morador' || role === 'pending',
    
    // Permissão composta: Quem pode gerenciar/editar coisas
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