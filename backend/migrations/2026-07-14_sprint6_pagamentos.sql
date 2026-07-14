-- Sprint 6 — PIX (Sicredi): tabela de pagamentos.
-- Cada cobrança PIX criada na API do Sicredi vira uma linha aqui; o status
-- segue os valores do Bacen (ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR,
-- REMOVIDA_PELO_PSP). Quando um pagamento é confirmado, pedidos.status = 'pago'.

CREATE TABLE pagamentos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID        NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  txid            TEXT        NOT NULL UNIQUE,
  valor_centavos  INTEGER     NOT NULL CHECK (valor_centavos > 0),
  status          TEXT        NOT NULL DEFAULT 'ATIVA',
  -- pixCopiaECola retornado pelo Sicredi (usado para gerar o QR Code)
  brcode          TEXT,
  -- endToEndId do PIX recebido (preenchido na confirmação)
  e2eid           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  pago_em         TIMESTAMPTZ
);

CREATE INDEX pagamentos_pedido_idx ON pagamentos (pedido_id);

-- Backend-only (service role): RLS habilitado sem policies.
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
