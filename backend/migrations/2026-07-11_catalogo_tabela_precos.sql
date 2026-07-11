-- Adds the products and aromas from the official Tabela de Preços (julho/2026)
-- that were missing from the catalogue: Kit Lavabo, Refil de Sabonete Líquido,
-- CarSpray, Difusor de Carro and Varetas; replaces the placeholder aroma list
-- with the official one (old aromas are deactivated, not deleted).
-- Idempotent: safe to re-run.

BEGIN;

-- ── Novos produtos ───────────────────────────────────────────────────────────

INSERT INTO produtos (nome, tamanhos, descricao, tag, ordem, estoque, precos)
SELECT 'Kit Lavabo', ARRAY['100ml','250ml'],
  'Difusor e sabonete líquido em vidro para o lavabo. Disponível em 100ml e 250ml.',
  'Para o lavabo', 5, 20, '{"100ml": 9500, "250ml": 22000}'
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Kit Lavabo');

INSERT INTO produtos (nome, tamanhos, descricao, tag, ordem, estoque, precos)
SELECT 'Refil de Sabonete Líquido', ARRAY['100ml','250ml','500ml','1L'],
  'Refil de sabonete líquido para o seu kit lavabo, em diversos volumes.',
  'Recarregue & economize', 6, 20, '{"100ml": 1990, "250ml": 4500, "500ml": 6500, "1L": 13000}'
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Refil de Sabonete Líquido');

INSERT INTO produtos (nome, tamanhos, descricao, tag, ordem, estoque, precos)
SELECT 'CarSpray', ARRAY['60ml'],
  'Spray de 60ml para perfumar o carro. Aromas: Alecrim, Chá Branco, Cereja e Avelã, Tenuê e Vanilla.',
  'Para o carro', 7, 20, '{"60ml": 2000}'
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'CarSpray');

INSERT INTO produtos (nome, tamanhos, descricao, tag, ordem, estoque, precos)
SELECT 'Difusor de Carro', ARRAY['Único'],
  'Difusor compacto para o retrovisor. Aromas: Alecrim, Chá Branco, Cereja e Avelã, Tenuê e Vanilla.',
  'Para o carro', 8, 20, '{"Único": 2000}'
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Difusor de Carro');

INSERT INTO produtos (nome, tamanhos, descricao, tag, ordem, estoque, precos)
SELECT 'Varetas', ARRAY['Kit com 5'],
  'Kit com 5 varetas de reposição para difusores.',
  'Reposição', 9, 20, '{"Kit com 5": 800}'
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Varetas');

-- Todos os refis de difusor acompanham um kit de varetas de madeira
UPDATE produtos
SET descricao = 'Renove o aroma do seu difusor com nossos refis em diversos volumes. Acompanha kit de varetas de madeira.'
WHERE nome = 'Refil';

-- ── Aromas oficiais ──────────────────────────────────────────────────────────

-- Renomeia os que mudaram de grafia na tabela oficial
UPDATE aromas SET nome = 'Capim-Limão' WHERE nome = 'Capim-limão';
UPDATE aromas SET nome = 'Bamboo'      WHERE nome = 'Bambu';

-- Desativa os aromas do seed provisório que não existem na tabela oficial
UPDATE aromas SET ativo = FALSE
WHERE nome IN ('Madeiras Nobres', 'Flor de Laranjeira', 'Baunilha & Âmbar',
               'Algodão Egípcio', 'Frutas Vermelhas', 'Tabaco & Couro');

-- Insere os aromas oficiais que faltam
INSERT INTO aromas (nome, ordem)
SELECT v.nome, v.ordem
FROM (VALUES
  ('Baby',                    2),
  ('Cereja e Avelã',          5),
  ('Chá Branco',              6),
  ('Chá Branco com Vanilla',  7),
  ('Tenuê',                   9),
  ('Tenuê com Chá Branco',   10),
  ('Vanilla',                11)
) AS v(nome, ordem)
WHERE NOT EXISTS (SELECT 1 FROM aromas a WHERE a.nome = v.nome);

-- Ordem oficial da tabela
UPDATE aromas SET ordem = 1,  ativo = TRUE WHERE nome = 'Alecrim';
UPDATE aromas SET ordem = 3,  ativo = TRUE WHERE nome = 'Bamboo';
UPDATE aromas SET ordem = 4,  ativo = TRUE WHERE nome = 'Capim-Limão';
UPDATE aromas SET ordem = 8,  ativo = TRUE WHERE nome = 'Lavanda';

COMMIT;
