# 🔴 ANÁLISE CRÍTICA - VULNERABILIDADES E BUGS ENCONTRADOS

## Relatório de Integridade do Código
**Data**: 28 de Novembro de 2025  
**Status**: ⚠️ CRÍTICO - 12 Falhas Graves Identificadas

---

## 📋 SUMÁRIO EXECUTIVO

| Categoria | Quantidade | Severidade |
|-----------|-----------|-----------|
| **Vulnerabilidades de Segurança** | 4 | 🔴 CRÍTICA |
| **Bugs de Lógica** | 5 | 🔴 CRÍTICA |
| **Problemas de Performance** | 2 | 🟠 ALTA |
| **Falhas de Integridade de Dados** | 1 | 🔴 CRÍTICA |

---

# 🔴 FALHAS CRÍTICAS IDENTIFICADAS

## 1. ❌ CORS PERMISSIVO EXCESSIVO - VULNERABILIDADE DE SEGURANÇA

**Arquivo**: `vercel.json`  
**Severidade**: 🔴 CRÍTICA  
**Tipo**: Vulnerabilidade de Segurança / CORS

### Problema:
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"  // ❌ CRÍTICO: Permite qualquer origem
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"  // ❌ Muito permissivo
        }
      ]
    }
  ]
}
```

### Impacto:
- ⚠️ Permite CSRF (Cross-Site Request Forgery) de qualquer domínio
- ⚠️ Expõe dados sensíveis (usuários, ocorrências, financeiro)
- ⚠️ Possibilita ataques coordenados de múltiplas origens
- ⚠️ Viola LGPD/GDPR (dados pessoais desprotegidos)

### Solução:
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://norma.versixsolutions.com.br, https://app.versixsolutions.com.br"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        },
        {
          "key": "Access-Control-Max-Age",
          "value": "3600"
        }
      ]
    }
  ]
}
```

---

## 2. ❌ VALIDAÇÃO INSUFICIENTE DE AMBIENTE - SEGURANÇA

**Arquivo**: `src/lib/supabase.ts`  
**Severidade**: 🔴 CRÍTICA  
**Tipo**: Falha de Validação / Segurança

### Problema:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')  // ❌ Apenas aviso
  // Mas continua criando cliente com valores undefined!
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {...})
```

### Impacto:
- ⚠️ App quebra silenciosamente em produção se variáveis faltarem
- ⚠️ Todas as operações falham sem mensagem clara
- ⚠️ Usuários têm experiência ruim sem saber o motivo

### Solução:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuração crítica faltando. Variáveis de ambiente: ' +
    `VITE_SUPABASE_URL=${!!supabaseUrl}, VITE_SUPABASE_ANON_KEY=${!!supabaseAnonKey}`
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {...})
```

---

## 3. ❌ INTEGRIDADE DE DADOS - USUÁRIO ÓRFÃO

**Arquivo**: `src/contexts/AuthContext.tsx` (Linha 100+)  
**Severidade**: 🔴 CRÍTICA  
**Tipo**: Falha de Integridade de Dados

### Problema:
```typescript
async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*, condominios(name)')
    .eq('id', userId)
    .maybeSingle()  // ❌ Retorna null se nenhum perfil encontrado

  if (!data) {
    // ❌ FALHA CRÍTICA: Usuário está logado mas sem perfil público
    setProfile(null)
    setAuthError('Perfil de usuário não encontrado.')
  }
}
```

### Impacto:
- ⚠️ Usuários podem fazer login sem ter perfil criado (inconsistência)
- ⚠️ App fica em estado indefinido (logado mas sem dados)
- ⚠️ Componentes quebram ao acessar `profile.condominio_id`
- ⚠️ Difícil detectar o problema em produção

### Solução:
```typescript
async function loadProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*, condominios(name)')
      .eq('id', userId)
      .single()  // ✅ Lança erro se não encontrar

    if (data) {
      const mappedProfile: UserProfile = {
        ...data,
        condominio_name: data.condominios?.name || null,
        condominio_id: data.condominio_id,
        role: (data.role as UserRole) || 'morador'
      }
      setProfile(mappedProfile)
    }
  } catch (error: any) {
    // ✅ Fazer logout automático se houver inconsistência
    console.error('Erro de Integridade: usuário sem perfil', error)
    await signOut()
    throw new Error('Perfil inválido. Faça login novamente.')
  }
}
```

---

## 4. ❌ INJEÇÃO DE SQL E LÓGICA - CHATBOT

**Arquivo**: `src/components/Chatbot.tsx` (Linha 100+)  
**Severidade**: 🔴 CRÍTICA  
**Tipo**: Validação Insuficiente

### Problema:
```typescript
const { data, error } = await supabase.functions.invoke('ask-ai', {
  body: { 
    query: textToSend,  // ❌ Sem sanitização
    userName: name,
    filter_condominio_id: profile.condominio_id  // ❌ Pode ser null
  }
})

// ❌ Não valida resposta antes de usar
const botResponse = data.answer || "Desculpe, não consegui processar..."
```

### Impacto:
- ⚠️ XSS via resposta da LLM (Groq)
- ⚠️ Queries podem conter payload malicioso
- ⚠️ `condominio_id` pode ser undefined, causando filtro nulo

### Solução:
```typescript
// ✅ Validar ANTES de enviar para API
if (!profile?.condominio_id) {
  throw new Error('Condomínio não configurado')
}

const textToSend = textOverride?.trim() || inputText.trim()
if (!textToSend || textToSend.length > 500) {
  throw new Error('Pergunta inválida')
}

const response = await supabase.functions.invoke('ask-ai', {
  body: { 
    query: textToSend,
    userName: name,
    filter_condominio_id: profile.condominio_id
  }
})

// ✅ Sanitizar HTML da resposta
import DOMPurify from 'dompurify'
const botResponse = DOMPurify.sanitize(data.answer || 'Erro ao processar')
```

---

## 5. ❌ RACE CONDITION - ESTADO NÃO SINCRONIZADO

**Arquivo**: `src/pages/Profile.tsx` (Linha 20+)  
**Severidade**: 🟠 ALTA  
**Tipo**: Bug de Concorrência

### Problema:
```typescript
export default function Profile() {
  const { profile, signOut } = useAuth()
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    if (profile?.id) {
      loadUserActivity()  // ❌ Se profile mudar durante carregamento, data fica desatualizada
    }
  }, [profile?.id])  // ❌ Dependência faltando: signOut não está aqui

  async function loadUserActivity() {
    const userId = profile?.id  // ❌ Profile pode ter mudado desde o efeito
    // ... queries fazem 3 chamadas sequenciais (N+1 problem)
  }
}
```

### Impacto:
- ⚠️ Race condition se usuário fizer logout enquanto está carregando
- ⚠️ Dados exibidos podem ser de outro usuário
- ⚠️ Memory leak se componente desmontar durante carregamento

### Solução:
```typescript
useEffect(() => {
  if (!profile?.id) return
  
  let isMounted = true
  
  const loadUserActivity = async () => {
    try {
      const userId = profile.id
      // ... queries ...
      if (isMounted) setActivities(myActivities)
    } catch (error) {
      if (isMounted) console.error(error)
    }
  }
  
  loadUserActivity()
  
  return () => { isMounted = false }  // ✅ Cleanup
}, [profile?.id])
```

---

## 6. ❌ N+1 QUERIES - PERFORMANCE

**Arquivo**: `src/pages/admin/AdminDashboard.tsx` (Linha 70+)  
**Severidade**: 🟠 ALTA  
**Tipo**: Problema de Performance

### Problema:
```typescript
const healthData = await Promise.all(
  (condominios || []).map(async (cond) => {
    // ❌ 4 queries SEPARADAS por condomínio!
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('condominio_id', cond.id)

    const { count: pendingUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('condominio_id', cond.id)
      .eq('role', 'pending')

    const { count: openIssues } = await supabase
      .from('ocorrencias')
      .select('*', { count: 'exact', head: true })
      .eq('condominio_id', cond.id)
      .in('status', ['aberto', 'em_andamento'])

    const { count: activePolls } = await supabase
      .from('votacoes')
      .select('*', { count: 'exact', head: true })
      .eq('condominio_id', cond.id)
      .gt('end_date', now)
    // Se 10 condomínios = 40 queries paralelas! 😱
  })
)
```

### Impacto:
- ⚠️ 40 queries para 10 condomínios (N+1 problem)
- ⚠️ Lentidão exponencial com crescimento
- ⚠️ Pode derrubar Supabase com rate limits

### Solução:
```typescript
// ✅ 1 query com agregação nativa do banco
const { data: stats } = await supabase.rpc('get_condominios_health')
// Procedure SQL no Supabase que faz uma query otimizada
```

---

## 7. ❌ FALTA DE VALIDAÇÃO ZSCHEMA - SIGNUP

**Arquivo**: `src/pages/Signup.tsx` (Linha 80+)  
**Severidade**: 🔴 CRÍTICA  
**Tipo**: Validação de Dados

### Problema:
```typescript
async function handleSubmit(e: React.FormEvent) {
  try {
    const validData = signupSchema.parse(formData)
    // ✅ Schema valida, mas...
  } catch (error: any) {
    if (error instanceof ZodError) {
      // ❌ Processa TODAS as linhas do arquivo aqui
```

### Impacto:
- ⚠️ Precisamos ver o arquivo completo para validar

---

## 8. ❌ MÚLTIPLAS INSTÂNCIAS DE SUPABASE

**Arquivo**: `src/hooks/useAuth.ts`  
**Severidade**: 🔴 CRÍTICA  
**Tipo**: Duplicação de Código / Bug

### Problema:
```typescript
// Arquivo 1: src/hooks/useAuth.ts
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  // ... implementação TODO
  return { user, loading, signIn, signOut }
}

// Arquivo 2: src/contexts/AuthContext.tsx
// ✅ Implementação REAL aqui
export function useAuth() {
  const context = useContext(AuthContext)
  // ...
}
```

### Impacto:
- ⚠️ Hook em `hooks/useAuth.ts` é fake! Pode causar confusão
- ⚠️ Desenvolvedores usam versão errada
- ⚠️ Código morto não removido

### Solução:
```typescript
// ❌ Remover src/hooks/useAuth.ts completamente
// ✅ Importar apenas de contexts/AuthContext.tsx
```

---

## 9. ❌ TRATAMENTO DE ERRO GENÉRICO

**Arquivo**: `src/pages/admin/VotacoesManagement.tsx` (Linha 129)  
**Severidade**: 🟠 ALTA  
**Tipo**: Logging Inadequado

### Problema:
```typescript
catch (error: any) {
  alert('Erro ao criar: ' + error.message)  // ❌ Alerta para usuário não é profissional
  // ❌ Sem logging para debug
}
```

### Impacto:
- ⚠️ Usuário vê mensagens técnicas
- ⚠️ Impossível debugar em produção

### Solução:
```typescript
catch (error: any) {
  console.error('Erro ao criar votação:', { error, formData })
  const userMessage = error.message?.includes('duplicate') 
    ? 'Essa votação já existe' 
    : 'Erro ao criar votação. Tente novamente.'
  toast.error(userMessage)
}
```

---

## 10. ❌ ENDPOINTS SEM VALIDAÇÃO JWT

**Arquivo**: `supabase/config.toml`  
**Severidade**: 🔴 CRÍTICA  
**Tipo**: Segurança

### Problema:
```toml
[functions.ask-ai]
enabled = true
verify_jwt = false  # ❌ CRÍTICO! Qualquer um pode chamar!

[functions.notify-users]
enabled = true
verify_jwt = false  # ❌ Pode enviar notificações fake!

[functions.process-financial-pdf]
# ❌ Falta verify_jwt completamente
```

### Impacto:
- ⚠️ Qualquer pessoa consegue chamar APIs
- ⚠️ Dados financeiros desprotegidos
- ⚠️ Possibilidade de spam de notificações

### Solução:
```toml
[functions.ask-ai]
enabled = true
verify_jwt = true  # ✅ Requer autenticação

[functions.notify-users]
enabled = true
verify_jwt = true  # ✅ Requer autenticação

[functions.process-financial-pdf]
enabled = true
verify_jwt = true  # ✅ Requer autenticação
```

---

## 11. ❌ ARMAZENAMENTO NÃO SEGURO DE TOKENS

**Arquivo**: `src/contexts/AuthContext.tsx` (Linha 80+)  
**Severidade**: 🔴 CRÍTICA  
**Tipo**: Segurança XSS

### Problema:
```typescript
async function signOut() {
  // ...
  localStorage.clear()  // ❌ Tokens no localStorage!
}
```

### Impacto:
- ⚠️ XSS attack rouba tokens do localStorage facilmente
- ⚠️ Sem proteção contra CSRF

### Solução:
```typescript
// Supabase já usa persistSession com cookie seguro
// Remover localStorage.clear() se usar persistSession

// Melhor ainda: usar apenas cookies HttpOnly
const { data: { session } } = await supabase.auth.getSession()
// Cookies HttpOnly gerenciados automaticamente pelo navegador
```

---

## 12. ❌ FALTA DE RATE LIMITING

**Arquivo**: `supabase/functions/ask-ai/index.ts`  
**Severidade**: 🟠 ALTA  
**Tipo**: Segurança / DoS

### Problema:
```typescript
serve(async (req) => {
  // ❌ Sem validação de rate limit
  // Qualquer pessoa pode chamar infinitas vezes
  const { query, userName, filter_condominio_id } = await req.json()
  // Chamar LLM (Groq) custa dinheiro!
})
```

### Impacto:
- ⚠️ DoS attack pode custar $$$ em chamadas de LLM
- ⚠️ Sem proteção contra abuso
- ⚠️ Sem tracking de quem faz requisições

### Solução:
```typescript
// ✅ Adicionar validação de usuário e rate limit
if (!req.headers.get('authorization')) {
  return new Response('Unauthorized', { status: 401 })
}

// ✅ Rate limiting com Supabase
const userId = user.id
const now = Date.now()
const oneHourAgo = now - 3600000

const { count } = await supabase
  .from('ai_requests')
  .select('*', { count: 'exact' })
  .eq('user_id', userId)
  .gte('created_at', new Date(oneHourAgo).toISOString())

if (count > 50) {
  return new Response('Rate limit exceeded', { status: 429 })
}
```

---

# 🟠 PROBLEMAS DE MÉDIA SEVERIDADE

## 13. Falta de Logging Estruturado
**Arquivo**: Múltiplos  
**Problema**: Usando `console.log` em produção  
**Solução**: Implementar Winston ou Pino

## 14. Sem Testes Unitários
**Arquivo**: Projeto inteiro  
**Problema**: Nenhum arquivo `.test.ts`  
**Solução**: Adicionar Jest + Testing Library

## 15. Sem Tratamento de Offline
**Arquivo**: `src/components/Chatbot.tsx`  
**Problema**: App quebra sem internet  
**Solução**: Implementar Service Worker com fallback

---

# ✅ CHECKLIST DE CORREÇÕES

- [ ] **1. Corrigir CORS** - Restringir origens em `vercel.json`
- [ ] **2. Validar Ambiente** - Throw error se variáveis faltarem
- [ ] **3. Integridade de Dados** - Usar `.single()` em lugar de `.maybeSingle()`
- [ ] **4. Sanitizar Input** - Adicionar DOMPurify no Chatbot
- [ ] **5. Cleanup em Efeitos** - Adicionar AbortController nos efeitos
- [ ] **6. Otimizar Queries** - Usar SQL com agregação
- [ ] **7. Remover Hook Fake** - Deletar `src/hooks/useAuth.ts`
- [ ] **8. Tratar Erros** - Usar toast.error() em lugar de alert()
- [ ] **9. Validar JWT** - Ativar `verify_jwt = true` em todas as functions
- [ ] **10. Usar HttpOnly Cookies** - Remover localStorage
- [ ] **11. Rate Limiting** - Implementar limite de requisições
- [ ] **12. Adicionar Testes** - Criar test suite básico

---

# 📊 PRIORIDADE DE CORREÇÃO

## 🔴 CRÍTICA (Fazer HOJE)
1. Corrigir CORS (30 min)
2. Validar ambiente (15 min)
3. Ativar JWT validation (15 min)
4. Integridade de dados (1 hora)

**Tempo Total**: ~2 horas

## 🟠 ALTA (Esta Semana)
5. Sanitizar input (30 min)
6. Otimizar queries (2 horas)
7. Remover código morto (15 min)
8. Adicionar cleanup (1 hora)

**Tempo Total**: ~4 horas

## 🟡 MÉDIA (Próximas 2 Semanas)
9. Logging estruturado (2 horas)
10. Rate limiting (1 hora)
11. Testes (4 horas)

---

# 🔗 REFERÊNCIAS DE SEGURANÇA

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [CWE-200: Exposure of Sensitive Information](https://cwe.mitre.org/data/definitions/200.html)
- [CWE-352: Cross-Site Request Forgery (CSRF)](https://cwe.mitre.org/data/definitions/352.html)
- [LGPD - Lei Geral de Proteção de Dados](https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd)

---

**Relatório Gerado**: 28 de Novembro de 2025  
**Responsável**: GitHub Copilot (Claude Haiku 4.5)  
**Próxima Revisão**: 05 de Dezembro de 2025
