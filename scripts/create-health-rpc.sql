-- ✅ RPC OTIMIZADO PARA DASHBOARD ADMIN
-- Substitui 40 queries paralelas por 1 query única
-- Reduz tempo de carregamento de ~5s para ~500ms

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
  GROUP BY c.id, c.name, c.slug
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ✅ RPC PARA DADOS FINANCEIROS GLOBAIS
CREATE OR REPLACE FUNCTION get_financial_summary(start_date TIMESTAMP DEFAULT NULL)
RETURNS TABLE(
  total_amount NUMERIC,
  paid_amount NUMERIC,
  pending_amount NUMERIC,
  overdue_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(d.amount), 0) as total_amount,
    COALESCE(SUM(CASE WHEN d.payment_status = 'pago' THEN d.amount ELSE 0 END), 0) as paid_amount,
    COALESCE(SUM(CASE WHEN d.payment_status = 'pendente' THEN d.amount ELSE 0 END), 0) as pending_amount,
    COALESCE(SUM(CASE WHEN d.payment_status = 'atrasado' THEN d.amount ELSE 0 END), 0) as overdue_amount
  FROM despesas d
  WHERE d.due_date >= COALESCE(start_date, NOW() - INTERVAL '1 month');
END;
$$ LANGUAGE plpgsql;

-- ✅ RPC PARA DISTRIBUIÇÃO DE USUÁRIOS POR ROLE
CREATE OR REPLACE FUNCTION get_users_by_role()
RETURNS TABLE(
  role TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.role as role,
    COUNT(*) as count
  FROM users u
  GROUP BY u.role
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- ✅ RPC PARA ATIVIDADE RECENTE
CREATE OR REPLACE FUNCTION get_recent_activity(limit_count INT DEFAULT 20)
RETURNS TABLE(
  activity_type TEXT,
  description TEXT,
  activity_timestamp TIMESTAMP,
  condominio_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  (
    SELECT 'ocorrencia'::TEXT as activity_type, CONCAT('Ocorrência: ', o.title) as description, o.created_at as activity_timestamp, c.name
    FROM ocorrencias o
    LEFT JOIN condominios c ON c.id = o.condominio_id
    ORDER BY o.created_at DESC
    LIMIT limit_count
  )
  UNION ALL
  (
    SELECT 'votacao'::TEXT as activity_type, CONCAT('Votação: ', v.title) as description, v.created_at as activity_timestamp, c.name
    FROM votacoes v
    LEFT JOIN condominios c ON c.id = v.condominio_id
    ORDER BY v.created_at DESC
    LIMIT limit_count
  )
  UNION ALL
  (
    SELECT 'usuario'::TEXT as activity_type, CONCAT('Novo usuário: ', u.full_name) as description, u.created_at as activity_timestamp, c.name
    FROM users u
    LEFT JOIN condominios c ON c.id = u.condominio_id
    WHERE u.role != 'pending'
    ORDER BY u.created_at DESC
    LIMIT limit_count
  )
  ORDER BY activity_timestamp DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ✅ INSTRUÇÕES DE DEPLOYMENT
/*
Copie e cole o conteúdo deste arquivo no SQL Editor do Supabase:
1. Abra https://app.supabase.com/project/[SEU-PROJECT-ID]/sql/new
2. Cole TODAS as funções acima
3. Execute (Ctrl+Enter ou CMD+Enter)
4. Verá 4 funções criadas com sucesso

Para testar:
  SELECT * FROM get_condominios_health();
  SELECT * FROM get_financial_summary();
  SELECT * FROM get_users_by_role();
  SELECT * FROM get_recent_activity();
*/
