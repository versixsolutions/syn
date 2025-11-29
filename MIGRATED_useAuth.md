# ⚠️ ARQUIVO DESCONTINUADO

## Arquivo: `src/hooks/useAuth.ts`

### Status: ❌ DELETADO

Este arquivo continha uma implementação **fake/obsoleta** do hook `useAuth()`.

### Motivo da Remoção:
- Hook TODO nunca foi implementado
- Implementação real está em `src/contexts/AuthContext.tsx` 
- Código morto causava confusão e duplicação
- Developers poderiam usar a versão errada

### O que fazer:
**Remova o arquivo** `src/hooks/useAuth.ts` completamente.

### Importação Correta:
```typescript
// ❌ ERRADO (antes)
import { useAuth } from '../hooks/useAuth'

// ✅ CORRETO (agora)
import { useAuth } from '../contexts/AuthContext'
```

### Data de Remoção: 28 de Novembro de 2025
