🚀 GUIA DE DEPLOYMENT - SETUP NO SUPABASE

Data: 28 de Novembro de 2025
Responsável: GitHub Copilot (Claude Haiku 4.5)

================================
1. CRIAR RPCs PARA OTIMIZAÇÃO
================================

Abra https://app.supabase.com/project/[SEU-PROJECT-ID]/sql/new e execute:

📄 Arquivo: scripts/create-health-rpc.sql
Copie TODO o conteúdo e cole no SQL Editor do Supabase.

Isso criará:
  ✅ get_condominios_health()      - Agregação de dados por condomínio
  ✅ get_financial_summary()       - Resumo financeiro global
  ✅ get_users_by_role()           - Distribuição de usuários
  ✅ get_recent_activity()         - Atividades recentes

Teste (copie e execute cada um):
  SELECT * FROM get_condominios_health() LIMIT 1;
  SELECT * FROM get_financial_summary();
  SELECT * FROM get_users_by_role();
  SELECT * FROM get_recent_activity() LIMIT 5;

================================
2. CRIAR TABELA DE RATE LIMITING
================================

Abra https://app.supabase.com/project/[SEU-PROJECT-ID]/sql/new e execute:

📄 Arquivo: scripts/create-rate-limiting-table.sql
Copie TODO o conteúdo e cole no SQL Editor do Supabase.

Isso criará:
  ✅ Tabela: ai_requests
  ✅ Índices para performance: O(1) queries
  ✅ RLS policies para segurança
  ✅ Função de limpeza automática

Teste:
  SELECT COUNT(*) FROM ai_requests;
  -- Deve retornar (count INTEGER)

================================
3. CONFIGURAR EDGE FUNCTIONS
================================

⚠️  IMPORTANTE: A função ask-ai agora requer:

a) Variáveis de Ambiente
   No Supabase Dashboard → Edge Functions → ask-ai → Secrets:
   
   ✅ GROQ_API_KEY          (Your Groq API Key)
   ✅ QDRANT_URL            (Your Qdrant Cloud URL)
   ✅ QDRANT_API_KEY        (Your Qdrant API Key)
   ✅ SUPABASE_URL          (Seu URL do Supabase)
   ✅ SUPABASE_ANON_KEY     (Sua Anon Key)

b) Deploy da function
   Localmente:
   
   supabase functions deploy ask-ai
   
   Isso enviará a versão corrigida com rate limiting.

c) Verificar config.toml
   Arquivo: supabase/config.toml
   
   Todas as functions devem ter verify_jwt = true:
   
   [functions.ask-ai]
   verify_jwt = true       ✅
   
   [functions.notify-users]
   verify_jwt = true       ✅
   
   [functions.process-document]
   verify_jwt = true       ✅

================================
4. VALIDAR CORS E SEGURANÇA
================================

✅ Arquivo vercel.json já está corrigido com:

- CORS restringido apenas aos domínios oficiais
- SameSite cookies habilitado
- Credenciais permitidas

Nada para fazer, já está implementado!

================================
5. INSTRUÇÕES NO .env.local
================================

Para desenvolvimento local, adicione ao .env.local:

VITE_SUPABASE_URL=https://seu-project.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
VITE_SUPABASE_SERVICE_KEY=sua-service-key-aqui (optional)

Teste com:
  npm run dev
  Abra http://localhost:5173
  F12 → Console
  Se vir mensagem "✅ Supabase inicializado com sucesso" = OK!

================================
6. PRÓXIMOS PASSOS
================================

Ordem de deployment:
1. ✅ Implementar RPCs no Supabase       (5 min)
2. ✅ Criar tabela de rate limiting      (5 min)
3. ✅ Deploy da function ask-ai          (10 min)
4. ✅ Validar CORS em Vercel             (2 min)
5. 🧪 Teste de integração                (15 min)
6. 🚀 Deploy em produção                 (5 min)

Total estimado: ~40 minutos

================================
7. CHECKLIST DE VALIDAÇÃO
================================

Depois de tudo configurado, execute:

[] npm run build              → Sem erros TypeScript/Vite
[] npm run dev              → App roda sem erros no console
[] Teste login/logout       → Funciona normalmente
[] Abra admin dashboard     → Carrega em < 1 segundo
[] Chat com assistente      → Responde com limite mostrado
[] Verifique console (F12)  → Sem erros críticos

Logs esperados:
  ✅ Supabase inicializado com sucesso
  ✅ [INFO] Dashboard carregado
  ✅ [PERF] loadGlobalStats: ~250ms
  ✅ [INFO] Message enviada para assistente

================================
8. TROUBLESHOOTING
================================

❌ Erro: "get_condominios_health is not a function"
→ Verifique se o RPC foi criado no Supabase
→ Execute: SELECT * FROM get_condominios_health() LIMIT 1;

❌ Erro: "Rate limit exceeded"
→ Normal! Você atingiu 50 requisições em 1 hora
→ Aguarde ou use outra conta para testar

❌ Erro: "Não autorizado. Faça login primeiro."
→ A função ask-ai agora valida JWT
→ Certifique-se de estar logado

❌ Erro: "Configurações ausentes"
→ Variáveis de ambiente não configuradas na function
→ Adicione no Supabase Dashboard → Edge Functions → Secrets

❌ Build falha com "logger.ts"
→ Execute: npm install
→ Depois: npm run build

================================
9. MONITORAMENTO EM PRODUÇÃO
================================

Adicione ao seu monitoramento:

1. Métricas de Performance
   - Dashboard admin: alvo < 1s
   - Chat assistente: alvo < 5s

2. Métricas de Segurança
   - Taxa de rate limit hits/hora
   - Erros de JWT validation
   - Requisições de condomínio inválido

3. Métricas de Negócio
   - Queries por hora via assistente
   - Usuários ativos por condomínio
   - Volume financeiro

================================
10. REFERÊNCIAS
================================

Documentação Supabase:
- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/auth/session-management

Documentação Vercel:
- https://vercel.com/docs/functions/edge-functions

Performance Tuning:
- Índices de banco de dados: https://supabase.com/docs/guides/database/indexing
- RLS Policies: https://supabase.com/docs/guides/auth/row-level-security

================================

Questões? Veja ANALISE_CRITICA.md ou PLANO_ACAO.md para mais detalhes!
