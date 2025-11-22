// ============================================
// TIPOS GERAIS (User & Condominio)
// ============================================

export interface Condominio {
  id: string
  name: string
  slug: string
  theme_config: any // JSONB no banco
}

// ATUALIZADO COM NOVOS PERFIS
export type UserRole = 'admin' | 'sindico' | 'sub_sindico' | 'conselho' | 'morador' | 'pending'

export interface User {
  id: string // Referencia auth.users
  email: string
  full_name: string | null
  role: UserRole // Atualizado
  unit_number: string | null
  phone: string | null
  resident_type?: 'titular' | 'inquilino' | 'morador'
  is_whatsapp?: boolean
  condominio_id: string | null
  created_at: string
  // Campos virtuais (joins)
  condominio_name?: string 
  avatar_url?: string
}

// ... (mantenha o restante do arquivo igual)
// Apenas certifique-se de que não há duplicatas de interfaces abaixo