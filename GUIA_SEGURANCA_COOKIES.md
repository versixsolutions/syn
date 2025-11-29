# 🔐 GUIA DE SEGURANÇA - TOKENS E COOKIES

## Problema Identificado

No arquivo `src/contexts/AuthContext.tsx`, o método `signOut()` faz:

```typescript
localStorage.clear()  // ❌ INSEGURO
```

## Por que isso é perigoso?

### 1. **XSS (Cross-Site Scripting)**
```javascript
// Um atacante via XSS consegue fazer:
localStorage.getItem('auth_token')  // Rouba token facilmente!
```

### 2. **CSRF (Cross-Site Request Forgery)**
- Tokens em localStorage não têm proteção contra CSRF
- Cookies HttpOnly e SameSite oferecem proteção nativa

### 3. **Sem Sincronização Entre Abas**
- localStorage exigir manual sync entre abas do browser
- Cookies HttpOnly sincronizam automaticamente

## ✅ Solução: Usar Supabase com Cookies HttpOnly

### Código Atual (INSEGURO):
```typescript
async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) console.warn('Aviso no logout:', error.message)
  
  setProfile(null)
  setUser(null)
  setSession(null)
  setAuthError(null)
  localStorage.clear()  // ❌ Remove isso!
}
```

### Código Corrigido (SEGURO):
```typescript
async function signOut() {
  try {
    // ✅ Supabase gerencia cookies HttpOnly automaticamente
    const { error } = await supabase.auth.signOut()
    if (error) console.warn('Aviso no logout:', error)
    
    setProfile(null)
    setUser(null)
    setSession(null)
    setAuthError(null)
    // ❌ REMOVER: localStorage.clear()
    // ✅ Supabase já limpou cookies automaticamente
  } catch (err) {
    console.warn('Sessão já encerrada:', err)
    setProfile(null)
    setUser(null)
    setSession(null)
    setAuthError(null)
  }
}
```

## ✅ Configuração do Supabase (já está correta)

No arquivo `src/lib/supabase.ts`, verificar que está:

```typescript
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,  // ✅ Usa cookies HttpOnly
    detectSessionInUrl: true,
    flowType: 'pkce'  // ✅ Mais seguro que implicit flow
  }
})
```

## ✅ Como Funciona a Segurança

```
┌─────────────────────────────────────────────────┐
│         SUPABASE COM COOKIES HTTPSONLY          │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. Usuário faz login                           │
│  2. Supabase retorna SESSION em HttpOnly cookie │
│  3. Browser armazena cookie de forma segura     │
│  4. JavaScript NÃO consegue acessar             │
│  5. Requests automáticas incluem cookie         │
│  6. Servidor valida no backend                  │
│                                                 │
│  ✅ XSS: Bloqueado (JavaScript não acessa)      │
│  ✅ CSRF: Bloqueado (SameSite=Strict)           │
│  ✅ Sync: Automático entre abas                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 🛠️ Checklist de Implementação

- [ ] Remove `localStorage.clear()` de `signOut()`
- [ ] Verifica que `persistSession: true` está ativo
- [ ] Testa logout em uma aba (outras abas devem sincronizar)
- [ ] Testa em Incognito/Private Mode
- [ ] Valida que não há erros no console
- [ ] Testa com DevTools (F12) - não consigo acessar tokens

## 📚 Referências

- [Supabase Auth - Session Management](https://supabase.com/docs/guides/auth/sessions)
- [OWASP - Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [MDN - HttpOnly Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies)

---

**Data**: 28 de Novembro de 2025  
**Responsável**: GitHub Copilot (Claude Haiku 4.5)
