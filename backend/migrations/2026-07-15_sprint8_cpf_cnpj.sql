-- Sprint 8 (NFe): suporte a CNPJ no checkout (compra como pessoa jurídica).
-- A coluna passa a guardar CPF (11 dígitos) ou CNPJ (14 dígitos), só dígitos;
-- o tipo é derivado do tamanho.

ALTER TABLE pedidos RENAME COLUMN cpf TO cpf_cnpj;
