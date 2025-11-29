# 🚀 PLANO DE AÇÃO - PRÓXIMOS PASSOS

## 📋 Checklist Imediato (Hoje)

### Fase 1: Validação (30 minutos)
- [ ] Ler `ANALISE_CRITICA.md` completamente
- [ ] Revisar `RESUMO_EXECUTIVO.md`
- [ ] Entender as 12 falhas identificadas
- [ ] Validar que todas as correções fazem sentido

### Fase 2: Testing (1 hora)
- [ ] Fazer build local: `npm run build`
- [ ] Não deve haver erros de TypeScript
- [ ] Executar dev: `npm run dev`
- [ ] Testar fluxo de login/logout
- [ ] Verificar console (F12) sem erros críticos

### Fase 3: Git (15 minutos)
```bash
# Commits atomizados com mensagens claras
git add vercel.json
git commit -m "fix: restrict CORS to authorized origins only"

git add src/lib/supabase.ts
git commit -m "fix: validate environment variables on startup"

git add supabase/config.toml
git commit -m "fix: enable JWT verification on all endpoints"

git add src/contexts/AuthContext.tsx
git commit -m "fix: ensure data integrity with single() query and auto-logout"

git add src/components/Chatbot.tsx
git commit -m "fix: add input validation and sanitization to prevent XSS"

git add src/pages/Profile.tsx
git commit -m "fix: add memory leak prevention with cleanup"

git push origin main
```

---

## 📊 Fase 2: Esta Semana (4 horas de trabalho)

### Task 1: Otimizar Queries N+1 (2 horas)
**Arquivo**: `src/pages/admin/AdminDashboard.tsx`

```sql
-- Criar RPC no Supabase SQL Editor
CREATE OR REPLACE FUNCTION get_condominios_health()
RETURNS TABLE(
  id UUID,
  name TEXT,
  slug TEXT,
  total_users BIGINT,
  pending_users BIGINT,
  open_issues BIGINT,
  active_polls BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.slug,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.role = 'pending' THEN u.id END) as pending_users,
    COUNT(DISTINCT CASE WHEN o.status IN ('aberto', 'em_andamento') THEN o.id END) as open_issues,
    COUNT(DISTINCT CASE WHEN v.end_date > NOW() THEN v.id END) as active_polls
  FROM condominios c
  LEFT JOIN users u ON u.condominio_id = c.id
  LEFT JOIN ocorrencias o ON o.condominio_id = c.id
  LEFT JOIN votacoes v ON v.condominio_id = c.id
  GROUP BY c.id, c.name, c.slug;
END;
$$ LANGUAGE plpgsql;
```

Depois usar no componente:
```typescript
const { data: condominioHealth } = await supabase.rpc('get_condominios_health')
```

### Task 2: Implementar Rate Limiting (1 hora)
**Arquivo**: `supabase/functions/ask-ai/index.ts`

```typescript
// Adicionar após JWT validation
const userId = authHeader  // Extrair do JWT token
const now = Date.now()
const oneHourAgo = now - 3600000

const { count } = await supabase
  .from('ai_requests')
  .select('*', { count: 'exact' })
  .eq('user_id', userId)
  .gte('created_at', new Date(oneHourAgo).toISOString())

if (count >= 50) {
  return new Response(
    JSON.stringify({ answer: 'Limite de requisições atingido. Tente novamente em 1 hora.' }),
    { status: 429, headers: corsHeaders }
  )
}

// Registrar requisição
await supabase.from('ai_requests').insert({
  user_id: userId,
  query: query,
  created_at: new Date().toISOString()
})
```

### Task 3: Removendo Código Morto (30 minutos)
```bash
# Deletar arquivo fake
rm src/hooks/useAuth.ts

# Procurar por imports errados
grep -r "from.*hooks.*useAuth" src/

# Se encontrado, corrigir para:
# import { useAuth } from '../contexts/AuthContext'
```

### Task 4: Logging Estruturado (30 minutos)
```bash
# Instalar Winston
npm install winston

# Criar src/lib/logger.ts
```

```typescript
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
})
```

---

## 🧪 Fase 3: Próximas 2 Semanas (8 horas)

### Task 1: Testes Unitários (4 horas)
```bash
npm install --save-dev jest @testing-library/react vitest

# Criar testes para:
# - src/contexts/AuthContext.tsx
# - src/components/Chatbot.tsx
# - src/pages/Profile.tsx
```

### Task 2: Service Worker para Offline (2 horas)
```typescript
// Melhorar o existing service-worker.ts
// Implementar fallback para quando app estiver offline
```

### Task 3: Auditoria de Outras Páginas Admin (2 horas)
```bash
# Revisar:
# - src/pages/admin/ComunicadosManagement.tsx
# - src/pages/admin/FinanceiroManagement.tsx
# - src/pages/admin/OcorrenciasManagement.tsx
# - src/pages/admin/VotacoesManagement.tsx
```

---

## 🔐 ANTES DE FAZER DEPLOY

### Checklist Segurança
- [ ] CORS está restringido? (check vercel.json)
- [ ] JWT validation está ON? (check supabase/config.toml)
- [ ] Variáveis de ambiente validadas? (check src/lib/supabase.ts)
- [ ] localStorage.clear() foi removido? (check src/contexts/AuthContext.tsx)
- [ ] Inputs são validados? (check Chatbot, forms)
- [ ] Rate limiting implementado? (check ask-ai function)
- [ ] Nenhum console.log de dados sensíveis?

### Checklist Performance
- [ ] Queries N+1 resolvidas? (check admin dashboard)
- [ ] Memory leaks corrigidos? (check Profile, Chatbot)
- [ ] Bundle size < 500KB?
- [ ] Lighthouse score > 80?

### Checklist Conformidade
- [ ] LGPD - dados pessoais protegidos?
- [ ] OWASP Top 10 - todos os top 10 cobertos?
- [ ] Testes unitários > 80% coverage?

---

## 📞 SUPORTE TÉCNICO

Se encontrar problemas durante a implementação:

### Erro: "CORS blocked"
→ Verificar domínio em `vercel.json`
→ Adicionar domínio correto nas origens

### Erro: "Supabase env variables missing"
→ Verificar `.env` local
→ Verificar environment variables no Vercel

### Erro: "Rate limit exceeded"
→ Criar tabela `ai_requests` no Supabase
→ Verificar que função está gravando requisições

### Erro: "JWT verification failed"
→ Verificar que function tem `verify_jwt = true`
→ Redeploy function: `supabase functions deploy ask-ai`

---

## 📈 MÉTRICAS DE SUCESSO

Após todas as correções:

```
Before                          After                       Target
────────────────────────────────────────────────────────────────
🔴 7 vulnerabilidades críticas  → ✅ 0                      ✅ 0
🟠 40 queries admin            → ✅ ~3 queries             ✅ <5
📊 ~5 seconds admin load       → ✅ ~500ms                 ✅ <1s
❌ Memory leaks                → ✅ Zero                   ✅ Zero
⚠️ CORS: *                     → ✅ Restricted             ✅ Whitelist
🔓 JWT: false                  → ✅ true                   ✅ true
```

---

## 📚 REFERÊNCIAS EXTERNAS

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/security)
- [React Security Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [TypeScript Security Guide](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)

---

## ✅ MARCADORES DE CONCLUSÃO

Imprima este documento e marque cada etapa conforme completar:

```
[ ] Leia ANALISE_CRITICA.md
[ ] Execute npm run build sem erros
[ ] Teste login/logout localmente
[ ] Faça commit das correções
[ ] Deploy em staging
[ ] Teste em staging
[ ] Otimize queries N+1
[ ] Implemente rate limiting
[ ] Remova código morto
[ ] Adicione testes
[ ] Deploy em produção
[ ] Monitore erros em produção
```

---

**Data**: 28 de Novembro de 2025  
**Responsável**: GitHub Copilot (Claude Haiku 4.5)  
**Próxima Revisão**: 15 de Dezembro de 2025
