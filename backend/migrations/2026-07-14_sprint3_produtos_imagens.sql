-- Sprint 3 stragglers: fotos de produto enviadas pelo admin.
-- URLs públicas do bucket "produtos"; a primeira imagem é a principal.
-- Produtos com o array vazio continuam usando as fotos embutidas no site
-- (frontend/src/lib/produto-imagens.ts).

ALTER TABLE produtos ADD COLUMN imagens TEXT[] NOT NULL DEFAULT '{}';

-- Bucket público de leitura; uploads passam pelo backend (service role),
-- então não são necessárias policies de storage.
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', TRUE)
ON CONFLICT (id) DO NOTHING;
