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

/**
 * Interface para Assembleia
 * @interface Assembleia
 * @property {string} id - ID único da assembleia
 * @property {string} condominio_id - ID do condomínio
 * @property {string} titulo - Título da assembleia
 * @property {string} data_hora - Data e hora da assembleia
 * @property {'agendada'|'em_andamento'|'encerrada'|'cancelada'} status - Status
 * @property {string[]} edital_topicos - Resumo do edital em tópicos
 * @property {string|null} edital_pdf_url - URL do PDF do edital
 * @property {string[]|null} ata_topicos - Resumo da ata em tópicos
 * @property {string|null} ata_pdf_url - URL do PDF da ata
 * @property {string|null} link_presenca - Link/código para registro de presença
 * @property {string} created_at - Data de criação
 * @property {string|null} iniciada_em - Data/hora de início
 * @property {string|null} encerrada_em - Data/hora de encerramento
 */
export interface Assembleia {
  id: string
  condominio_id: string
  titulo: string
  data_hora: string
  status: 'agendada' | 'em_andamento' | 'encerrada' | 'cancelada'
  edital_topicos: string[]
  edital_pdf_url: string | null
  ata_topicos: string[] | null
  ata_pdf_url: string | null
  link_presenca: string | null
  created_at: string
  iniciada_em: string | null
  encerrada_em: string | null
}

/**
 * Interface para Presença em Assembleia
 * @interface AssembleiaPresenca
 */
export interface AssembleiaPresenca {
  id: string
  assembleia_id: string
  user_id: string
  registrado_em: string
  user?: {
    full_name: string
    unit_number: string
  }
}

/**
 * Interface para Pauta de Assembleia
 * @interface AssembleiaPauta
 */
export interface AssembleiaPauta {
  id: string
  assembleia_id: string
  titulo: string
  descricao: string
  ordem: number
  status: 'pendente' | 'em_votacao' | 'encerrada'
  tipo_votacao: 'secreta' | 'aberta'
  opcoes: string[] // Ex: ['Sim', 'Não', 'Abstenção']
  votacao_iniciada_em: string | null
  votacao_encerrada_em: string | null
  created_at: string
}

/**
 * Interface para Voto em Pauta
 * @interface AssembleiaVoto
 */
export interface AssembleiaVoto {
  id: string
  pauta_id: string
  user_id: string
  voto: string // Uma das opções da pauta
  votado_em: string
}

/**
 * Interface para Resultado de Votação
 * @interface ResultadoVotacao
 */
export interface ResultadoVotacao {
  pauta_id: string
  titulo: string
  total_votos: number
  resultados: {
    opcao: string
    votos: number
    percentual: number
  }[]
  vencedor: string | null
}

// ... (mantenha o restante do arquivo igual)
// Apenas certifique-se de que não há duplicatas de interfaces abaixo