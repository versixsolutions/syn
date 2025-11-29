# 🔔 CONFIGURAÇÃO DE MONITORAMENTO - SENTRY
**Data:** 29 de Novembro de 2025  
**Objetivo:** Setup completo de alertas e monitoramento de erros

---

## 📊 STATUS ATUAL

### Sentry
```
✅ Instalado: @sentry/react 10.27.0
✅ Configurado: src/lib/sentry.ts
⚠️ Alertas: Pendente configuração
⚠️ Performance: Pendente ativação
```

---

## 🚀 QUICK START

### 1. Verificar Integração
O Sentry já está integrado no código. Verifique em `src/lib/sentry.ts`:

```typescript
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ]
})
```

### 2. Configurar DSN
Adicione ao `.env.local`:
```env
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### 3. Testar Erro
Execute no console do navegador:
```javascript
throw new Error('Teste Sentry - ignore este erro')
```

Verifique em: https://sentry.io/organizations/versix/issues/

---

## 🎯 CONFIGURAÇÃO DE ALERTAS

### Alertas Críticos (Email + Slack)

#### 1. Erros em Produção
**Trigger:** Qualquer erro não tratado em produção

**Configuração:**
```yaml
Condição: error.environment == 'production'
Frequência: Imediata
Destinatários: tech@versix.com.br
Slack: #alerts-production
```

#### 2. Taxa de Erro Alta
**Trigger:** Mais de 10 erros/minuto

**Configuração:**
```yaml
Condição: count(events) > 10 in 1 minute
Frequência: A cada 5 minutos
Destinatários: tech@versix.com.br
Slack: #alerts-production
```

#### 3. Erro em Fluxo Crítico
**Trigger:** Erro em login, pagamento, votação

**Tags para filtrar:**
```javascript
// Adicionar no código:
Sentry.setTag('critical-flow', 'login')
Sentry.setTag('critical-flow', 'votacao')
Sentry.setTag('critical-flow', 'payment')
```

**Configuração:**
```yaml
Condição: error.tags['critical-flow'] exists
Frequência: Imediata
Prioridade: P0 (Crítico)
```

### Alertas de Aviso (Slack)

#### 4. Performance Degradada
**Trigger:** Transaction duration > 3s

**Configuração:**
```yaml
Condição: transaction.duration > 3000ms
Frequência: A cada hora
Slack: #alerts-performance
```

#### 5. Timeout de API
**Trigger:** Supabase queries > 5s

**Código:**
```javascript
// Adicionar em src/lib/supabase.ts
const queryStart = Date.now()
const { data, error } = await supabase.from('table').select()
const duration = Date.now() - queryStart

if (duration > 5000) {
  Sentry.captureMessage('Slow Supabase query', {
    level: 'warning',
    extra: { duration, table: 'assembleias' }
  })
}
```

---

## 📈 MONITORAMENTO DE PERFORMANCE

### Ativar Tracing

**1. Performance Monitoring**
```typescript
// src/lib/sentry.ts
Sentry.init({
  tracesSampleRate: 0.1, // 10% das transações
  profilesSampleRate: 0.1, // 10% dos profiles
})
```

**2. Instrumentar Operações Críticas**
```typescript
// Exemplo: Hook useAssembleias
import * as Sentry from '@sentry/react'

const transaction = Sentry.startTransaction({
  name: 'useAssembleias.votar',
  op: 'votacao'
})

try {
  const { error } = await supabase
    .from('assembleias_votos')
    .insert({ pauta_id, user_id, voto })
  
  if (error) {
    transaction.setStatus('error')
    throw error
  }
  
  transaction.setStatus('ok')
} finally {
  transaction.finish()
}
```

### Métricas Customizadas

```typescript
// Track votação duration
Sentry.metrics.distribution('votacao.duration', duration, {
  tags: { pauta_id, status: 'success' }
})

// Count assembleias criadas
Sentry.metrics.increment('assembleia.created', 1, {
  tags: { condominio_id }
})

// Gauge de usuários online
Sentry.metrics.gauge('users.online', activeUsers)
```

---

## 🎨 CONTEXTO PERSONALIZADO

### Adicionar Informações do Usuário
```typescript
// src/contexts/AuthContext.tsx
useEffect(() => {
  if (profile) {
    Sentry.setUser({
      id: profile.id,
      email: profile.email,
      username: profile.nome,
      condominio_id: profile.condominio_id,
      role: profile.role
    })
  } else {
    Sentry.setUser(null)
  }
}, [profile])
```

### Tags Globais
```typescript
// src/main.tsx
Sentry.setTag('app.version', '0.1.1')
Sentry.setTag('app.name', 'versix-norma')
Sentry.setTag('deployment', 'vercel')
```

### Breadcrumbs Personalizados
```typescript
// Hook useAssembleias
Sentry.addBreadcrumb({
  category: 'assembleia',
  message: 'Tentando votar na pauta',
  level: 'info',
  data: { pauta_id, voto }
})
```

---

## 🐛 FILTROS E IGNORES

### Ignorar Erros Conhecidos
```typescript
// src/lib/sentry.ts
Sentry.init({
  beforeSend(event, hint) {
    // Ignorar erros de extensões
    if (event.exception?.values?.[0]?.value?.includes('extension://')) {
      return null
    }
    
    // Ignorar cancelamento de requests
    if (event.exception?.values?.[0]?.value?.includes('AbortError')) {
      return null
    }
    
    // Adicionar contexto extra
    event.extra = {
      ...event.extra,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }
    
    return event
  },
  
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'Network request failed' // Pode ser offline
  ]
})
```

---

## 📊 DASHBOARDS RECOMENDADOS

### 1. Dashboard de Produção
```
Métricas:
- Erros/hora (linha)
- Taxa de erro % (gauge)
- Usuários afetados (número)
- Top 5 erros (tabela)
- Performance p95 (linha)
```

### 2. Dashboard de Assembleias
```
Métricas:
- Assembleias criadas/dia
- Votos/hora durante assembleia
- Tempo médio de votação
- Taxa de erro em votações
- Presenças registradas
```

### 3. Dashboard de Usuários
```
Métricas:
- Usuários ativos/dia
- Sessões por usuário
- Tempo médio de sessão
- Taxa de retenção
- Erros por usuário
```

---

## 🔗 INTEGRAÇÃO COM SLACK

### Setup Webhook
1. Acesse: https://sentry.io/settings/versix/integrations/slack/
2. Clique em "Add to Slack"
3. Selecione workspace: versix-team
4. Autorize

### Configurar Canais
```
#alerts-production    → Erros críticos em produção
#alerts-staging       → Erros em staging
#alerts-performance   → Degradação de performance
#sentry-releases      → Notificação de deploys
```

### Formato de Mensagem
```
🚨 **Erro em Produção**
Projeto: versix-norma
Erro: TypeError: Cannot read property 'id' of undefined
Local: src/hooks/useAssembleias.ts:45
Usuários afetados: 3
Link: https://sentry.io/issues/123456
```

---

## 📦 RELEASES E SOURCE MAPS

### Upload de Source Maps no Deploy
Adicionar ao `vercel.json`:
```json
{
  "build": {
    "env": {
      "SENTRY_AUTH_TOKEN": "@sentry-auth-token",
      "SENTRY_ORG": "versix",
      "SENTRY_PROJECT": "norma"
    }
  }
}
```

### Script de Release
```javascript
// scripts/sentry-release.js
const Sentry = require('@sentry/cli')
const cli = new Sentry()

async function createRelease() {
  const release = `versix-norma@${process.env.VERCEL_GIT_COMMIT_SHA}`
  
  await cli.releases.new(release)
  await cli.releases.uploadSourceMaps(release, {
    include: ['./dist'],
    urlPrefix: '~/'
  })
  await cli.releases.finalize(release)
  await cli.releases.setCommits(release, { auto: true })
  
  console.log('✅ Release criado:', release)
}

createRelease()
```

---

## 🧪 TESTES

### Testar Erro
```typescript
// src/pages/Dashboard.tsx
const testSentry = () => {
  Sentry.captureException(new Error('Teste de integração Sentry'))
}

// Adicionar botão temporário
{import.meta.env.MODE === 'development' && (
  <button onClick={testSentry}>Testar Sentry</button>
)}
```

### Testar Performance
```typescript
const transaction = Sentry.startTransaction({
  name: 'test-transaction',
  op: 'test'
})

setTimeout(() => {
  transaction.finish()
}, 2000)
```

---

## 📋 CHECKLIST DE SETUP

### Inicial
- [ ] Criar projeto no Sentry
- [ ] Adicionar DSN ao `.env.local`
- [ ] Testar captura de erro
- [ ] Verificar evento no dashboard

### Alertas
- [ ] Configurar alert de erro em produção
- [ ] Configurar alert de taxa de erro
- [ ] Adicionar integração Slack
- [ ] Testar notificações

### Performance
- [ ] Ativar tracing (10%)
- [ ] Instrumentar hooks críticos
- [ ] Adicionar métricas customizadas
- [ ] Configurar thresholds

### Contexto
- [ ] Adicionar Sentry.setUser no AuthContext
- [ ] Tags globais (version, deployment)
- [ ] Breadcrumbs em ações críticas
- [ ] Filtros de erros conhecidos

### Deploy
- [ ] Upload de source maps
- [ ] Criar release no deploy
- [ ] Associar commits à release
- [ ] Testar em staging

---

## 📞 RECURSOS

### Links Úteis
- Dashboard: https://sentry.io/organizations/versix/projects/norma/
- Documentação: https://docs.sentry.io/platforms/javascript/guides/react/
- API: https://docs.sentry.io/api/

### Equipe
- Admin: tech@versix.com.br
- Slack: #sentry-versix
- On-call: Conforme rotação

---

## 🎯 PRÓXIMOS PASSOS

1. **Hoje:**
   - Criar projeto Sentry
   - Adicionar DSN
   - Configurar alertas básicos

2. **Esta semana:**
   - Integração Slack
   - Performance monitoring
   - Upload source maps

3. **Próximo mês:**
   - Dashboards customizados
   - Métricas de negócio
   - Alertas avançados

---

**Status:** ⚠️ Setup pendente  
**Prioridade:** Alta  
**Estimativa:** 2-3 horas para setup completo
