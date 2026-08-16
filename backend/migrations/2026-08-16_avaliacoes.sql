-- Avaliações de produtos: criadas pelo cliente logado após o pedido ser pago;
-- exibidas publicamente só após aprovação manual pelo staff.

CREATE TABLE avaliacoes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID        NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  -- produto_id pode ficar NULL se o produto for excluído (preserva o histórico)
  produto_id      UUID        REFERENCES produtos(id) ON DELETE SET NULL,
  produto_nome    TEXT        NOT NULL,
  nota            SMALLINT    NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario      TEXT        CHECK (comentario IS NULL OR length(comentario) <= 1000),
  aprovado        BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Primeiro nome do cliente derivado de pedido.nome_cliente no momento da criação
  nome_avaliador  TEXT        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  -- Um cliente só avalia cada produto uma vez por pedido
  UNIQUE (pedido_id, produto_nome)
);

CREATE INDEX avaliacoes_produto_aprovado_idx ON avaliacoes (produto_id, aprovado);

ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;
-- Sem policies: acesso exclusivo via service role (backend)
