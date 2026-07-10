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
  observacoes     TEXT,
  total_centavos  INTEGER     NOT NULL DEFAULT 0 CHECK (total_centavos >= 0),
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

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE produtos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE aromas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;

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

-- ── Seed data ────────────────────────────────────────────────────────────────

INSERT INTO produtos (nome, tamanhos, descricao, tag, ordem, estoque, precos) VALUES
  ('Difusor de Vidro',     ARRAY['250ml', '500ml'],       'Disponível em 250ml e 500ml. Frasco em vidro com fitas e varetas pretas.', 'Linha Premium',          1, 20, '{"250ml": 7990, "500ml": 11990}'),
  ('Difusor PET',          ARRAY['250ml'],                 'Tamanho único 250ml. Praticidade em embalagem leve e resistente.',          'Tamanho único',          2, 20, '{"250ml": 4990}'),
  ('Home Spray',           ARRAY['120ml', '250ml'],        'Borrife e perfume o ambiente em segundos. Fixação prolongada.',             'Aplicação rápida',       3, 20, '{"120ml": 3990, "250ml": 5990}'),
  ('Refil',                ARRAY['250ml', '500ml', '1L'],  'Renove o aroma do seu difusor com nossos refis em diversos volumes.',       'Recarregue & economize', 4, 20, '{"250ml": 3490, "500ml": 5490, "1L": 8990}');

INSERT INTO aromas (nome, ordem) VALUES
  ('Alecrim',           1),
  ('Lavanda',           2),
  ('Capim-limão',       3),
  ('Madeiras Nobres',   4),
  ('Flor de Laranjeira',5),
  ('Baunilha & Âmbar',  6),
  ('Bambu',             7),
  ('Algodão Egípcio',   8),
  ('Frutas Vermelhas',  9),
  ('Tabaco & Couro',   10);
