-- Sprint 7 (Shipping): frete no pedido + código de rastreamento.
-- O frete é cotado no Melhor Envio e recotado no servidor ao criar o pedido;
-- total_centavos passa a incluir frete_centavos.

ALTER TABLE pedidos
  ADD COLUMN frete_centavos   INTEGER NOT NULL DEFAULT 0 CHECK (frete_centavos >= 0),
  -- Ex.: "PAC — Correios"; NULL em pedidos sem frete cotado (integração
  -- desligada: entrega combinada pelo WhatsApp)
  ADD COLUMN frete_servico    TEXT,
  ADD COLUMN frete_prazo_dias INTEGER,
  -- Preenchido manualmente no admin quando o pedido é postado
  ADD COLUMN codigo_rastreio  TEXT;
