-- PIX payments now go through MercadoPago instead of Sicredi.
-- MP assigns its own payment_id (mp_payment_id); there is no Bacen txid.
-- Relax the constraint so that any payment has at least one PSP identifier,
-- regardless of method.

ALTER TABLE pagamentos
  DROP CONSTRAINT pagamentos_identificador_psp;

ALTER TABLE pagamentos
  ADD CONSTRAINT pagamentos_identificador_psp
    CHECK (txid IS NOT NULL OR mp_payment_id IS NOT NULL);

-- Update default status: MP uses 'pending' for pending payments (not 'ATIVA').
ALTER TABLE pagamentos
  ALTER COLUMN status SET DEFAULT 'pending';
