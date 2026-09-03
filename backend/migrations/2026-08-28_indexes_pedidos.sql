-- W5: índices ausentes que apoiam as queries mais frequentes.
--
-- pedidos(user_id)         → GET /api/pedidos/meus (sem índice = full-scan)
-- pedidos(status, created_at) → varredura de expiração (status='novo' + lt created_at)

CREATE INDEX IF NOT EXISTS pedidos_user_id_idx         ON pedidos (user_id);
CREATE INDEX IF NOT EXISTS pedidos_status_created_idx  ON pedidos (status, created_at);
