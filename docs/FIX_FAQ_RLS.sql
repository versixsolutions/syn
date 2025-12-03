-- ============================================================================
-- FIX FAQ RLS POLICIES
-- ============================================================================
-- Problema: Políticas RLS estavam usando public.users ao invés de public.profiles
-- Data: 2025-12-03

-- 1. Dropar políticas antigas com nomes incorretos
DROP POLICY IF EXISTS "Moradores podem ler FAQs do seu condomínio" ON public.faqs;
DROP POLICY IF EXISTS "Síndicos e admins podem gerenciar FAQs" ON public.faqs;

-- 2. Criar políticas corretas

-- Política de leitura: qualquer usuário autenticado pode ler FAQs do seu condomínio
CREATE POLICY "faq_select_policy"
ON public.faqs FOR SELECT
USING (
  condominio_id = (
    SELECT condominio_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Política de inserção: apenas síndicos e admins
CREATE POLICY "faq_insert_policy"
ON public.faqs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles 
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
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('sindico', 'admin')
  )
)
WITH CHECK (
  condominio_id = (
    SELECT condominio_id 
    FROM public.profiles 
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
    FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 3. Verificar políticas criadas
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as command,
  roles
FROM pg_policies 
WHERE tablename = 'faqs'
ORDER BY policyname;

-- 4. Testar contagem de FAQs (deve retornar > 0 se houver FAQs no condomínio do usuário)
SELECT COUNT(*) as total_faqs FROM public.faqs;
