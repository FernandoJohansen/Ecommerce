-- Adiciona email_cliente à tabela de pedidos para envio de e-mails transacionais.
-- Opcional (NULL para pedidos antigos e convidados sem e-mail informado).
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS email_cliente TEXT;
