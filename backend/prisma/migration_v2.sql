-- Adiciona coluna webhook_id na tabela repositories
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS webhook_id TEXT;

-- Adiciona coluna triggered_by na tabela analyses
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS triggered_by TEXT DEFAULT 'manual';

-- Cria tabela dismissals (findings ignorados/aceitos)
CREATE TABLE IF NOT EXISTS dismissals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(finding_id)
);
