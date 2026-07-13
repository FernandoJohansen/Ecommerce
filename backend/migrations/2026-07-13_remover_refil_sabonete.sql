-- Remove o Refil de Sabonete Líquido da vitrine (13/07/2026).
-- Desativado, não deletado, seguindo a convenção do catálogo
-- (pedidos antigos continuam referenciando o nome em pedido_itens).

UPDATE produtos SET ativo = FALSE WHERE nome = 'Refil de Sabonete Líquido';
