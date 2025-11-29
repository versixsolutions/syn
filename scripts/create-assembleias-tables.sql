-- ============================================
-- MIGRATION: Módulo de Assembleias
-- Purpose: Criar tabelas para sistema completo de assembleias
-- ============================================

-- Tabela principal de Assembleias
CREATE TABLE IF NOT EXISTS assembleias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  data_hora TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'agendada',
  edital_topicos TEXT[] NOT NULL DEFAULT '{}',
  edital_pdf_url TEXT,
  ata_topicos TEXT[],
  ata_pdf_url TEXT,
  link_presenca VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  iniciada_em TIMESTAMP,
  encerrada_em TIMESTAMP,
  CONSTRAINT valid_status CHECK (status IN ('agendada', 'em_andamento', 'encerrada', 'cancelada'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_assembleias_condominio ON assembleias(condominio_id);
CREATE INDEX IF NOT EXISTS idx_assembleias_data_hora ON assembleias(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_assembleias_status ON assembleias(status);

-- Tabela de Presenças
CREATE TABLE IF NOT EXISTS assembleias_presencas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registrado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(assembleia_id, user_id) -- Garante uma presença por usuário por assembleia
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_presencas_assembleia ON assembleias_presencas(assembleia_id);
CREATE INDEX IF NOT EXISTS idx_presencas_user ON assembleias_presencas(user_id);

-- Tabela de Pautas de Votação
CREATE TABLE IF NOT EXISTS assembleias_pautas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembleia_id UUID NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  tipo_votacao VARCHAR(10) NOT NULL DEFAULT 'aberta',
  opcoes TEXT[] NOT NULL DEFAULT '{"Sim", "Não", "Abstenção"}',
  votacao_iniciada_em TIMESTAMP,
  votacao_encerrada_em TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_status_pauta CHECK (status IN ('pendente', 'em_votacao', 'encerrada')),
  CONSTRAINT valid_tipo_votacao CHECK (tipo_votacao IN ('secreta', 'aberta'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pautas_assembleia ON assembleias_pautas(assembleia_id);
CREATE INDEX IF NOT EXISTS idx_pautas_ordem ON assembleias_pautas(ordem);
CREATE INDEX IF NOT EXISTS idx_pautas_status ON assembleias_pautas(status);

-- Tabela de Votos
CREATE TABLE IF NOT EXISTS assembleias_votos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pauta_id UUID NOT NULL REFERENCES assembleias_pautas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voto VARCHAR(100) NOT NULL,
  votado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(pauta_id, user_id) -- Garante um voto por usuário por pauta
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_votos_pauta ON assembleias_votos(pauta_id);
CREATE INDEX IF NOT EXISTS idx_votos_user ON assembleias_votos(user_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Assembleias: Todos podem visualizar do seu condomínio
ALTER TABLE assembleias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assembleias from their condominio" ON assembleias
  FOR SELECT USING (
    condominio_id IN (
      SELECT condominio_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all assembleias" ON assembleias
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'sindico', 'sub_sindico', 'conselho')
    )
  );

-- Presenças: Usuários podem ver presenças da assembleia e registrar a própria
ALTER TABLE assembleias_presencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view presencas" ON assembleias_presencas
  FOR SELECT USING (
    assembleia_id IN (
      SELECT id FROM assembleias WHERE condominio_id IN (
        SELECT condominio_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can register their own presenca" ON assembleias_presencas
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Pautas: Todos podem visualizar
ALTER TABLE assembleias_pautas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pautas" ON assembleias_pautas
  FOR SELECT USING (
    assembleia_id IN (
      SELECT id FROM assembleias WHERE condominio_id IN (
        SELECT condominio_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage pautas" ON assembleias_pautas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'sindico', 'sub_sindico', 'conselho')
    )
  );

-- Votos: Usuários podem votar e ver apenas seu próprio voto (voto secreto)
ALTER TABLE assembleias_votos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own votes" ON assembleias_votos
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can cast votes" ON assembleias_votos
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins podem ver todos os votos (para contagem)
CREATE POLICY "Admins can view all votes" ON assembleias_votos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'sindico', 'sub_sindico', 'conselho')
    )
  );

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE assembleias IS 'Assembleias do condomínio com edital e ata';
COMMENT ON TABLE assembleias_presencas IS 'Registro de presença dos moradores nas assembleias';
COMMENT ON TABLE assembleias_pautas IS 'Pautas de votação de cada assembleia';
COMMENT ON TABLE assembleias_votos IS 'Votos registrados em cada pauta';

COMMENT ON COLUMN assembleias.link_presenca IS 'Código único ou link para registro de presença via QR Code';
COMMENT ON COLUMN assembleias_pautas.tipo_votacao IS 'Tipo: secreta (resultado oculto até encerrar) ou aberta (resultado em tempo real)';
COMMENT ON COLUMN assembleias_votos.voto IS 'Opção escolhida pelo usuário (deve estar em opcoes da pauta)';

-- ============================================
-- DADOS DE EXEMPLO (OPCIONAL - REMOVER EM PRODUÇÃO)
-- ============================================

-- Inserir assembleia de exemplo (ajustar condominio_id)
-- INSERT INTO assembleias (condominio_id, titulo, data_hora, edital_topicos, edital_pdf_url, status) 
-- VALUES (
--   'seu-condominio-id-aqui',
--   'Assembleia Ordinária - Janeiro 2025',
--   '2025-01-15 19:00:00',
--   ARRAY['Aprovação de contas 2024', 'Eleição de novo síndico', 'Discussão sobre reforma da piscina', 'Outros assuntos'],
--   'https://example.com/edital.pdf',
--   'agendada'
-- );
