-- Sprint 7 — Mercado Pago (cartão de crédito + boleto): generaliza pagamentos.
-- metodo discrimina o PSP; status guarda o valor nativo do PSP:
--   pix (Bacen):        ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR, REMOVIDA_PELO_PSP
--   cartao/boleto (MP): pending, approved, rejected, cancelled, in_process,
--                       refunded, charged_back
-- Linhas existentes são todas PIX (default 'pix' cobre o backfill).

ALTER TABLE pagamentos
  ADD COLUMN metodo TEXT NOT NULL DEFAULT 'pix'
    CHECK (metodo IN ('pix', 'cartao', 'boleto')),
  -- id do pagamento no Mercado Pago (linhas cartao/boleto)
  ADD COLUMN mp_payment_id TEXT UNIQUE,
  -- Campos de exibição específicos do método. Chaves usadas:
  --   boleto_url, boleto_linha_digitavel, boleto_vencimento,
  --   status_detail, parcelas, bandeira, email_pagador
  ADD COLUMN detalhes JSONB;

-- txid é exclusivo do PIX; linhas MP ficam com txid NULL (UNIQUE permite
-- múltiplos NULLs no Postgres).
ALTER TABLE pagamentos ALTER COLUMN txid DROP NOT NULL;

-- Toda linha precisa do identificador do seu PSP
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_identificador_psp
  CHECK ((metodo = 'pix' AND txid IS NOT NULL)
      OR (metodo IN ('cartao', 'boleto') AND mp_payment_id IS NOT NULL));

-- CPF do cliente (obrigatório no checkout a partir do Sprint 7; exigido pelo
-- Mercado Pago para boleto e antifraude de cartão). Nullable: pedidos antigos
-- não o têm.
ALTER TABLE pedidos ADD COLUMN cpf TEXT;
