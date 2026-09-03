-- S6: adiciona moderado_em para distinguir avaliações rejeitadas de pendentes.
-- Antes desta migração, aprovado=FALSE cobria tanto pendentes (nunca moderadas)
-- quanto rejeitadas, fazendo avaliações rejeitadas reaparecer na fila.
--
-- Após: moderado_em IS NULL = pendente; NOT NULL = moderada (aprovada ou rejeitada).

ALTER TABLE avaliacoes ADD COLUMN IF NOT EXISTS moderado_em TIMESTAMPTZ;

-- Marca como já moderadas todas as avaliações aprovadas existentes
UPDATE avaliacoes SET moderado_em = NOW() WHERE aprovado = TRUE AND moderado_em IS NULL;

-- Índice para a fila de moderação (substitui o antigo por aprovado=FALSE)
CREATE INDEX IF NOT EXISTS avaliacoes_pendentes_idx ON avaliacoes (moderado_em) WHERE moderado_em IS NULL;
