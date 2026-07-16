-- Run this in the Supabase SQL Editor to set up the schema.

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE produtos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL,
  tamanhos    TEXT[]      NOT NULL,
  descricao   TEXT,
  tag         TEXT,
  ordem       INTEGER     DEFAULT 0,
  ativo       BOOLEAN     DEFAULT TRUE,
  estoque     INTEGER     NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  -- Preço por tamanho, em centavos: {"250ml": 7990, "500ml": 11990}
  precos      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- URLs públicas do bucket "produtos" (primeira = principal). Vazio =
  -- o site usa as fotos embutidas (frontend/src/lib/produto-imagens.ts).
  imagens     TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for databases created before the estoque column existed:
--   ALTER TABLE produtos ADD COLUMN estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0);

CREATE TABLE aromas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL,
  ativo       BOOLEAN     DEFAULT TRUE,
  ordem       INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Pedido = cabeçalho (cliente, entrega, total); itens vivem em pedido_itens.
-- Campos de cliente/entrega são nullable no banco; a obrigatoriedade é
-- validada no backend (pedidos antigos, anteriores ao checkout, não os têm).
CREATE TABLE pedidos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,
  nome_cliente    TEXT,
  telefone        TEXT,
  cep             TEXT,
  rua             TEXT,
  numero          TEXT,
  complemento     TEXT,
  bairro          TEXT,
  cidade          TEXT,
  estado          TEXT,
  -- CPF (11 dígitos) ou CNPJ (14 dígitos) do cliente, só dígitos — o tipo é
  -- derivado do tamanho (exigido pelo Mercado Pago p/ boleto e cartão)
  cpf_cnpj        TEXT,
  observacoes     TEXT,
  -- total_centavos = itens + frete_centavos (frete recotado no servidor)
  total_centavos  INTEGER     NOT NULL DEFAULT 0 CHECK (total_centavos >= 0),
  frete_centavos  INTEGER     NOT NULL DEFAULT 0 CHECK (frete_centavos >= 0),
  -- Ex.: "PAC — Correios"; NULL quando a integração de frete está desligada
  frete_servico   TEXT,
  frete_prazo_dias INTEGER,
  -- Preenchido manualmente no admin quando o pedido é postado
  codigo_rastreio TEXT,
  status          TEXT        DEFAULT 'novo',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pedido_itens (
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

CREATE INDEX pedido_itens_pedido_idx ON pedido_itens (pedido_id);

-- Pagamentos: PIX (API Sicredi) + cartão/boleto (Mercado Pago). status guarda
-- o valor nativo do PSP — pix (Bacen): ATIVA, CONCLUIDA, REMOVIDA_*;
-- cartao/boleto (MP): pending, approved, rejected, cancelled, in_process,
-- refunded, charged_back. Pagamento confirmado também marca
-- pedidos.status = 'pago'. Backend-only (service role); RLS habilitado sem
-- policies.
CREATE TABLE pagamentos (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID        NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  metodo          TEXT        NOT NULL DEFAULT 'pix'
                              CHECK (metodo IN ('pix', 'cartao', 'boleto')),
  -- txid do Bacen (só PIX; UNIQUE permite múltiplos NULLs)
  txid            TEXT        UNIQUE,
  -- id do pagamento no Mercado Pago (só cartao/boleto)
  mp_payment_id   TEXT        UNIQUE,
  valor_centavos  INTEGER     NOT NULL CHECK (valor_centavos > 0),
  status          TEXT        NOT NULL DEFAULT 'ATIVA',
  -- pixCopiaECola retornado pelo Sicredi (usado para gerar o QR Code)
  brcode          TEXT,
  -- endToEndId do PIX recebido (preenchido na confirmação)
  e2eid           TEXT,
  -- Campos de exibição do Mercado Pago: boleto_url, boleto_linha_digitavel,
  -- boleto_vencimento, status_detail, parcelas, bandeira, email_pagador
  detalhes        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  pago_em         TIMESTAMPTZ,
  CONSTRAINT pagamentos_identificador_psp
    CHECK ((metodo = 'pix' AND txid IS NOT NULL)
        OR (metodo IN ('cartao', 'boleto') AND mp_payment_id IS NOT NULL))
);

CREATE INDEX pagamentos_pedido_idx ON pagamentos (pedido_id);

-- Migration for databases created before Sprint 7 (Shipping/Melhor Envio):
--   see migrations/2026-07-15_sprint7_frete_rastreio.sql

-- Migration for databases created before the Sprint 3 stragglers (product
-- image uploads): see migrations/2026-07-14_sprint3_produtos_imagens.sql

-- Migration for databases created before Sprint 7 (Mercado Pago):
--   see migrations/2026-07-14_sprint7_mercado_pago.sql

-- Migration for databases created before Sprint 6 (PIX/Sicredi):
--   see migrations/2026-07-14_sprint6_pagamentos.sql

-- Migration for databases created before Sprint 5 (prices + order items):
--   ALTER TABLE produtos ADD COLUMN precos JSONB NOT NULL DEFAULT '{}'::jsonb;
--   UPDATE produtos SET precos = '{"250ml": 7990, "500ml": 11990}' WHERE nome = 'Difusor de Vidro';
--   UPDATE produtos SET precos = '{"250ml": 4990}'                 WHERE nome = 'Difusor PET';
--   UPDATE produtos SET precos = '{"120ml": 3990, "250ml": 5990}'  WHERE nome = 'Home Spray';
--   UPDATE produtos SET precos = '{"250ml": 3490, "500ml": 5490, "1L": 8990}' WHERE nome = 'Refil';
--   ALTER TABLE pedidos
--     ADD COLUMN user_id UUID, ADD COLUMN telefone TEXT, ADD COLUMN cep TEXT,
--     ADD COLUMN rua TEXT, ADD COLUMN numero TEXT, ADD COLUMN complemento TEXT,
--     ADD COLUMN bairro TEXT, ADD COLUMN cidade TEXT, ADD COLUMN estado TEXT,
--     ADD COLUMN total_centavos INTEGER NOT NULL DEFAULT 0 CHECK (total_centavos >= 0);
--   -- then create pedido_itens + index as above, move the old per-row item data:
--   INSERT INTO pedido_itens (pedido_id, produto_nome, tamanho, aroma, refil, quantidade,
--                             preco_unitario_centavos, subtotal_centavos)
--     SELECT id, produto_nome, tamanho, aroma, refil, quantidade, 0, 0 FROM pedidos;
--   ALTER TABLE pedidos DROP COLUMN produto_nome, DROP COLUMN tamanho, DROP COLUMN aroma,
--     DROP COLUMN refil, DROP COLUMN quantidade;
--   ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "pedido_itens_auth_all" ON pedido_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
--   -- direct anon inserts are no longer allowed (backend computes prices):
--   DROP POLICY "pedidos_public_insert" ON pedidos;
--   REVOKE INSERT ON TABLE pedidos FROM anon;

-- Migration for databases seeded before the July/2026 price table (official
-- "Tabela de Preços" sizes + prices):
--   UPDATE produtos SET tamanhos = ARRAY['100ml','250ml'],
--     descricao = 'Disponível em 100ml e 250ml. Frasco em vidro com fitas e varetas pretas.',
--     precos = '{"100ml": 6500, "250ml": 14990}'                             WHERE nome = 'Difusor de Vidro';
--   UPDATE produtos SET tamanhos = ARRAY['250ml'],
--     precos = '{"250ml": 6990}'                                             WHERE nome = 'Difusor PET';
--   UPDATE produtos SET tamanhos = ARRAY['100ml','250ml','500ml','1L'],
--     precos = '{"100ml": 4500, "250ml": 6990, "500ml": 9990, "1L": 17000}'  WHERE nome = 'Home Spray';
--   UPDATE produtos SET tamanhos = ARRAY['100ml','250ml','500ml','1L'],
--     precos = '{"100ml": 4500, "250ml": 6500, "500ml": 13000, "1L": 20000}' WHERE nome = 'Refil';

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE produtos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE aromas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
-- pagamentos: backend-only — RLS on, sem policies (anon/authenticated negados)
ALTER TABLE pagamentos   ENABLE ROW LEVEL SECURITY;

-- Public reads for the storefront
CREATE POLICY "produtos_public_read"  ON produtos FOR SELECT USING (ativo = TRUE);
CREATE POLICY "aromas_public_read"    ON aromas   FOR SELECT USING (ativo = TRUE);

-- Orders are created exclusively through the backend (service role), which
-- computes prices/totals server-side — no public insert.
-- Only authenticated users (Supabase dashboard / service role) can read/manage orders and manage catalogue
CREATE POLICY "pedidos_auth_all"      ON pedidos      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pedido_itens_auth_all" ON pedido_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "produtos_auth_all"     ON produtos     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "aromas_auth_all"       ON aromas       FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Grants ───────────────────────────────────────────────────────────────────
-- Anon role can read products/aromas; everything else goes through the backend
GRANT SELECT ON TABLE produtos TO anon;
GRANT SELECT ON TABLE aromas   TO anon;

-- ── Carrinho ─────────────────────────────────────────────────────────────────
-- Cart items live per authenticated user. Access is backend-only (service
-- role); RLS is enabled with no policies so anon/authenticated keys are denied.

CREATE TABLE carrinho_itens (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL,
  produto_nome  TEXT        NOT NULL,
  tamanho       TEXT        NOT NULL,
  aroma         TEXT        NOT NULL,
  refil         BOOLEAN     DEFAULT FALSE,
  quantidade    INTEGER     NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX carrinho_itens_user_idx ON carrinho_itens (user_id);

ALTER TABLE carrinho_itens ENABLE ROW LEVEL SECURITY;

-- ── RBAC: papéis de usuário ──────────────────────────────────────────────────
-- One row per user with an elevated role; users without a row are customers.
-- Backend-only (service role): RLS enabled with no policies.

CREATE TABLE user_roles (
  user_id     UUID        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ── Auditoria ────────────────────────────────────────────────────────────────
-- Quem mudou o quê e quando (ações de equipe/admin). Gravado pelo backend
-- (service role); leitura só pelo endpoint admin. Backend-only: RLS sem
-- policies. Migration: migrations/2026-07-16_sprint10_audit_log.sql

CREATE TABLE audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  -- Snapshot do e-mail: continua legível mesmo se a conta sumir depois
  user_email  TEXT,
  -- Ex.: 'pedido.atualizar', 'produto.estoque', 'usuario.role'
  acao        TEXT        NOT NULL,
  alvo_tipo   TEXT        NOT NULL,
  alvo_id     TEXT,
  detalhes    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ── Estoque ──────────────────────────────────────────────────────────────────
-- Atomic stock adjustment. Called by the backend (service role) with a
-- negative delta when an order is created, or a positive delta to restock /
-- roll back. Fails instead of letting the stock go negative.

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

-- Stock is managed exclusively through the backend's service role.
REVOKE ALL ON FUNCTION ajustar_estoque(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- ── Storage: avatars ─────────────────────────────────────────────────────────
-- Public-read bucket for profile pictures; uploads go through the backend
-- (service role), so no storage policies are needed.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Storage: fotos de produto ────────────────────────────────────────────────
-- Public-read bucket for product photos; uploads go through the backend
-- (staff-only endpoints, service role), so no storage policies are needed.

INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Seed data ────────────────────────────────────────────────────────────────

INSERT INTO produtos (nome, tamanhos, descricao, tag, ordem, estoque, precos) VALUES
  ('Difusor de Vidro',     ARRAY['100ml', '250ml'],                'Disponível em 100ml e 250ml. Frasco em vidro com fitas e varetas pretas.', 'Linha Premium',          1, 20, '{"100ml": 6500, "250ml": 14990}'),
  ('Difusor PET',          ARRAY['250ml'],                          'Tamanho único 250ml. Praticidade em embalagem leve e resistente.',          'Tamanho único',          2, 20, '{"250ml": 6990}'),
  ('Home Spray',           ARRAY['100ml', '250ml', '500ml', '1L'],  'Borrife e perfume o ambiente em segundos. Fixação prolongada.',             'Aplicação rápida',       3, 20, '{"100ml": 4500, "250ml": 6990, "500ml": 9990, "1L": 17000}'),
  ('Refil',                ARRAY['100ml', '250ml', '500ml', '1L'],  'Renove o aroma do seu difusor com nossos refis em diversos volumes. Acompanha kit de varetas de madeira.', 'Recarregue & economize', 4, 20, '{"100ml": 4500, "250ml": 6500, "500ml": 13000, "1L": 20000}'),
  ('Kit Lavabo',           ARRAY['100ml', '250ml'],                 'Difusor e sabonete líquido em vidro para o lavabo. Disponível em 100ml e 250ml.',                          'Para o lavabo',          5, 20, '{"100ml": 9500, "250ml": 22000}'),
  ('CarSpray',             ARRAY['60ml'],                           'Spray de 60ml para perfumar o carro. Aromas: Alecrim, Chá Branco, Cereja e Avelã, Tenuê e Vanilla.',       'Para o carro',           7, 20, '{"60ml": 2000}'),
  ('Difusor de Carro',     ARRAY['Único'],                          'Difusor compacto para o retrovisor. Aromas: Alecrim, Chá Branco, Cereja e Avelã, Tenuê e Vanilla.',        'Para o carro',           8, 20, '{"Único": 2000}'),
  ('Varetas',              ARRAY['Kit com 5'],                      'Kit com 5 varetas de reposição para difusores.',                                                           'Reposição',              9, 20, '{"Kit com 5": 800}');

-- Aromas oficiais da Tabela de Preços (julho/2026)
INSERT INTO aromas (nome, ordem) VALUES
  ('Alecrim',                1),
  ('Baby',                   2),
  ('Bamboo',                 3),
  ('Capim-Limão',            4),
  ('Cereja e Avelã',         5),
  ('Chá Branco',             6),
  ('Chá Branco com Vanilla', 7),
  ('Lavanda',                8),
  ('Tenuê',                  9),
  ('Tenuê com Chá Branco',  10),
  ('Vanilla',               11);
