-- Endurecimento de RLS: remove as policies amplas "TO authenticated USING(true)"
-- de pedidos/pedido_itens/produtos/aromas.
--
-- POR QUÊ
-- Essas policies liberavam LEITURA E ESCRITA de TODOS os pedidos (com PII e
-- documento em claro no banco), itens, produtos e aromas para QUALQUER usuário
-- com o papel `authenticated` — ou seja, qualquer cliente logado, não só o
-- painel do Supabase como o comentário antigo sugeria.
--
-- Hoje isso NÃO é explorável: o backend acessa o banco só com a service role
-- (que ignora RLS) e o frontend não tem cliente Supabase direto (fala apenas
-- com o backend, que mascara o documento e filtra por dono). As policies não
-- são usadas por nada — são peso morto que vira um rombo grave no dia em que
-- alguém plugar um cliente Supabase (anon key + JWT do usuário) no frontend,
-- padrão comum nessa stack. Removê-las deixa a RLS "deny by default" também
-- para o papel authenticated, sem afetar o app.
--
-- O que continua funcionando após esta migration:
--   - Vitrine: leitura pública de produtos/aromas ativos (policies *_public_read)
--   - Backend inteiro: service role ignora RLS (CRUD de pedido/produto/etc.)
-- Nada no código depende do papel `authenticated` acessar essas tabelas direto.

DROP POLICY IF EXISTS "pedidos_auth_all"      ON pedidos;
DROP POLICY IF EXISTS "pedido_itens_auth_all" ON pedido_itens;
DROP POLICY IF EXISTS "produtos_auth_all"     ON produtos;
DROP POLICY IF EXISTS "aromas_auth_all"       ON aromas;

-- Revoga também os grants de tabela para o papel authenticated (as policies
-- eram o gate; sem elas o grant não concede nada, mas tiramos por higiene).
-- anon mantém só o SELECT de catálogo concedido no schema.sql.
REVOKE ALL ON TABLE pedidos, pedido_itens FROM authenticated;
