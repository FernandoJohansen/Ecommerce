-- M3: garante unicidade de nome em produtos e aromas no banco, não só no código.
-- Sem isto, duas criações simultâneas ou um INSERT manual no SQL editor produzem
-- duas linhas com o mesmo nome, e reservar_estoque_pedido decrementa ambas.

CREATE UNIQUE INDEX IF NOT EXISTS produtos_nome_unique ON produtos (nome);
CREATE UNIQUE INDEX IF NOT EXISTS aromas_nome_unique   ON aromas   (nome);
