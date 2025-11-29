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

/**
 * Interface para Chamado de Suporte
 * @interface Chamado
 * @property {string} id - ID único do chamado
 * @property {string} user_id - ID do usuário que criou
 * @property {string} subject - Assunto/tipo do chamado
 * @property {string} description - Descrição completa
 * @property {'aberto'|'em_andamento'|'resolvido'|'fechado'} status - Status atual
 * @property {string|null} response - Resposta do administrador
 * @property {string|null} internal_notes - Notas internas (apenas admin)
 * @property {string} created_at - Data de criação
 * @property {string|null} updated_at - Última atualização
 * @property {string|null} closed_at - Data de fechamento
 */
export interface Chamado {
  id: string
  user_id: string
  subject: string
  description: string
  status: 'aberto' | 'em_andamento' | 'resolvido' | 'fechado'
  response: string | null
  internal_notes?: string | null
  created_at: string
  updated_at: string | null
  closed_at: string | null
}

// ... (mantenha o restante do arquivo igual)
// Apenas certifique-se de que não há duplicatas de interfaces abaixo