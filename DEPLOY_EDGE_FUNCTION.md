# Deploy da Edge Function process-document

## Problema Identificado

A Edge Function `process-document` foi atualizada para gerar embeddings reais (384D) por chunk, mas o upload não está alimentando a base da Norma.

## Possíveis Causas

### 1. Edge Function não foi deployada

A função local foi editada, mas não foi enviada ao Supabase.

**Solução:**

```bash
# Instalar Supabase CLI (se ainda não tem)
npm install -g supabase

# Login
supabase login

# Link do projeto
supabase link --project-ref <seu-project-id>

# Deploy da função
supabase functions deploy process-document
```

### 2. Variáveis de ambiente ausentes no Supabase

A função precisa de:

- `HUGGINGFACE_TOKEN`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `QDRANT_COLLECTION_NAME`
- `LLAMAPARSE_API_KEY`

**Solução:**

1. Acesse: https://supabase.com/dashboard/project/<seu-project-id>/settings/functions
2. Adicione cada variável em "Secrets"
3. Redeploy a função

### 3. Coleção Qdrant não existe ou tem schema incompatível

Se a coleção `norma_knowledge_base` não existir ou tiver dimensão errada, o upsert falha silenciosamente.

**Solução:**

```bash
# Limpar e recriar coleção
npm run clear:qdrant

# Verificar criação manualmente no Qdrant Dashboard:
# https://cloud.qdrant.io
```

### 4. Rate limit do HuggingFace

Se muitos chunks são processados de uma vez, o HF pode bloquear temporariamente.

**Solução:**

- Já implementado delay de 200ms a cada 5 chunks
- Verificar se token HF está correto e ativo

## Como Testar

1. **Verificar logs da Edge Function:**
   - Acesse: https://supabase.com/dashboard/project/<seu-project-id>/functions/process-document/logs
   - Faça novo upload e observe logs em tempo real

2. **Testar localmente (opcional):**

```bash
# Rodar Edge Function local
supabase functions serve process-document --env-file .env

# Em outro terminal, fazer request:
curl -X POST http://localhost:54321/functions/v1/process-document \
  -H "Authorization: Bearer <anon-key>" \
  -F "file=@test.pdf" \
  -F "condominio_id=<uuid>" \
  -F "category=regimento"
```

3. **Validar no Qdrant:**

```bash
# Checar pontos indexados
curl -X POST "https://<qdrant-url>/collections/norma_knowledge_base/points/scroll" \
  -H "api-key: <qdrant-key>" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "with_payload": true}'
```

## Checklist de Deploy

- [ ] Supabase CLI instalado e logado
- [ ] Projeto linkado (`supabase link`)
- [ ] Todas as env vars configuradas no Dashboard
- [ ] Coleção Qdrant criada com dimensão 384 e distância Cosine
- [ ] Edge Function deployada (`supabase functions deploy process-document`)
- [ ] Deploy da `_shared/embeddings-hf.ts` também (compartilhada)
- [ ] Teste com PDF pequeno (1-2 páginas)
- [ ] Logs da função sem erros
- [ ] Pontos aparecem no Qdrant após upload
- [ ] Chatbot consegue buscar informações do documento

## Próximos Passos

1. **Deploy imediato:**

```bash
supabase functions deploy process-document
```

2. **Configurar secrets:**

```bash
supabase secrets set HUGGINGFACE_TOKEN=hf_xxx
supabase secrets set QDRANT_URL=https://xxx.cloud.qdrant.io
supabase secrets set QDRANT_API_KEY=xxx
supabase secrets set QDRANT_COLLECTION_NAME=norma_knowledge_base
supabase secrets set LLAMAPARSE_API_KEY=llx-xxx
```

3. **Teste end-to-end:**
   - Fazer upload de um PDF pelo app
   - Verificar logs da função
   - Perguntar sobre o conteúdo no chatbot
   - Confirmar que fontes aparecem na resposta

## Observações

- O código local está correto e gera embeddings reais
- O problema é deploy/configuração, não código
- Se logs mostrarem "⚠️ Qdrant não configurado", as env vars estão ausentes
- Se logs mostrarem "❌ HUGGINGFACE_TOKEN não configurado", o token está ausente
