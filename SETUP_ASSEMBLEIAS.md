# 🚀 GUIA DE SETUP: MÓDULO ASSEMBLEIAS
**Data:** 29 de Novembro de 2025  
**Status:** ✅ Tabelas criadas | ⚠️ Storage pendente

---

## ✅ STATUS ATUAL

### Banco de Dados
```
✅ assembleias              (0 registros)
✅ assembleias_presencas    (0 registros)
✅ assembleias_pautas       (0 registros)
✅ assembleias_votos        (0 registros)
```

### Storage
```
❌ Bucket "assembleias" NÃO EXISTE
```

---

## 📋 CHECKLIST DE SETUP

### 1. ✅ Migração SQL (COMPLETO)
As 4 tabelas já foram criadas no Supabase.

**Como verificar:**
```powershell
npm run check:tables
```

**Se precisar criar manualmente:**
1. Acesse: https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw/sql/new
2. Cole o conteúdo de `scripts/create-assembleias-tables.sql`
3. Clique em **Run**

---

### 2. ⚠️ Bucket de Storage (PENDENTE)

**Status:** ❌ Não existe

**Passo a passo para criar:**

1. **Acesse o Dashboard:**
   ```
   https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw/storage/buckets
   ```

2. **Clique em "New bucket"**

3. **Configure:**
   ```
   Nome:        assembleias
   Público:     ✅ SIM (marque a checkbox)
   MIME types:  application/pdf
   File size:   10 MB (padrão)
   ```

4. **Clique em "Create bucket"**

5. **Verificar:**
   ```powershell
   npm run check:storage
   ```
   
   Deve retornar:
   ```
   ✅ Bucket "assembleias" ENCONTRADO!
   Status: 🌐 Público
   ```

---

### 3. ⏭️ Seed de Dados de Teste

Após criar o bucket, execute:

```powershell
npm run seed:assembleia
```

Isso criará:
- 1 assembleia com status `em_andamento`
- 2 pautas de votação (uma aberta, outra em votação)
- Link de presença gerado

---

### 4. 🧪 Teste Local

Inicie o servidor dev:
```powershell
npm run dev
```

**Fluxo de teste recomendado:**

#### A. Como ADMIN/SÍNDICO:
1. Acesse: http://localhost:5173/admin/assembleias
2. Veja a assembleia criada pelo seed
3. Teste:
   - ✅ Visualizar QR code de presença
   - ✅ Copiar link de presença
   - ✅ Abrir/encerrar votação
   - ✅ Criar nova pauta
   - ✅ Upload de PDF (edital/ata)

#### B. Como MORADOR:
1. Acesse: http://localhost:5173/transparencia/assembleias
2. Clique na assembleia
3. Teste:
   - ✅ Registrar presença via link/QR
   - ✅ Votar nas pautas abertas
   - ✅ Ver resultados em tempo real
   - ✅ Baixar PDF de resultados (após encerrar)

---

## 🔍 COMANDOS ÚTEIS

### Verificação de Ambiente
```powershell
# Verificar todas as dependências
npm run check:all

# Verificar apenas tabelas
npm run check:tables

# Verificar apenas storage
npm run check:storage
```

### Desenvolvimento
```powershell
# Dev server
npm run dev

# Build production
npm run build

# Preview build
npm run preview
```

### Dados de Teste
```powershell
# Criar assembleia de teste
npm run seed:assembleia

# AVISO: Requer bucket "assembleias" criado
```

---

## 🐛 TROUBLESHOOTING

### Erro: "Bucket not found" ao fazer upload
**Causa:** Bucket "assembleias" não existe

**Solução:**
1. Acesse: https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw/storage/buckets
2. Crie o bucket conforme seção 2 deste guia
3. Execute: `npm run check:storage` para confirmar

---

### Erro: "Permission denied" ao acessar tabelas
**Causa:** RLS policies podem estar restritivas

**Solução:**
1. Verifique que o usuário logado pertence a um condomínio
2. Admins/Síndicos devem ter role apropriado
3. Confira no SQL Editor:
   ```sql
   SELECT * FROM users WHERE id = auth.uid();
   ```

---

### Erro: "UNIQUE constraint violation" ao votar
**Causa:** Tentativa de votar duas vezes na mesma pauta

**Comportamento esperado:** Sistema deve mostrar toast:
```
"Você já votou nesta pauta"
```

---

### QR Code não aparece
**Causa:** Assembleia não está com status `em_andamento`

**Solução:**
1. Admin deve clicar em "Iniciar Assembleia"
2. Status deve mudar de `agendada` → `em_andamento`
3. QR code será gerado automaticamente

---

## 📊 ESTRUTURA DE DADOS

### Status de Assembleia
```typescript
'agendada'      → Criada, aguardando início
'em_andamento'  → Ativa, aceitando presenças e votos
'encerrada'     → Finalizada, apenas leitura
'cancelada'     → Cancelada pelo admin
```

### Status de Pauta
```typescript
'pendente'      → Aguardando abertura
'em_votacao'    → Aberta para votos
'encerrada'     → Fechada, resultados disponíveis
```

### Tipo de Votação
```typescript
'aberta'   → Votos identificados (padrão)
'secreta'  → Votos anônimos (não mostra quem votou)
```

---

## 🔐 SEGURANÇA

### RLS Policies Implementadas
```sql
✅ Usuários veem apenas assembleias do próprio condomínio
✅ Admins/Síndicos podem gerenciar tudo
✅ Votos têm constraint UNIQUE por user+pauta
✅ Presenças têm constraint UNIQUE por user+assembleia
```

### CORS
```
Vercel: Configurado em vercel.json
Produção: https://app.versixnorma.com.br
```

---

## 📸 SCREENSHOTS (Referência)

### Admin - Gestão de Assembleias
```
┌─────────────────────────────────────────────┐
│ 📝 Criar Nova Assembleia                    │
├─────────────────────────────────────────────┤
│ Título: [_____________________________]     │
│ Data:   [___/__/____ __:__]                 │
│ Edital: [Upload PDF] ou [Texto]            │
│                                             │
│ [Criar Assembleia]                          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🗳️ Pautas de Votação                        │
├─────────────────────────────────────────────┤
│ 1. Aprovação do orçamento 2026              │
│    Status: ⏸️ Pendente                       │
│    [Abrir Votação] [Editar] [Excluir]      │
│                                             │
│ 2. Autorização reforma salão                │
│    Status: ✅ Em Votação                     │
│    👥 12 votos | Sim: 8 | Não: 4            │
│    [Encerrar Votação]                       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📱 QR Code de Presença                      │
├─────────────────────────────────────────────┤
│         [QR CODE IMAGE]                     │
│                                             │
│ Link: /assembleias/abc123/presenca          │
│ [Copiar Link] [Abrir Nova Aba]             │
└─────────────────────────────────────────────┘
```

### Morador - Votação
```
┌─────────────────────────────────────────────┐
│ 🗳️ Assembleia Ordinária - Nov/2025          │
├─────────────────────────────────────────────┤
│ 📅 29/11/2025 19:00                         │
│ 📍 Status: Em Andamento                     │
│                                             │
│ ✅ Presença registrada!                     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📋 PAUTA 1: Aprovação do orçamento          │
├─────────────────────────────────────────────┤
│ Descrição: Orçamento previsto para 2026... │
│                                             │
│ Vote agora:                                 │
│ ○ Sim    ○ Não    ○ Abstenção              │
│                                             │
│ [Confirmar Voto]                            │
│                                             │
│ Resultados parciais:                        │
│ ████████░░ Sim: 8 (66.7%)                   │
│ ████░░░░░░ Não: 4 (33.3%)                   │
│ ░░░░░░░░░░ Abstenção: 0 (0%)                │
└─────────────────────────────────────────────┘
```

---

## ✅ PRÓXIMOS PASSOS

Após completar este setup:

1. **Testes E2E:**
   ```powershell
   npx cypress open
   ```
   Execute: `cypress/e2e/assembleia_presenca.cy.ts`

2. **Deploy Staging:**
   ```powershell
   git add .
   git commit -m "feat: setup módulo assembleias"
   git push origin main
   ```

3. **Monitoramento:**
   - Verificar logs no Sentry
   - Acompanhar métricas no Vercel Analytics

4. **Documentação de Usuário:**
   - Criar guia para síndicos
   - Tutorial em vídeo (opcional)
   - FAQ de assembleias

---

## 📞 SUPORTE

**Erros ou dúvidas?**
- Verifique console do navegador (F12)
- Confira logs do Supabase
- Execute: `npm run check:all`

**Informações úteis:**
```
Projeto Supabase: gjsnrrfuahfckvjlzwxw
Região: São Paulo (Brasil)
Dashboard: https://supabase.com/dashboard/project/gjsnrrfuahfckvjlzwxw
```

---

**Última atualização:** 29/11/2025  
**Status:** ✅ Tabelas OK | ⚠️ Aguardando criação de bucket
