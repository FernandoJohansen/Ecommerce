-- A migração 2026-07-11_catalogo_tabela_precos.sql renomeou/desativou aromas
-- mas não atualizou carrinho_itens: itens de carrinho anteriores a ela ficam
-- presos com aromas que o checkout agora rejeita (422 "Aroma indisponível").
-- Idempotente: seguro re-executar.

BEGIN;

-- Renomeados na tabela oficial → acompanhar nos carrinhos existentes
UPDATE carrinho_itens SET aroma = 'Bamboo'      WHERE aroma = 'Bambu';
UPDATE carrinho_itens SET aroma = 'Capim-Limão' WHERE aroma = 'Capim-limão';

-- Aromas desativados ('Madeiras Nobres', 'Flor de Laranjeira', 'Baunilha &
-- Âmbar', 'Algodão Egípcio', 'Frutas Vermelhas', 'Tabaco & Couro'): decidir
-- com a Carolina entre remapear para um aroma oficial próximo ou remover os
-- itens. Para remover:
--   DELETE FROM carrinho_itens
--   WHERE aroma NOT IN (SELECT nome FROM aromas WHERE ativo);

COMMIT;
