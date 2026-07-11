-- Brings a live database provisioned before Sprint 4 up to backend/schema.sql:
--   Sprint 4: produtos.estoque + função ajustar_estoque
--   Sprint 5: produtos.precos, pedidos reestruturado (cabeçalho + pedido_itens)
--   Julho/2026: tamanhos e preços da Tabela de Preços oficial
--
-- Verified against the live DB on 11/07/2026: pedidos is EMPTY, so the old
-- per-row item data move from the schema.sql migration notes is omitted.
-- Idempotent: safe to re-run.

BEGIN;

-- ── Sprint 4: estoque ────────────────────────────────────────────────────────

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0);

CREATE OR REPLACE FUNCTION ajustar_estoque(p_nome TEXT, p_delta INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  novo_estoque INTEGER;
BEGIN
  UPDATE produtos
  SET estoque = estoque + p_delta
  WHERE nome = p_nome AND estoque + p_delta >= 0
  RETURNING estoque INTO novo_estoque;

  IF novo_estoque IS NULL THEN
    IF EXISTS (SELECT 1 FROM produtos WHERE nome = p_nome) THEN
      RAISE EXCEPTION 'estoque_insuficiente';
    END IF;
    RAISE EXCEPTION 'produto_nao_encontrado';
  END IF;

  RETURN novo_estoque;
END;
$$;

REVOKE ALL ON FUNCTION ajustar_estoque(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- Products start orderable (seed value); adjust real stock in the admin.
UPDATE produtos SET estoque = 20 WHERE estoque = 0;

-- ── Sprint 5: preços ─────────────────────────────────────────────────────────

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS precos JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Tabela de Preços oficial (julho/2026), em centavos
UPDATE produtos SET tamanhos = ARRAY['100ml','250ml'],
  descricao = 'Disponível em 100ml e 250ml. Frasco em vidro com fitas e varetas pretas.',
  precos = '{"100ml": 6500, "250ml": 14990}'                             WHERE nome = 'Difusor de Vidro';
UPDATE produtos SET tamanhos = ARRAY['250ml'],
  precos = '{"250ml": 6990}'                                             WHERE nome = 'Difusor PET';
UPDATE produtos SET tamanhos = ARRAY['100ml','250ml','500ml','1L'],
  precos = '{"100ml": 4500, "250ml": 6990, "500ml": 9990, "1L": 17000}'  WHERE nome = 'Home Spray';
UPDATE produtos SET tamanhos = ARRAY['100ml','250ml','500ml','1L'],
  precos = '{"100ml": 4500, "250ml": 6500, "500ml": 13000, "1L": 20000}' WHERE nome = 'Refil';

-- ── Sprint 5: pedidos (cabeçalho) + pedido_itens ─────────────────────────────

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS user_id        UUID,
  ADD COLUMN IF NOT EXISTS telefone       TEXT,
  ADD COLUMN IF NOT EXISTS cep            TEXT,
  ADD COLUMN IF NOT EXISTS rua            TEXT,
  ADD COLUMN IF NOT EXISTS numero         TEXT,
  ADD COLUMN IF NOT EXISTS complemento    TEXT,
  ADD COLUMN IF NOT EXISTS bairro         TEXT,
  ADD COLUMN IF NOT EXISTS cidade         TEXT,
  ADD COLUMN IF NOT EXISTS estado         TEXT,
  ADD COLUMN IF NOT EXISTS total_centavos INTEGER NOT NULL DEFAULT 0 CHECK (total_centavos >= 0);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id                UUID        NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  produto_nome             TEXT        NOT NULL,
  tamanho                  TEXT        NOT NULL,
  aroma                    TEXT        NOT NULL,
  refil                    BOOLEAN     DEFAULT FALSE,
  quantidade               INTEGER     NOT NULL DEFAULT 1 CHECK (quantidade >= 1),
  preco_unitario_centavos  INTEGER     NOT NULL CHECK (preco_unitario_centavos >= 0),
  subtotal_centavos        INTEGER     NOT NULL CHECK (subtotal_centavos >= 0),
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pedido_itens_pedido_idx ON pedido_itens (pedido_id);

ALTER TABLE pedidos
  DROP COLUMN IF EXISTS produto_nome,
  DROP COLUMN IF EXISTS tamanho,
  DROP COLUMN IF EXISTS aroma,
  DROP COLUMN IF EXISTS refil,
  DROP COLUMN IF EXISTS quantidade;

ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedido_itens_auth_all" ON pedido_itens;
CREATE POLICY "pedido_itens_auth_all" ON pedido_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Direct anon inserts are no longer allowed (backend computes prices)
DROP POLICY IF EXISTS "pedidos_public_insert" ON pedidos;
REVOKE INSERT ON TABLE pedidos FROM anon;

COMMIT;
