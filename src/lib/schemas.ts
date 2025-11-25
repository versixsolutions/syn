import { z } from 'zod'

// Schema de Cadastro de Usuário Atualizado
export const signupSchema = z.object({
  firstName: z.string()
    .min(2, 'Nome deve ter pelo menos 2 letras')
    .transform(name => name.trim()),
    
  lastName: z.string()
    .min(2, 'Sobrenome deve ter pelo menos 2 letras')
    .transform(name => name.trim()),
  
  email: z.string()
    .email('Formato de e-mail inválido')
    .toLowerCase(),
  
  password: z.string()
    .min(6, 'A senha deve ter no mínimo 6 caracteres'),
  
  phone: z.string()
    .min(14, 'Telefone incompleto')
    .max(15, 'Telefone inválido'),
  
  unitNumber: z.string()
    .min(1, 'Número da unidade é obrigatório'),

  block: z.string()
    .min(1, 'Bloco/Rua é obrigatório'),
  
  condominioId: z.string()
    .min(1, 'Selecione um condomínio'),
    
  residentType: z.enum(['titular', 'inquilino', 'morador']),
  
  isWhatsapp: z.boolean()
})

export type SignupFormData = z.infer<typeof signupSchema>