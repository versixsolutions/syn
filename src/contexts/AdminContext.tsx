import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useCondominios } from '../hooks/useCondominios'
import type { Condominio } from '../types'

interface AdminContextType {
  selectedCondominioId: string | null
  setSelectedCondominioId: (id: string | null) => void
  condominios: Condominio[]
  loadingCondominios: boolean
  selectedCondominio: Condominio | undefined
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
  const { profile, isAdmin } = useAuth()
  const { condominios, loading: loadingCondominios } = useCondominios()
  const [selectedCondominioId, setSelectedCondominioId] = useState<string | null>(null)

  useEffect(() => {
    if (!loadingCondominios) {
      if (isAdmin) {
        // Super Admin começa sem seleção para forçar escolha consciente
        // (Pode-se alterar para selecionar o primeiro se desejar)
      } else if (profile?.condominio_id) {
        // Síndicos e Administradores Locais ficam presos ao seu condomínio
        setSelectedCondominioId(profile.condominio_id)
      }
    }
  }, [isAdmin, profile, loadingCondominios])

  const selectedCondominio = condominios.find(c => c.id === selectedCondominioId)

  return (
    <AdminContext.Provider value={{
      selectedCondominioId,
      setSelectedCondominioId,
      condominios,
      loadingCondominios,
      selectedCondominio
    }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}