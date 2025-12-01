# 🚀 ROADMAP TÉCNICO: Versix Norma → 9.0/10

**Objetivo:** Elevar o rating técnico de 5.7/10 para 9.0/10  
**Duração Total:** 12 semanas (3 meses)  
**Data de Início:** Dezembro 2025  

---

## 📊 Matriz de Transformação

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         MAPA DE EVOLUÇÃO DOS RATINGS                           │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│   DIMENSÃO              ATUAL    META     DELTA    SPRINT                      │
│   ─────────────────────────────────────────────────────────                    │
│   CI/CD                 2.0 →    9.0      +7.0     Sprint 1                    │
│   Cobertura Testes      3.5 →    9.0      +5.5     Sprint 2-4                  │
│   Busca Vetorial (IA)   4.5 →    9.0      +4.5     Sprint 3                    │
│   DevOps/Observability  4.0 →    9.0      +5.0     Sprint 5                    │
│   Documentação          5.5 →    9.0      +3.5     Sprint 6                    │
│   Segurança             6.5 →    9.0      +2.5     Sprint 7                    │
│   UX/Acessibilidade     6.0 →    9.0      +3.0     Sprint 8                    │
│   Arquitetura           7.5 →    9.0      +1.5     Sprint 9                    │
│   Qualidade Código      7.0 →    9.0      +2.0     Contínuo                    │
│                                                                                │
│   RATING GERAL          5.7 →    9.0      +3.3                                 │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗓️ VISÃO GERAL DOS SPRINTS

```
SEMANA   1    2    3    4    5    6    7    8    9   10   11   12
         ├────┴────┼────┴────┼────┴────┼────┴────┼────┴────┼────┴────┤
         │ SPRINT 1│ SPRINT 2│ SPRINT 3│ SPRINT 4│ SPRINT 5│ SPRINT 6│
         │  CI/CD  │ TESTES  │   IA    │ TESTES+ │OBSERVAB.│  DOCS   │
         │         │  BASE   │  REAL   │ AVANÇADO│         │         │
         ├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
RATING   │  6.2    │   6.8   │   7.4   │   8.0   │   8.5   │   9.0   │
         └─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

# 🔷 SPRINT 1: CI/CD Foundation (Semanas 1-2)

## Objetivo
Implementar pipeline de CI/CD completo que garanta qualidade em cada commit.

## Entregáveis

### 1.1 GitHub Actions - Pipeline Principal

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  # ═══════════════════════════════════════════════════════════════
  # JOB 1: Qualidade de Código
  # ═══════════════════════════════════════════════════════════════
  quality:
    name: 🔍 Code Quality
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: TypeScript Check
        run: npx tsc --noEmit

      - name: ESLint
        run: npm run lint

      - name: Prettier Check
        run: npx prettier --check "src/**/*.{ts,tsx}"

  # ═══════════════════════════════════════════════════════════════
  # JOB 2: Testes Unitários
  # ═══════════════════════════════════════════════════════════════
  test:
    name: 🧪 Unit Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      
      - name: Run Tests with Coverage
        run: npm run test:coverage -- --watchAll=false
        
      - name: Upload Coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          fail_ci_if_error: true

      - name: Check Coverage Threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Coverage: $COVERAGE%"
          if (( $(echo "$COVERAGE < 50" | bc -l) )); then
            echo "❌ Coverage below 50% threshold!"
            exit 1
          fi

  # ═══════════════════════════════════════════════════════════════
  # JOB 3: Build
  # ═══════════════════════════════════════════════════════════════
  build:
    name: 🏗️ Build
    runs-on: ubuntu-latest
    needs: [quality, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - run: npm run build
      
      - name: Upload Build Artifact
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/
          retention-days: 7

  # ═══════════════════════════════════════════════════════════════
  # JOB 4: E2E Tests (apenas em PRs para main)
  # ═══════════════════════════════════════════════════════════════
  e2e:
    name: 🎭 E2E Tests
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - name: Cypress Run
        uses: cypress-io/github-action@v6
        with:
          build: npm run build
          start: npm run preview
          wait-on: 'http://localhost:4173'

  # ═══════════════════════════════════════════════════════════════
  # JOB 5: Deploy Preview (Vercel)
  # ═══════════════════════════════════════════════════════════════
  deploy-preview:
    name: 🚀 Deploy Preview
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel (Preview)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  # ═══════════════════════════════════════════════════════════════
  # JOB 6: Deploy Production
  # ═══════════════════════════════════════════════════════════════
  deploy-production:
    name: 🌐 Deploy Production
    runs-on: ubuntu-latest
    needs: [build, test]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel (Production)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### 1.2 Pre-commit Hooks (Husky + lint-staged)

```bash
# Instalar dependências
npm install -D husky lint-staged @commitlint/cli @commitlint/config-conventional
```

```json
// package.json - adicionar
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": "prettier --write"
  }
}
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

```bash
# .husky/commit-msg
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit ${1}
```

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor', 
      'test', 'chore', 'perf', 'ci', 'revert'
    ]],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72]
  }
};
```

### 1.3 Configuração de Secrets

```bash
# GitHub Secrets necessários:
VERCEL_TOKEN=xxx
VERCEL_ORG_ID=xxx
VERCEL_PROJECT_ID=xxx
CODECOV_TOKEN=xxx
SUPABASE_URL=xxx
SUPABASE_ANON_KEY=xxx
```

## Métricas de Sucesso - Sprint 1

| Métrica | Antes | Depois | Status |
|---------|-------|--------|--------|
| Pipeline automático | ❌ | ✅ | |
| Lint em cada commit | ❌ | ✅ | |
| Testes em cada PR | ❌ | ✅ | |
| Deploy automático | ❌ | ✅ | |
| Conventional commits | ❌ | ✅ | |
| **Rating CI/CD** | 2.0 | 8.0 | |

---

# 🔷 SPRINT 2: Testes Base (Semanas 3-4)

## Objetivo
Elevar cobertura de testes de 15% para 50% focando em módulos críticos.

## Priorização de Testes

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                    MATRIZ DE PRIORIZAÇÃO DE TESTES                             │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│   CRITICIDADE              MÓDULO                    COBERTURA   META          │
│   ────────────────────────────────────────────────────────────────────         │
│   🔴 CRÍTICO              AuthContext.tsx            69% →       95%           │
│   🔴 CRÍTICO              useChatbot.ts              ~20% →      90%           │
│   🔴 CRÍTICO              useAuth.ts                 ~30% →      90%           │
│   🟠 ALTO                 ask-ai/index.ts            0% →        80%           │
│   🟠 ALTO                 process-document/index.ts  0% →        80%           │
│   🟡 MÉDIO                páginas admin/*            0% →        60%           │
│   🟡 MÉDIO                hooks/queries/*            62% →       85%           │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Testes do AuthContext (Crítico)

```typescript
// src/contexts/AuthContext.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

// Mock do Supabase
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      }))
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn()
      }))
    }))
  }
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Estado Inicial', () => {
    it('deve iniciar com loading=true e user=null', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: null
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      })

      expect(result.current.loading).toBe(true)
      expect(result.current.user).toBeNull()
    })
  })

  describe('Login', () => {
    it('deve fazer login com sucesso', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User' }
      }

      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'morador',
        condominio_id: 'condo-123'
      }

      ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: mockUser, session: { access_token: 'token' } },
        error: null
      })

      ;(supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
          })
        })
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      })

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123')
      })

      await waitFor(() => {
        expect(result.current.user).toEqual(mockProfile)
        expect(result.current.loading).toBe(false)
      })
    })

    it('deve retornar erro com credenciais inválidas', async () => {
      ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      })

      await act(async () => {
        const response = await result.current.signIn('wrong@example.com', 'wrong')
        expect(response.error).toBeTruthy()
      })
    })
  })

  describe('Logout', () => {
    it('deve fazer logout e limpar o estado', async () => {
      ;(supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      })

      await act(async () => {
        await result.current.signOut()
      })

      expect(result.current.user).toBeNull()
    })
  })

  describe('Verificação de Roles', () => {
    it('isAdmin deve retornar true para role admin', async () => {
      const mockProfile = { id: '1', role: 'admin', email: 'admin@test.com' }
      
      // Setup do mock para retornar usuário admin
      ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { 
          session: { 
            user: { id: '1', email: 'admin@test.com' },
            access_token: 'token'
          } 
        }
      })

      ;(supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
          })
        })
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isAdmin).toBe(true)
        expect(result.current.isSindico).toBe(false)
      })
    })

    it('isSindico deve retornar true para role sindico', async () => {
      const mockProfile = { id: '1', role: 'sindico', email: 'sindico@test.com' }
      
      ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { 
          session: { 
            user: { id: '1', email: 'sindico@test.com' },
            access_token: 'token'
          } 
        }
      })

      ;(supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
          })
        })
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isSindico).toBe(true)
      })
    })
  })
})
```

### 2.2 Testes do useChatbot (Crítico)

```typescript
// src/hooks/useChatbot.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChatbot } from './useChatbot'
import { useAuth } from './useAuth'

// Mock do useAuth
jest.mock('./useAuth', () => ({
  useAuth: jest.fn()
}))

// Mock do fetch global
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('useChatbot', () => {
  const mockUser = {
    id: 'user-123',
    full_name: 'Test User',
    condominio_id: 'condo-123'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      session: { access_token: 'mock-token' }
    })
  })

  describe('Estado Inicial', () => {
    it('deve iniciar com mensagem de boas-vindas', () => {
      const { result } = renderHook(() => useChatbot({ isOpen: true }))

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].role).toBe('assistant')
      expect(result.current.messages[0].content).toContain('Olá')
    })

    it('deve iniciar sem typing indicator', () => {
      const { result } = renderHook(() => useChatbot({ isOpen: true }))
      expect(result.current.isTyping).toBe(false)
    })
  })

  describe('Envio de Mensagens', () => {
    it('deve adicionar mensagem do usuário ao enviar', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          answer: 'Resposta da IA',
          sources: []
        })
      })

      const { result } = renderHook(() => useChatbot({ isOpen: true }))

      act(() => {
        result.current.setInputText('Qual o horário da piscina?')
      })

      await act(async () => {
        await result.current.handleSendMessage({ preventDefault: jest.fn() } as any)
      })

      expect(result.current.messages).toContainEqual(
        expect.objectContaining({
          role: 'user',
          content: 'Qual o horário da piscina?'
        })
      )
    })

    it('deve mostrar indicador de typing durante a requisição', async () => {
      let resolvePromise: (value: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockFetch.mockReturnValueOnce(pendingPromise)

      const { result } = renderHook(() => useChatbot({ isOpen: true }))

      act(() => {
        result.current.setInputText('Pergunta teste')
      })

      act(() => {
        result.current.handleSendMessage({ preventDefault: jest.fn() } as any)
      })

      expect(result.current.isTyping).toBe(true)

      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ answer: 'Resposta', sources: [] })
        })
      })

      await waitFor(() => {
        expect(result.current.isTyping).toBe(false)
      })
    })

    it('deve limpar input após envio', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Resposta', sources: [] })
      })

      const { result } = renderHook(() => useChatbot({ isOpen: true }))

      act(() => {
        result.current.setInputText('Teste')
      })

      await act(async () => {
        await result.current.handleSendMessage({ preventDefault: jest.fn() } as any)
      })

      expect(result.current.inputText).toBe('')
    })
  })

  describe('Tratamento de Erros', () => {
    it('deve exibir mensagem de erro quando API falha', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' })
      })

      const { result } = renderHook(() => useChatbot({ isOpen: true }))

      act(() => {
        result.current.setInputText('Pergunta')
      })

      await act(async () => {
        await result.current.handleSendMessage({ preventDefault: jest.fn() } as any)
      })

      expect(result.current.messages).toContainEqual(
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('Erro')
        })
      )
    })

    it('deve exibir mensagem de rate limit (429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ answer: 'Limite atingido' })
      })

      const { result } = renderHook(() => useChatbot({ isOpen: true }))

      act(() => {
        result.current.setInputText('Pergunta')
      })

      await act(async () => {
        await result.current.handleSendMessage({ preventDefault: jest.fn() } as any)
      })

      expect(result.current.messages).toContainEqual(
        expect.objectContaining({
          content: expect.stringContaining('Limite')
        })
      )
    })
  })

  describe('Opções de Menu', () => {
    it('deve processar opção de FAQ corretamente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ answer: 'Informações sobre FAQ', sources: [] })
      })

      const { result } = renderHook(() => useChatbot({ isOpen: true }))

      await act(async () => {
        await result.current.handleOptionClick({
          type: 'query',
          value: 'O que é o Versix Norma?',
          label: 'FAQ'
        })
      })

      expect(mockFetch).toHaveBeenCalled()
    })
  })
})
```

### 2.3 Testes das Páginas Admin

```typescript
// src/pages/admin/UserManagement.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import UserManagement from './UserManagement'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

jest.mock('../../hooks/useAuth')
jest.mock('../../lib/supabase')

const mockUsers = [
  { id: '1', email: 'user1@test.com', full_name: 'User 1', role: 'morador', unit_number: '101' },
  { id: '2', email: 'user2@test.com', full_name: 'User 2', role: 'pending', unit_number: '102' },
]

const renderWithProviders = (component: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('UserManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({
      user: { id: 'admin-1', role: 'admin', condominio_id: 'condo-1' },
      isAdmin: true
    })

    ;(supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      })
    })
  })

  it('deve renderizar lista de usuários', async () => {
    renderWithProviders(<UserManagement />)

    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument()
      expect(screen.getByText('User 2')).toBeInTheDocument()
    })
  })

  it('deve filtrar usuários pendentes', async () => {
    renderWithProviders(<UserManagement />)

    await waitFor(() => {
      expect(screen.getByText('User 1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Pendentes'))

    await waitFor(() => {
      expect(screen.getByText('User 2')).toBeInTheDocument()
    })
  })

  it('deve aprovar usuário pendente', async () => {
    renderWithProviders(<UserManagement />)

    await waitFor(() => {
      expect(screen.getByText('User 2')).toBeInTheDocument()
    })

    const approveButton = screen.getAllByText('Aprovar')[0]
    fireEvent.click(approveButton)

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('users')
    })
  })

  it('deve exibir mensagem quando não há usuários', async () => {
    ;(supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      })
    })

    renderWithProviders(<UserManagement />)

    await waitFor(() => {
      expect(screen.getByText(/nenhum usuário/i)).toBeInTheDocument()
    })
  })
})
```

### 2.4 Configuração de Coverage Threshold

```javascript
// vitest.config.ts - atualizar
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.stories.tsx',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ],
      thresholds: {
        global: {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50
        },
        // Thresholds específicos para módulos críticos
        'src/contexts/AuthContext.tsx': {
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/hooks/useChatbot.ts': {
          branches: 80,
          functions: 85,
          lines: 85
        }
      }
    }
  }
})
```

## Métricas de Sucesso - Sprint 2

| Métrica | Antes | Depois | Status |
|---------|-------|--------|--------|
| Cobertura Global | 15.15% | 50%+ | |
| AuthContext | 69% | 95% | |
| useChatbot | ~20% | 90% | |
| useAuth | ~30% | 90% | |
| Páginas Admin | 0% | 50% | |
| **Rating Testes** | 3.5 | 6.5 | |

---

# 🔷 SPRINT 3: IA Real com Embeddings (Semanas 5-6)

## Objetivo
Implementar busca semântica real usando HuggingFace Inference API.

### 3.1 Módulo de Embeddings

```typescript
// supabase/functions/_shared/embeddings-hf.ts

const HF_API_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"

interface EmbeddingResponse {
  embedding: number[]
  cached: boolean
  error?: string
}

// Cache em memória para embeddings (válido por 1 hora)
const embeddingCache = new Map<string, { embedding: number[], timestamp: number }>()
const CACHE_TTL = 3600000 // 1 hora

function getCacheKey(text: string): string {
  return text.toLowerCase().trim().substring(0, 512)
}

export async function generateEmbedding(text: string): Promise<EmbeddingResponse> {
  const HF_TOKEN = Deno.env.get('HUGGINGFACE_TOKEN')
  
  if (!HF_TOKEN) {
    console.warn('⚠️ HUGGINGFACE_TOKEN não configurado')
    return {
      embedding: Array(384).fill(0),
      cached: false,
      error: 'Token não configurado'
    }
  }

  const cacheKey = getCacheKey(text)
  
  // Verificar cache
  const cached = embeddingCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('✅ Embedding recuperado do cache')
    return { embedding: cached.embedding, cached: true }
  }

  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: text.substring(0, 512),
        options: { 
          wait_for_model: true,
          use_cache: true
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ HuggingFace API error:', response.status, errorText)
      
      // Se for rate limit, retornar fallback
      if (response.status === 429) {
        return {
          embedding: Array(384).fill(0),
          cached: false,
          error: 'Rate limit atingido'
        }
      }
      
      throw new Error(`HF API error: ${response.status}`)
    }

    const result = await response.json()
    
    // O modelo retorna array 2D - precisamos fazer mean pooling
    let embedding: number[]
    
    if (Array.isArray(result) && Array.isArray(result[0])) {
      // Mean pooling dos token embeddings
      const numTokens = result.length
      const dims = result[0].length
      embedding = new Array(dims).fill(0)
      
      for (const tokenEmb of result) {
        for (let i = 0; i < dims; i++) {
          embedding[i] += tokenEmb[i] / numTokens
        }
      }
    } else if (Array.isArray(result)) {
      embedding = result
    } else {
      throw new Error('Formato de resposta inesperado')
    }

    // Normalizar o vetor (L2 normalization)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    embedding = embedding.map(val => val / magnitude)

    // Salvar no cache
    embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() })
    
    console.log(`✅ Embedding gerado: ${embedding.length} dimensões`)
    return { embedding, cached: false }

  } catch (error) {
    console.error('❌ Erro ao gerar embedding:', error)
    return {
      embedding: Array(384).fill(0),
      cached: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}

// Batch embedding para múltiplos textos
export async function generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResponse[]> {
  const results: EmbeddingResponse[] = []
  
  // Processar em batches de 5 para evitar rate limit
  for (let i = 0; i < texts.length; i += 5) {
    const batch = texts.slice(i, i + 5)
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text))
    )
    results.push(...batchResults)
    
    // Delay entre batches
    if (i + 5 < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  return results
}
```

### 3.2 Ask-AI com Busca Vetorial Real

```typescript
// supabase/functions/ask-ai/index.ts - VERSÃO ATUALIZADA

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateEmbedding } from '../_shared/embeddings-hf.ts'

const ALLOWED_ORIGINS = [
  'https://versixnorma.com.br',
  'https://www.versixnorma.com.br',
  'http://localhost:5173'
]

function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0]
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin') || undefined
  const corsHeaders = getCorsHeaders(origin)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ═══════════════════════════════════════════════════════════════
    // 1. VALIDAÇÃO E AUTENTICAÇÃO
    // ═══════════════════════════════════════════════════════════════
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ answer: 'Não autorizado. Faça login primeiro.' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const { query, userName, filter_condominio_id } = await req.json()

    if (!query?.trim() || query.length > 500) {
      throw new Error('Query inválida: deve ter entre 1 e 500 caracteres')
    }

    if (!filter_condominio_id) {
      throw new Error('Condomínio não especificado')
    }

    // Configurações
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    const QDRANT_URL = Deno.env.get('QDRANT_URL')
    const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY')
    const COLLECTION_NAME = Deno.env.get('QDRANT_COLLECTION_NAME') || 'norma_knowledge_base'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

    if (!GROQ_API_KEY || !QDRANT_URL || !QDRANT_API_KEY) {
      throw new Error('Configurações de ambiente ausentes')
    }

    console.log(`🔍 Query: "${query}"`)
    console.log(`🏢 Condomínio: ${filter_condominio_id}`)

    // ═══════════════════════════════════════════════════════════════
    // 2. GERAR EMBEDDING DA QUERY (BUSCA SEMÂNTICA REAL)
    // ═══════════════════════════════════════════════════════════════
    console.log('🧠 Gerando embedding da query...')
    const { embedding: queryEmbedding, error: embError, cached } = await generateEmbedding(query)
    
    if (embError) {
      console.warn(`⚠️ Erro no embedding: ${embError}. Usando fallback.`)
    }

    const hasRealEmbedding = queryEmbedding.some(v => v !== 0)
    console.log(`📊 Embedding ${cached ? '(cache)' : '(novo)'}: ${hasRealEmbedding ? 'REAL' : 'FALLBACK'}`)

    let documentResults: any[] = []

    // ═══════════════════════════════════════════════════════════════
    // 3. BUSCA VETORIAL NO QDRANT
    // ═══════════════════════════════════════════════════════════════
    if (hasRealEmbedding) {
      console.log('🔎 Busca vetorial semântica no Qdrant...')
      
      const searchResp = await fetch(
        `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`,
        {
          method: 'POST',
          headers: {
            'api-key': QDRANT_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vector: queryEmbedding,
            limit: 5,
            score_threshold: 0.35, // Cosine similarity mínimo
            filter: {
              must: [{
                key: 'condominio_id',
                match: { value: filter_condominio_id }
              }]
            },
            with_payload: true
          })
        }
      )

      if (searchResp.ok) {
        const searchData = await searchResp.json()
        documentResults = (searchData.result || []).map((r: any) => ({
          ...r,
          type: 'document',
          relevance_score: r.score
        }))
        console.log(`📄 ${documentResults.length} documentos encontrados via busca vetorial`)
      } else {
        console.error('❌ Erro na busca vetorial:', await searchResp.text())
      }
    } else {
      // ═══════════════════════════════════════════════════════════════
      // FALLBACK: Busca por palavras-chave (quando embedding falha)
      // ═══════════════════════════════════════════════════════════════
      console.log('⚠️ Fallback: busca por palavras-chave...')
      
      const scrollResp = await fetch(
        `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`,
        {
          method: 'POST',
          headers: {
            'api-key': QDRANT_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filter: {
              must: [{ key: 'condominio_id', match: { value: filter_condominio_id } }]
            },
            limit: 50,
            with_payload: true
          })
        }
      )

      if (scrollResp.ok) {
        const scrollData = await scrollResp.json()
        const allPoints = scrollData.result?.points || []
        
        // Ranking manual por keywords
        const queryWords = query
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .split(/\s+/)
          .filter((w: string) => w.length > 2)

        documentResults = allPoints
          .map((point: any) => {
            const content = (point.payload.content || '').toLowerCase()
            const title = (point.payload.title || '').toLowerCase()
            
            let score = 0
            queryWords.forEach((word: string) => {
              if (title.includes(word)) score += 5
              const matches = (content.match(new RegExp(word, 'g')) || []).length
              score += matches
            })
            
            return { ...point, score, type: 'document', relevance_score: score / 10 }
          })
          .filter((r: any) => r.score > 0)
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, 5)
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. BUSCA DE FAQs COM EMBEDDING
    // ═══════════════════════════════════════════════════════════════
    let faqResults: any[] = []
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      console.log('❓ Buscando FAQs...')
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      
      const { data: faqs, error: faqError } = await supabase
        .from('faqs')
        .select('id, question, answer, category')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!faqError && faqs) {
        // Se temos embedding real, calcular similaridade com FAQs
        if (hasRealEmbedding) {
          const faqsWithScores = await Promise.all(
            faqs.slice(0, 20).map(async (faq: any) => {
              const { embedding: faqEmb } = await generateEmbedding(faq.question)
              
              // Cosine similarity
              const dotProduct = queryEmbedding.reduce((sum, val, i) => sum + val * faqEmb[i], 0)
              const similarity = dotProduct // Já normalizado
              
              return {
                ...faq,
                type: 'faq',
                relevance_score: similarity,
                payload: { title: faq.question, content: faq.answer }
              }
            })
          )
          
          faqResults = faqsWithScores
            .filter(f => f.relevance_score > 0.4)
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 3)
        } else {
          // Fallback: busca por keywords nas FAQs
          const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
          
          faqResults = faqs
            .map((faq: any) => {
              let score = 0
              const q = faq.question.toLowerCase()
              const a = faq.answer.toLowerCase()
              
              queryWords.forEach(word => {
                if (q.includes(word)) score += 6
                if (a.includes(word)) score += 2
              })
              
              return {
                ...faq,
                type: 'faq',
                relevance_score: score / 10,
                payload: { title: faq.question, content: faq.answer }
              }
            })
            .filter((f: any) => f.relevance_score > 0)
            .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
            .slice(0, 3)
        }
        
        console.log(`✅ ${faqResults.length} FAQs relevantes encontradas`)
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. COMBINAR E RANQUEAR RESULTADOS
    // ═══════════════════════════════════════════════════════════════
    const allResults = [...documentResults, ...faqResults]
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 4)

    console.log(`📊 Total: ${allResults.length} resultados combinados`)

    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({
          answer: `Não encontrei informações específicas sobre "${query}" nos documentos ou FAQs do condomínio. Você pode reformular a pergunta ou entrar em contato com a administração.`,
          sources: [],
          search_type: hasRealEmbedding ? 'semantic' : 'keyword'
        }),
        { headers: corsHeaders }
      )
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. GERAR RESPOSTA COM GROQ
    // ═══════════════════════════════════════════════════════════════
    const contextParts = allResults.map((r, i) => {
      const type = r.type === 'faq' ? '❓ FAQ' : '📄 Documento'
      const title = r.payload?.title || 'Sem título'
      const content = r.payload?.content || ''
      return `[Fonte ${i + 1} - ${type}: ${title}]\n${content.substring(0, 800)}`
    })

    const contextText = contextParts.join('\n\n---\n\n')

    const systemPrompt = `Você é a Norma, assistente virtual inteligente de gestão condominial.

**INSTRUÇÕES:**
1. Responda APENAS com base no CONTEXTO fornecido
2. Se a informação não estiver no contexto, diga claramente
3. Seja concisa (máximo 200 palavras)
4. Cite a fonte quando possível
5. Use português brasileiro, tom profissional mas acessível
6. Priorize FAQs quando forem mais diretas

**CONTEXTO:**
${contextText}

**IMPORTANTE:** Nunca invente informações. Base suas respostas estritamente no contexto.`

    console.log('🤖 Gerando resposta com Groq...')

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.1,
        max_tokens: 600
      })
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      console.error('❌ Groq error:', errorText)
      
      // Fallback: retornar contexto diretamente
      return new Response(
        JSON.stringify({
          answer: `Encontrei informações relevantes:\n\n${allResults[0].payload.content.substring(0, 500)}...`,
          sources: allResults.map(r => ({ title: r.payload.title, type: r.type })),
          fallback: true
        }),
        { headers: corsHeaders }
      )
    }

    const groqData = await groqResponse.json()
    const answer = groqData.choices?.[0]?.message?.content || 'Erro ao gerar resposta'

    console.log(`✅ Resposta gerada (${answer.length} chars)`)

    return new Response(
      JSON.stringify({
        answer,
        sources: allResults.map(r => ({
          title: r.payload.title,
          type: r.type,
          score: Math.round(r.relevance_score * 100) / 100,
          excerpt: r.payload.content.substring(0, 150) + '...'
        })),
        search_type: hasRealEmbedding ? 'semantic' : 'keyword',
        model: 'llama-3.3-70b'
      }),
      { headers: corsHeaders }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('❌ Erro:', errorMessage)
    
    return new Response(
      JSON.stringify({
        answer: `Desculpe, ocorreu um erro técnico. Por favor, tente novamente em alguns instantes.`,
        error: errorMessage,
        sources: []
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
```

### 3.3 Script de Re-indexação

```typescript
// scripts/reindex-with-embeddings.ts

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const QDRANT_URL = process.env.QDRANT_URL!
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN!
const COLLECTION_NAME = 'norma_knowledge_base'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: text.substring(0, 512),
        options: { wait_for_model: true }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`HF API error: ${response.status}`)
  }

  const result = await response.json()
  
  // Mean pooling
  if (Array.isArray(result) && Array.isArray(result[0])) {
    const dims = result[0].length
    const embedding = new Array(dims).fill(0)
    for (const tokenEmb of result) {
      for (let i = 0; i < dims; i++) {
        embedding[i] += tokenEmb[i] / result.length
      }
    }
    // L2 normalize
    const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0))
    return embedding.map(v => v / mag)
  }
  
  return result
}

async function reindex() {
  console.log('🚀 Iniciando re-indexação com embeddings reais...\n')

  // 1. Buscar todos os documentos existentes no Qdrant
  console.log('📥 Buscando documentos existentes...')
  
  const scrollResp = await fetch(
    `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`,
    {
      method: 'POST',
      headers: {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        limit: 1000,
        with_payload: true,
        with_vector: false
      })
    }
  )

  if (!scrollResp.ok) {
    throw new Error(`Qdrant scroll error: ${await scrollResp.text()}`)
  }

  const scrollData = await scrollResp.json()
  const existingPoints = scrollData.result?.points || []
  
  console.log(`📄 ${existingPoints.length} documentos encontrados\n`)

  // 2. Gerar novos embeddings
  const newPoints: any[] = []
  let processed = 0
  let errors = 0

  for (const point of existingPoints) {
    try {
      const content = point.payload.content || ''
      const title = point.payload.title || ''
      
      // Texto combinado para embedding
      const textForEmbedding = `${title}. ${content}`.substring(0, 512)
      
      console.log(`🔄 [${processed + 1}/${existingPoints.length}] Processando: ${title.substring(0, 50)}...`)
      
      const embedding = await generateEmbedding(textForEmbedding)
      
      newPoints.push({
        id: point.id,
        vector: embedding,
        payload: point.payload
      })

      processed++
      
      // Rate limiting: 1 request por 200ms
      await new Promise(r => setTimeout(r, 200))
      
    } catch (error) {
      console.error(`❌ Erro no documento ${point.id}:`, error)
      errors++
    }
  }

  console.log(`\n✅ ${processed} embeddings gerados, ${errors} erros\n`)

  // 3. Deletar collection antiga e recriar
  console.log('🗑️ Recriando collection...')
  
  // Deletar
  await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    method: 'DELETE',
    headers: { 'api-key': QDRANT_API_KEY }
  })

  // Recriar
  const createResp = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    method: 'PUT',
    headers: {
      'api-key': QDRANT_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vectors: {
        size: 384,
        distance: 'Cosine'
      }
    })
  })

  if (!createResp.ok) {
    throw new Error(`Erro ao criar collection: ${await createResp.text()}`)
  }

  console.log('✅ Collection recriada\n')

  // 4. Inserir pontos com novos embeddings
  console.log('📤 Inserindo pontos com embeddings reais...')
  
  // Batch upsert (100 por vez)
  for (let i = 0; i < newPoints.length; i += 100) {
    const batch = newPoints.slice(i, i + 100)
    
    const upsertResp = await fetch(
      `${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`,
      {
        method: 'PUT',
        headers: {
          'api-key': QDRANT_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ points: batch })
      }
    )

    if (!upsertResp.ok) {
      console.error(`❌ Erro no batch ${i}-${i + batch.length}:`, await upsertResp.text())
    } else {
      console.log(`✅ Batch ${i + 1}-${Math.min(i + 100, newPoints.length)} inserido`)
    }
  }

  console.log('\n🎉 Re-indexação concluída!')
  console.log(`📊 Total: ${newPoints.length} documentos com embeddings reais`)
}

reindex().catch(console.error)
```

### 3.4 Configuração de Ambiente

```bash
# Supabase Secrets
supabase secrets set HUGGINGFACE_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxx

# Local (.env.local)
HUGGINGFACE_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxx
```

## Métricas de Sucesso - Sprint 3

| Métrica | Antes | Depois | Status |
|---------|-------|--------|--------|
| Tipo de busca | Keyword (scroll) | Vetorial (semantic) | |
| Score threshold | N/A | 0.35 cosine | |
| Qualidade respostas | Baixa | Alta | |
| Cache de embeddings | ❌ | ✅ | |
| Fallback gracioso | ❌ | ✅ | |
| **Rating IA** | 4.5 | 8.5 | |

---

# 🔷 SPRINT 4: Testes Avançados (Semanas 7-8)

## Objetivo
Elevar cobertura de 50% para 80% e implementar testes de integração.

### 4.1 Testes de Integração E2E

```typescript
// cypress/e2e/chatbot-integration.cy.ts

describe('Chatbot Integration', () => {
  beforeEach(() => {
    cy.login('morador@test.com', 'password123')
    cy.visit('/dashboard')
  })

  it('deve abrir o chatbot ao clicar no FAB', () => {
    cy.get('[data-testid="chatbot-fab"]').click()
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains('Olá').should('be.visible')
  })

  it('deve enviar mensagem e receber resposta', () => {
    cy.get('[data-testid="chatbot-fab"]').click()
    
    cy.get('[data-testid="chat-input"]')
      .type('Qual o horário da piscina?')
    
    cy.get('[data-testid="chat-submit"]').click()
    
    // Aguardar resposta
    cy.get('[data-testid="chat-message-assistant"]', { timeout: 15000 })
      .should('have.length.gt', 1)
  })

  it('deve mostrar indicador de typing durante requisição', () => {
    cy.get('[data-testid="chatbot-fab"]').click()
    
    cy.intercept('POST', '**/ask-ai', {
      delay: 2000,
      body: { answer: 'Resposta teste', sources: [] }
    }).as('askAi')

    cy.get('[data-testid="chat-input"]').type('Teste')
    cy.get('[data-testid="chat-submit"]').click()
    
    cy.get('[data-testid="typing-indicator"]').should('be.visible')
    
    cy.wait('@askAi')
    cy.get('[data-testid="typing-indicator"]').should('not.exist')
  })

  it('deve tratar erro de rate limit graciosamente', () => {
    cy.get('[data-testid="chatbot-fab"]').click()
    
    cy.intercept('POST', '**/ask-ai', {
      statusCode: 429,
      body: { answer: 'Limite atingido' }
    }).as('rateLimited')

    cy.get('[data-testid="chat-input"]').type('Teste')
    cy.get('[data-testid="chat-submit"]').click()
    
    cy.wait('@rateLimited')
    cy.contains('Limite').should('be.visible')
  })
})
```

### 4.2 Testes de Acessibilidade Automatizados

```typescript
// cypress/e2e/accessibility.cy.ts

describe('Accessibility Tests', () => {
  beforeEach(() => {
    cy.injectAxe()
  })

  it('Dashboard deve passar verificação de acessibilidade', () => {
    cy.login('morador@test.com', 'password123')
    cy.visit('/dashboard')
    cy.checkA11y(null, {
      rules: {
        'color-contrast': { enabled: true },
        'label': { enabled: true },
        'button-name': { enabled: true }
      }
    })
  })

  it('Login deve ter labels acessíveis', () => {
    cy.visit('/login')
    cy.checkA11y()
  })

  it('Chatbot deve ser navegável por teclado', () => {
    cy.login('morador@test.com', 'password123')
    cy.visit('/dashboard')
    
    // Tab para o FAB
    cy.get('body').tab()
    cy.focused().should('have.attr', 'data-testid', 'chatbot-fab')
    
    // Enter para abrir
    cy.focused().type('{enter}')
    cy.get('[role="dialog"]').should('be.visible')
    
    // Tab para input
    cy.focused().tab()
    cy.focused().should('have.attr', 'data-testid', 'chat-input')
    
    // Escape para fechar
    cy.get('body').type('{esc}')
    cy.get('[role="dialog"]').should('not.exist')
  })
})
```

### 4.3 Testes de Performance

```typescript
// cypress/e2e/performance.cy.ts

describe('Performance Tests', () => {
  it('Dashboard deve carregar em menos de 3 segundos', () => {
    cy.login('morador@test.com', 'password123')
    
    const start = performance.now()
    cy.visit('/dashboard')
    cy.get('[data-testid="dashboard-loaded"]').should('exist')
    
    cy.then(() => {
      const loadTime = performance.now() - start
      expect(loadTime).to.be.lessThan(3000)
    })
  })

  it('Chatbot deve responder em menos de 10 segundos', () => {
    cy.login('morador@test.com', 'password123')
    cy.visit('/dashboard')
    
    cy.get('[data-testid="chatbot-fab"]').click()
    
    const start = performance.now()
    
    cy.get('[data-testid="chat-input"]').type('Teste de performance')
    cy.get('[data-testid="chat-submit"]').click()
    
    cy.get('[data-testid="chat-message-assistant"]', { timeout: 15000 })
      .should('have.length.gt', 1)
    
    cy.then(() => {
      const responseTime = performance.now() - start
      expect(responseTime).to.be.lessThan(10000)
    })
  })
})
```

## Métricas de Sucesso - Sprint 4

| Métrica | Antes | Depois | Status |
|---------|-------|--------|--------|
| Cobertura global | 50% | 80% | |
| Testes E2E | 7 | 15+ | |
| Testes a11y | 0 | 5+ | |
| Testes performance | 0 | 3+ | |
| **Rating Testes** | 6.5 | 9.0 | |

---

# 🔷 SPRINT 5: Observabilidade (Semanas 9-10)

## Objetivo
Implementar monitoramento completo com métricas, logs e alertas.

### 5.1 Sentry - Configuração Avançada

```typescript
// src/lib/sentry.ts

import * as Sentry from '@sentry/react'
import { BrowserTracing } from '@sentry/tracing'

export function initSentry() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        new BrowserTracing({
          tracePropagationTargets: [
            'localhost',
            /^https:\/\/versixnorma\.com\.br/,
            /^https:\/\/.*\.supabase\.co/
          ],
        }),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Performance
      tracesSampleRate: 0.2,
      
      // Session Replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Contexto
      environment: import.meta.env.MODE,
      release: `versix-norma@${import.meta.env.VITE_APP_VERSION}`,
      
      // Filtros
      beforeSend(event, hint) {
        // Ignorar erros de rede conhecidos
        if (event.exception?.values?.[0]?.value?.includes('NetworkError')) {
          return null
        }
        
        // Remover dados sensíveis
        if (event.request?.data) {
          const data = JSON.parse(event.request.data)
          delete data.password
          delete data.token
          event.request.data = JSON.stringify(data)
        }
        
        return event
      },
      
      // Tags padrão
      initialScope: {
        tags: {
          app: 'versix-norma',
          platform: 'web'
        }
      }
    })
  }
}

// Funções utilitárias
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('custom', context)
    }
    Sentry.captureException(error)
  })
}

export function setUserContext(user: { id: string; email: string; role: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role
  })
}

export function trackTransaction(name: string, op: string) {
  return Sentry.startTransaction({ name, op })
}
```

### 5.2 Métricas Customizadas

```typescript
// src/lib/metrics.ts

interface MetricEvent {
  name: string
  value: number
  tags?: Record<string, string>
  timestamp?: number
}

class MetricsCollector {
  private buffer: MetricEvent[] = []
  private flushInterval: number = 10000 // 10 segundos

  constructor() {
    // Flush periódico
    setInterval(() => this.flush(), this.flushInterval)
    
    // Flush ao sair da página
    window.addEventListener('beforeunload', () => this.flush())
  }

  record(name: string, value: number, tags?: Record<string, string>) {
    this.buffer.push({
      name,
      value,
      tags,
      timestamp: Date.now()
    })
  }

  // Métricas específicas
  recordChatbotQuery(responseTimeMs: number, success: boolean, searchType: string) {
    this.record('chatbot.query', 1, {
      success: String(success),
      search_type: searchType
    })
    this.record('chatbot.response_time', responseTimeMs, {
      search_type: searchType
    })
  }

  recordPageLoad(pageName: string, loadTimeMs: number) {
    this.record('page.load_time', loadTimeMs, { page: pageName })
  }

  recordApiCall(endpoint: string, durationMs: number, status: number) {
    this.record('api.call', 1, {
      endpoint,
      status: String(status),
      success: String(status < 400)
    })
    this.record('api.duration', durationMs, { endpoint })
  }

  private async flush() {
    if (this.buffer.length === 0) return

    const metrics = [...this.buffer]
    this.buffer = []

    try {
      // Enviar para backend de analytics (ou Sentry custom metrics)
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics })
      })
    } catch (error) {
      console.warn('Falha ao enviar métricas:', error)
      // Re-adicionar ao buffer para próxima tentativa
      this.buffer.push(...metrics)
    }
  }
}

export const metrics = new MetricsCollector()
```

### 5.3 Health Check Endpoint

```typescript
// supabase/functions/health/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const startTime = Date.now()
  
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {}

  // 1. Verificar Supabase
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )
    
    const dbStart = Date.now()
    const { error } = await supabase.from('users').select('id').limit(1)
    
    checks.database = {
      status: error ? 'unhealthy' : 'healthy',
      latency: Date.now() - dbStart,
      error: error?.message
    }
  } catch (e) {
    checks.database = { status: 'unhealthy', error: String(e) }
  }

  // 2. Verificar Qdrant
  try {
    const qdrantStart = Date.now()
    const resp = await fetch(`${Deno.env.get('QDRANT_URL')}/collections`, {
      headers: { 'api-key': Deno.env.get('QDRANT_API_KEY')! }
    })
    
    checks.qdrant = {
      status: resp.ok ? 'healthy' : 'unhealthy',
      latency: Date.now() - qdrantStart
    }
  } catch (e) {
    checks.qdrant = { status: 'unhealthy', error: String(e) }
  }

  // 3. Verificar Groq
  try {
    const groqStart = Date.now()
    const resp = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}` }
    })
    
    checks.groq = {
      status: resp.ok ? 'healthy' : 'unhealthy',
      latency: Date.now() - groqStart
    }
  } catch (e) {
    checks.groq = { status: 'unhealthy', error: String(e) }
  }

  // 4. Verificar HuggingFace
  try {
    const hfStart = Date.now()
    const resp = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      { headers: { 'Authorization': `Bearer ${Deno.env.get('HUGGINGFACE_TOKEN')}` } }
    )
    
    checks.huggingface = {
      status: resp.ok ? 'healthy' : 'unhealthy',
      latency: Date.now() - hfStart
    }
  } catch (e) {
    checks.huggingface = { status: 'unhealthy', error: String(e) }
  }

  // Determinar status geral
  const allHealthy = Object.values(checks).every(c => c.status === 'healthy')
  const totalLatency = Date.now() - startTime

  return new Response(
    JSON.stringify({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      totalLatency,
      checks
    }),
    {
      status: allHealthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    }
  )
})
```

### 5.4 Dashboard de Métricas (Simples)

```typescript
// src/pages/admin/SystemHealth.tsx

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export default function SystemHealth() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('health')
      return data
    },
    refetchInterval: 30000 // 30 segundos
  })

  if (isLoading) return <div>Carregando...</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Status do Sistema</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(health?.checks || {}).map(([service, check]) => (
          <div
            key={service}
            className={`p-4 rounded-lg border ${
              check.status === 'healthy' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                check.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="font-medium capitalize">{service}</span>
            </div>
            {check.latency && (
              <p className="text-sm text-gray-600 mt-1">
                {check.latency}ms
              </p>
            )}
            {check.error && (
              <p className="text-sm text-red-600 mt-1">
                {check.error}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-500 mt-4">
        Última atualização: {new Date(health?.timestamp).toLocaleString()}
      </p>
    </div>
  )
}
```

## Métricas de Sucesso - Sprint 5

| Métrica | Antes | Depois | Status |
|---------|-------|--------|--------|
| Error tracking | Básico | Completo | |
| Health checks | ❌ | ✅ | |
| Métricas custom | ❌ | ✅ | |
| Alertas | ❌ | ✅ | |
| Dashboard status | ❌ | ✅ | |
| **Rating Observability** | 4.0 | 9.0 | |

---

# 🔷 SPRINT 6: Documentação & Polish (Semanas 11-12)

## Objetivo
Documentação completa, cleanup de código e preparação para produção.

### 6.1 Estrutura de Documentação

```
docs/
├── README.md                    # Visão geral
├── ARCHITECTURE.md              # Arquitetura técnica
├── DEPLOYMENT.md                # Guia de deploy
├── DEVELOPMENT.md               # Setup de desenvolvimento
├── API.md                       # Documentação das Edge Functions
├── SECURITY.md                  # Práticas de segurança
├── CONTRIBUTING.md              # Guia de contribuição
├── CHANGELOG.md                 # Histórico de mudanças
└── adr/                         # Architecture Decision Records
    ├── 001-stack-selection.md
    ├── 002-auth-strategy.md
    └── 003-ai-implementation.md
```

### 6.2 ADR Template

```markdown
<!-- docs/adr/001-stack-selection.md -->

# ADR 001: Seleção de Stack Tecnológico

## Status
Aceito

## Contexto
Precisávamos escolher uma stack para um MVP de custo zero com potencial de escala.

## Decisão
Escolhemos:
- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Supabase (Auth, Database, Edge Functions)
- **Vector DB:** Qdrant Cloud
- **LLM:** Groq (Llama 3.3 70B)
- **Embeddings:** HuggingFace Inference API

## Consequências

### Positivas
- Custo operacional zero em free tiers
- Stack moderna com boa DX
- Escalabilidade quando necessário

### Negativas
- Dependência de múltiplos serviços externos
- Limites de free tier podem ser atingidos com crescimento
- Vendor lock-in parcial com Supabase

## Alternativas Consideradas
- Firebase (rejeitado: mais caro, menos flexível)
- AWS Amplify (rejeitado: complexidade desnecessária)
- Self-hosted (rejeitado: custo de infraestrutura)
```

### 6.3 Cleanup de Dependências

```json
// package.json - ATUALIZADO

{
  "dependencies": {
    // REMOVIDOS (não utilizados):
    // "openai": "^6.9.1",      ❌ Usando Groq
    // "pdfjs-dist": "^5.4.394"  ❌ Usando LlamaParse

    // MANTIDOS:
    "@radix-ui/react-tooltip": "^1.2.8",
    "@sentry/react": "^10.27.0",
    "@supabase/supabase-js": "^2.39.0",
    "@tanstack/react-query": "^5.56.2",
    "dompurify": "^3.3.0",
    "jspdf": "^3.0.4",
    "qrcode.react": "^4.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hot-toast": "^2.4.1",
    "react-joyride": "^2.9.3",
    "react-router-dom": "^6.21.0",
    "vite-plugin-pwa": "^1.1.0",
    "workbox-window": "^7.4.0",
    "zod": "^3.22.4"
  }
}
```

```bash
# Executar cleanup
npm uninstall openai pdfjs-dist @xenova/transformers dotenv
npm audit fix
npm dedupe
```

### 6.4 Scripts de Automação

```json
// package.json - scripts atualizados
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,css,md}\"",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "typecheck": "tsc --noEmit",
    "validate": "npm run typecheck && npm run lint && npm run test -- --run",
    "prepare": "husky install",
    
    // Supabase
    "db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/database.ts",
    "db:migrate": "supabase db push",
    "db:reset": "supabase db reset",
    
    // Deploy
    "deploy:preview": "vercel",
    "deploy:prod": "vercel --prod",
    
    // Manutenção
    "clean": "rm -rf node_modules dist coverage .vercel",
    "reinstall": "npm run clean && npm install",
    "analyze": "npx vite-bundle-analyzer"
  }
}
```

## Métricas Finais - Sprint 6

| Métrica | Antes | Depois | Status |
|---------|-------|--------|--------|
| ADRs documentados | 0 | 5+ | |
| README atualizado | Parcial | Completo | |
| API documentada | ❌ | ✅ | |
| Deps não usadas | 3 | 0 | |
| Bundle size | ~2MB extra | Otimizado | |
| **Rating Documentação** | 5.5 | 9.0 | |

---

# 📊 RESUMO FINAL

## Evolução dos Ratings

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           EVOLUÇÃO DOS RATINGS                                 │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│   DIMENSÃO              ANTES    SPRINT 1-2   SPRINT 3-4   SPRINT 5-6   FINAL │
│   ─────────────────────────────────────────────────────────────────────────    │
│   CI/CD                 2.0   →    8.0    →     8.5    →     9.0    →   9.0   │
│   Cobertura Testes      3.5   →    6.5    →     9.0    →     9.0    →   9.0   │
│   Busca Vetorial (IA)   4.5   →    4.5    →     8.5    →     9.0    →   9.0   │
│   DevOps/Observability  4.0   →    5.0    →     6.0    →     9.0    →   9.0   │
│   Documentação          5.5   →    6.0    →     7.0    →     9.0    →   9.0   │
│   Segurança             6.5   →    7.0    →     8.0    →     9.0    →   9.0   │
│   UX/Acessibilidade     6.0   →    6.5    →     8.0    →     9.0    →   9.0   │
│   Arquitetura           7.5   →    8.0    →     8.5    →     9.0    →   9.0   │
│   Qualidade Código      7.0   →    8.0    →     8.5    →     9.0    →   9.0   │
│   ─────────────────────────────────────────────────────────────────────────    │
│   RATING MÉDIO          5.7   →    6.6    →     8.0    →     9.0    →   9.0   │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Investimento Total

| Recurso | Quantidade |
|---------|------------|
| **Tempo total** | 12 semanas |
| **Horas/semana** | ~20h |
| **Total de horas** | ~240h |
| **Custo financeiro** | $0 (mantém free tiers) |

## Checklist de Conclusão

- [ ] Sprint 1: CI/CD completo
- [ ] Sprint 2: Cobertura 50%+
- [ ] Sprint 3: Embeddings reais
- [ ] Sprint 4: Cobertura 80%+
- [ ] Sprint 5: Observabilidade
- [ ] Sprint 6: Documentação

---

*Roadmap gerado em Dezembro 2025*
*Versix Solutions | De 5.7 para 9.0*
