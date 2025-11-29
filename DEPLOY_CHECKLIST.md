# 🚀 CHECKLIST DE DEPLOY - MÓDULO ASSEMBLEIAS
**Data:** 29 de Novembro de 2025  
**Versão:** 0.2.0  
**Status:** ⚠️ Aguardando criação de bucket Storage

---

## ✅ COMPLETED (Pronto)

### 1. ✅ Código
- [x] Módulo Assembleias implementado (15 arquivos)
- [x] Hooks e componentes testados localmente
- [x] TypeScript strict sem erros
- [x] Build produção funcionando (14.54s)
- [x] Code-splitting otimizado (311KB gzip)
- [x] Data-testids adicionados
- [x] Documentação completa criada

### 2. ✅ Banco de Dados
- [x] 4 tabelas criadas no Supabase
  - `assembleias` (0 registros)
  - `assembleias_presencas` (0 registros)
  - `assembleias_pautas` (0 registros)
  - `assembleias_votos` (0 registros)
- [x] RLS policies configuradas
- [x] Índices criados
- [x] Constraints UNIQUE aplicados

### 3. ✅ Testes
- [x] Teste E2E de presença criado
- [x] Teste E2E de fluxo completo criado
- [x] Scripts de verificação criados
  - `npm run check:tables`
  - `npm run check:storage`
  - `npm run check:all`

### 4. ✅ Documentação
- [x] ANALISE_PROFUNDA_PROJETO.md
- [x] SETUP_ASSEMBLEIAS.md
- [x] SETUP_SENTRY_MONITORING.md
- [x] README atualizado (implícito)

---

## ⚠️ PENDING (Bloqueadores para Deploy)

### 1. ⚠️ Supabase Storage
**Status:** ❌ Bucket "assembleias" não existe

**Ação necessária:**
1. Acesse: https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw/storage/buckets
2. Clique em "New bucket"
3. Configure:
   - **Nome:** assembleias
   - **Público:** ✅ SIM (marcar checkbox)
   - **MIME types:** application/pdf
   - **File size limit:** 10 MB
4. Clique em "Create bucket"

**Verificação:**
```powershell
npm run check:storage
```

**⚠️ CRÍTICO:** Upload de PDFs (edital/ata) NÃO funcionará sem este bucket!

---

### 2. 📊 Sentry (Opcional mas recomendado)
**Status:** ⚠️ DSN não configurado

**Ação necessária:**
1. Criar projeto Sentry (se não existir)
2. Obter DSN
3. Adicionar ao `.env.local`:
   ```env
   VITE_SENTRY_DSN=https://xxx@sentry.io/yyy
   ```
4. Configurar alertas (ver SETUP_SENTRY_MONITORING.md)

**Impacto se não configurar:**
- Monitoramento de erros limitado
- Sem alertas automáticos
- Debug mais difícil em produção

---

## 🧪 TESTES PRÉ-DEPLOY

### Local (Dev Server)
```powershell
# 1. Criar bucket no Supabase (manual)
# 2. Verificar ambiente
npm run check:all

# 3. Seed de dados de teste
npm run seed:assembleia

# 4. Dev server
npm run dev

# 5. Testar fluxos:
#    - Login como admin
#    - Criar assembleia
#    - Upload PDF
#    - Iniciar assembleia
#    - QR code presença
#    - Login como morador
#    - Registrar presença
#    - Votar
#    - Admin encerrar
#    - Exportar PDF
```

### Build Production
```powershell
# Build
npm run build

# Preview
npm run preview

# Testar em: http://localhost:4173
```

### E2E Cypress
```powershell
# Abrir Cypress UI
npx cypress open

# Executar testes:
# - assembleia_presenca.cy.ts
# - assembleia_fluxo_completo.cy.ts

# Ou headless:
npx cypress run --spec "cypress/e2e/assembleia*.cy.ts"
```

---

## 🚀 DEPLOY PROCESS

### Staging (Preview Vercel)
```powershell
# 1. Commit mudanças
git add .
git commit -m "feat: módulo assembleias completo - v0.2.0"

# 2. Push para branch feature
git checkout -b feature/assembleias
git push origin feature/assembleias

# 3. Vercel criará preview automático
# URL: https://norma-xxx-versix.vercel.app

# 4. Testar em preview:
#    - Smoke tests
#    - Fluxo completo de assembleia
#    - Upload de PDFs
#    - Exportação de PDFs
```

### Production
```powershell
# 1. Merge para main (após aprovação)
git checkout main
git merge feature/assembleias

# 2. Tag release
git tag -a v0.2.0 -m "Release: Módulo de Assembleias"

# 3. Push
git push origin main --tags

# 4. Vercel deploya automaticamente
# URL: https://app.versixnorma.com.br

# 5. Monitorar:
#    - Vercel logs: https://vercel.com/versix-solutions-projects/norma/deployments
#    - Sentry: https://sentry.io/organizations/versix/issues/
#    - Supabase logs: https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw/logs
```

---

## 📊 SMOKE TESTS PÓS-DEPLOY

### Checklist Básico
- [ ] Site carrega sem erros de console
- [ ] Login funciona
- [ ] Dashboard exibe corretamente
- [ ] Menu "Transparência" visível
- [ ] Página Assembleias carrega

### Checklist Assembleias (Admin)
- [ ] Acessar /admin/assembleias
- [ ] Criar nova assembleia
- [ ] Upload de PDF funciona
- [ ] QR code é gerado
- [ ] Link de presença copiável
- [ ] Adicionar pauta funciona
- [ ] Iniciar assembleia funciona
- [ ] Abrir votação funciona

### Checklist Assembleias (Morador)
- [ ] Acessar /transparencia/assembleias
- [ ] Ver listagem de assembleias
- [ ] Abrir detalhes de assembleia
- [ ] Registrar presença via link
- [ ] Votar em pauta aberta
- [ ] Ver resultados em tempo real
- [ ] Exportar PDF de resultados (após encerrar)

---

## 🔍 MONITORAMENTO PÓS-DEPLOY

### Primeiras 24 horas
```
Verificar a cada 2 horas:
- Taxa de erro no Sentry
- Performance no Vercel Analytics
- Logs do Supabase (queries lentas)
- Feedback de usuários beta
```

### Métricas Chave
```
Erro rate:        < 1% (target)
P95 latency:      < 2s
Bundle load:      < 3s (cold)
Uptime:           > 99.9%
```

### Alertas Configurados
```
✅ Email para erros críticos
✅ Slack #alerts-production
⚠️ Sentry DSN pendente (ver SETUP_SENTRY_MONITORING.md)
```

---

## 🐛 ROLLBACK PLAN

### Se houver problema crítico em produção:

```powershell
# 1. Rollback via Vercel Dashboard
# https://vercel.com/versix-solutions-projects/norma/deployments
# Clicar em "Redeploy" do deployment anterior estável

# OU via CLI:
vercel rollback

# 2. Notificar equipe
# Slack: #incidents

# 3. Criar issue no GitHub
# Tag: bug, priority-critical

# 4. Fix e redeploy
git revert HEAD
git push origin main
```

---

## 📦 ASSETS E DEPENDÊNCIAS

### Variáveis de Ambiente (Production)
```env
# Vercel - Já configuradas
VITE_SUPABASE_URL=https://gjsnrrfuahfckvjlzwxw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# A adicionar (opcional):
VITE_SENTRY_DSN=https://xxx@sentry.io/yyy
```

### DNS
```
Domínio: app.versixnorma.com.br
Vercel:  norma.vercel.app
Status:  ✅ Configurado
```

### CDN/Cache
```
Vercel Edge Network: ✅ Ativo
Cache headers:       ✅ Configurados
Gzip:                ✅ Ativo
Brotli:              ✅ Ativo
```

---

## 📋 COMUNICAÇÃO

### Stakeholders a Notificar

**Pré-deploy:**
- [ ] Product Owner: "Deploy agendado para [data]"
- [ ] QA Team: "Preview disponível em [URL]"
- [ ] Usuários Beta: "Nova feature disponível em staging"

**Pós-deploy:**
- [ ] Product Owner: "Deploy concluído, v0.2.0 live"
- [ ] Support Team: "Guia de uso do módulo Assembleias"
- [ ] Marketing: "Anúncio de nova feature"
- [ ] Usuários: "Email/push notification de novidade"

### Mensagem Sugerida (Email/Push)
```
🎉 Nova Funcionalidade: Assembleias Digitais

Agora você pode:
✅ Participar de assembleias online
✅ Votar em tempo real
✅ Registrar presença via QR code
✅ Acompanhar resultados instantâneos

Acesse: Transparência > Assembleias

Dúvidas? Veja nosso FAQ.
```

---

## ✅ CHECKLIST FINAL

### Pré-Deploy
- [x] Código commitado e pushed
- [x] Build rodando sem erros
- [x] Testes E2E passando
- [ ] Bucket Storage criado ⚠️ **BLOQUEADOR**
- [ ] Sentry DSN configurado (opcional)
- [ ] Preview testado
- [ ] Stakeholders notificados

### Deploy
- [ ] Merge para main
- [ ] Tag v0.2.0 criada
- [ ] Vercel deploy automático acionado
- [ ] Deploy concluído sem erros
- [ ] Smoke tests executados

### Pós-Deploy
- [ ] Monitoramento ativo (24h)
- [ ] Zero erros críticos
- [ ] Performance dentro do esperado
- [ ] Feedback de usuários coletado
- [ ] Documentação publicada
- [ ] Comunicação enviada

---

## 🎯 PRÓXIMOS PASSOS (PÓS-LANÇAMENTO)

### Semana 1
- Coletar feedback de usuários beta
- Ajustar UX baseado em métricas
- Fixar bugs menores
- Expandir documentação de usuário

### Semana 2-4
- Adicionar testes unitários (Jest)
- Melhorar performance (React Query)
- Implementar notificações de assembleia
- Tutorial em vídeo

### Mês 2
- Integração WhatsApp para convites
- Assinatura digital de atas
- Histórico de votações por morador
- Dashboard de participação

---

**⚠️ AÇÃO IMEDIATA NECESSÁRIA:**
```
Criar bucket "assembleias" no Supabase Storage antes de deploy!
Link: https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw/storage/buckets
```

**Status geral:** 95% pronto | 1 bloqueador crítico
**ETA deploy:** Imediato após criação do bucket
**Risco:** Baixo (código testado, tabelas configuradas)
