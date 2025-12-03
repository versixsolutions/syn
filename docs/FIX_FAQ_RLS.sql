-- ============================================================================
-- FIX FAQ RLS POLICIES
-- ============================================================================
-- Problema: Políticas RLS antigas estavam com referências incorretas
-- Data: 2025-12-03

-- 1. Dropar TODAS as políticas existentes
DROP POLICY IF EXISTS "Moradores podem ler FAQs do seu condomínio" ON public.faqs;
DROP POLICY IF EXISTS "Síndicos e admins podem gerenciar FAQs" ON public.faqs;
DROP POLICY IF EXISTS "faq_select_policy" ON public.faqs;
DROP POLICY IF EXISTS "faq_insert_policy" ON public.faqs;
DROP POLICY IF EXISTS "faq_update_policy" ON public.faqs;
DROP POLICY IF EXISTS "faq_delete_policy" ON public.faqs;

-- 2. Criar políticas corretas

-- Política de leitura: qualquer usuário autenticado pode ler FAQs do seu condomínio
CREATE POLICY "faq_select_policy"
ON public.faqs FOR SELECT
USING (
  condominio_id = (
    SELECT condominio_id 
    FROM public.users 
    WHERE id = auth.uid()
  )
);

-- Política de inserção: apenas síndicos e admins
CREATE POLICY "faq_insert_policy"
ON public.faqs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('sindico', 'admin')
  )
);

-- Política de atualização: apenas síndicos e admins do mesmo condomínio
CREATE POLICY "faq_update_policy"
ON public.faqs FOR UPDATE
USING (
  condominio_id = (
    SELECT condominio_id 
    FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('sindico', 'admin')
  )
)
WITH CHECK (
  condominio_id = (
    SELECT condominio_id 
    FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('sindico', 'admin')
  )
);

-- Política de exclusão: apenas admins
CREATE POLICY "faq_delete_policy"
ON public.faqs FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);
