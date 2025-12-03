# 🐛 Bug Fix: FAQ Page Empty

## Problema

A página de FAQs estava vazia (mostrando "Nada encontrado") mesmo com 300+ FAQs na tabela `public.faqs`.

## Causa Raiz

As políticas RLS (Row Level Security) da tabela `faqs` estavam usando `public.users` ao invés de `public.profiles`:

```sql
-- ❌ ERRADO
USING (condominio_id = (SELECT condominio_id FROM public.users WHERE id = auth.uid()));
```

Como a tabela `public.users` não existe (o sistema usa `public.profiles`), a query retornava **NULL** e bloqueava todo acesso às FAQs.

## Solução

Execute o script `docs/FIX_FAQ_RLS.sql` no **Supabase SQL Editor**:

### Passo a Passo

1. Acesse: https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw/sql/new
2. Copie e cole o conteúdo de `docs/FIX_FAQ_RLS.sql`
3. Clique em **RUN**
4. Verifique que as 4 políticas foram criadas corretamente

### O que o script faz:

1. ✅ Remove políticas antigas incorretas
2. ✅ Cria 4 novas políticas corretas:
   - `faq_select_policy` - Leitura para usuários do condomínio
   - `faq_insert_policy` - Inserção para síndicos e admins
   - `faq_update_policy` - Atualização para síndicos e admins
   - `faq_delete_policy` - Exclusão apenas para admins

3. ✅ Lista as políticas criadas para verificação

## Teste

Após aplicar o fix:

```powershell
# Teste 1: Verificar FAQs no banco
SELECT COUNT(*) FROM public.faqs;

# Teste 2: Acessar página FAQ no frontend
# Deve mostrar as 300+ perguntas organizadas por categoria
```

## Arquivos Afetados

- ✅ `docs/FIX_FAQ_RLS.sql` - Script de correção
- 📝 `docs/MIGRATION_300_FAQS_UNIFIED.sql` - Contém políticas incorretas (não executar novamente)

## Prevenção

Ao criar novas tabelas com RLS, sempre verificar:

- ✅ Usar `public.profiles` (não `public.users`)
- ✅ Testar com `anon_key` após criar políticas
- ✅ Não usar funções inexistentes como `get_user_role()`
