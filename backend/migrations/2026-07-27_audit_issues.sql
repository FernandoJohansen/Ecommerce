-- Audit issues migration (2026-07-27)
-- Covers: webhook dedup (#2), atomic stock reservation (#4),
--         order status enum + constraint (#6), e2eid unique (#13),
--         LGPD anonymization column (#15)

-- 1. Webhook event deduplication table
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id     TEXT        PRIMARY KEY,
  provider     TEXT        NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- 2. PIX endToEndId uniqueness (compound dedup key with txid)
CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_e2eid_unique
  ON pagamentos (e2eid)
  WHERE e2eid IS NOT NULL;

-- 3. LGPD: column to track which orders have been anonymized
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

-- 4. Atomic multi-product stock reservation.
--    All decrements run inside one transaction; any insufficiency rolls all back.
CREATE OR REPLACE FUNCTION reservar_estoque_pedido(itens JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT (value->>'nome')              AS nome,
           (value->>'quantidade')::INT   AS quantidade
    FROM jsonb_array_elements(itens)
  LOOP
    UPDATE produtos
       SET estoque = estoque - item.quantidade
     WHERE nome = item.nome
       AND estoque - item.quantidade >= 0;

    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM produtos WHERE nome = item.nome) THEN
        RAISE EXCEPTION 'estoque_insuficiente:%', item.nome;
      END IF;
      RAISE EXCEPTION 'produto_nao_encontrado:%', item.nome;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION reservar_estoque_pedido(JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION repor_estoque_pedido(itens JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT (value->>'nome')              AS nome,
           (value->>'quantidade')::INT   AS quantidade
    FROM jsonb_array_elements(itens)
  LOOP
    UPDATE produtos
       SET estoque = estoque + item.quantidade
     WHERE nome = item.nome;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION repor_estoque_pedido(JSONB) FROM PUBLIC, anon, authenticated;

-- 5. Order status: add expirado + reembolsado and enforce the full enum.
--    Drop any old check first so we can redefine it.
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_valido;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_status_valido
  CHECK (status IN (
    'novo', 'em_andamento', 'pago', 'enviado',
    'concluido', 'cancelado', 'expirado', 'reembolsado'
  ));
