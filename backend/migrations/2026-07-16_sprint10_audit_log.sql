-- Sprint 10 (hardening): logs de auditoria das ações de equipe/admin.
-- Quem mudou o quê e quando: status/rastreio/exclusão de pedido, CRUD de
-- produto (inclui estoque e fotos), papéis de usuário e registro de webhook.
-- Gravado pelo backend (service role); leitura só pelo endpoint admin.

CREATE TABLE audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quem fez a ação (auth.users). O e-mail é um snapshot: continua legível
  -- mesmo se a conta for removida depois.
  user_id     UUID,
  user_email  TEXT,
  -- Ex.: 'pedido.atualizar', 'produto.estoque', 'usuario.role'
  acao        TEXT        NOT NULL,
  alvo_tipo   TEXT        NOT NULL,
  alvo_id     TEXT,
  detalhes    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);

-- Backend-only (service role): RLS habilitado sem policies.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
