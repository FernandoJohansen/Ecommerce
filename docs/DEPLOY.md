# Roteiro de go-live — viapianastore

Guia único, na ordem, para colocar o site no ar. Consolida os roteiros de
ativação espalhados no `PENDENCIAS.txt` (Sprints 6, 6b e 7). O código já está
pronto e validado (build do frontend, imagem Docker do backend e CI passam);
o que falta é infraestrutura, credenciais e configuração — passos que exigem
acesso aos painéis (Cloudflare, GitHub, Render/Railway, Supabase, Mercado
Pago, Melhor Envio).

Princípio de segurança do código: **tudo degrada de forma limpa**. Sem
credenciais do Mercado Pago o site funciona com pedido combinado pelo
WhatsApp; sem token do Melhor Envio o checkout segue sem frete. Dá para ir ao
ar na Fase 1–2 e ativar pagamentos/frete depois, sem novo deploy do frontend.

---

## Fase 1 — Backend no ar (Render ou Railway)

A imagem é `backend/Dockerfile` (porta 8000, usuário não-root, healthcheck em
`GET /`). Render e Railway entregam HTTPS público na 443 (exigido pelos webhooks do
Mercado Pago).

1. Criar o serviço apontando para o repo, root `backend/`, tipo Docker.
   - Render: Web Service → Docker → Health Check Path `/`.
   - Railway: New Service → GitHub repo → Dockerfile detectado.
2. Variáveis de ambiente mínimas (ver `backend/.env.example` para todas):

   | Variável | Valor |
   |---|---|
   | `SUPABASE_URL` | URL do projeto Supabase (a mesma do `.env` local) |
   | `SUPABASE_KEY` | service role key |
   | `ALLOWED_ORIGINS` | origem do frontend (fase 2; ex. `https://viapianastore.<conta>.workers.dev` — depois trocar pelo domínio final) |
   | `RATE_LIMIT_TRUSTED_PROXY_HOPS` | `1` (Render/Railway ficam atrás de 1 proxy) |
   | `PAYMENT_TOKEN_SECRET` | `openssl rand -hex 32` (senão deriva da SUPABASE_KEY) |

3. Deploy e teste: `curl https://SEU-BACKEND/` → `{"status":"ok"}` e
   `https://SEU-BACKEND/api/produtos` → catálogo.
4. Anotar a URL pública do backend — ela entra na Fase 2 como `VITE_API_URL`.

> Opcional (hardening): o FastAPI expõe `/docs` e `/openapi.json` públicos.
> Se incomodar, desabilitar com `FastAPI(docs_url=None, redoc_url=None,
> openapi_url=None)` — decisão de produto, não bloqueia o go-live.

## Fase 2 — Frontend no ar (Cloudflare Workers)

O deploy é o workflow **Deploy Frontend** (`.github/workflows/deploy-frontend.yml`),
gatilho manual (aba Actions → Run workflow).

1. No GitHub, `Settings > Secrets and variables > Actions`:
   - **Secret** `CLOUDFLARE_API_TOKEN` — token com permissão *Workers
     Scripts: Edit* (Cloudflare Dashboard → My Profile → API Tokens).
   - **Variable** `VITE_API_URL` — URL pública do backend (Fase 1).
     O workflow **falha de propósito** sem ela: sem a variável o bundle
     chamaria `/api` na própria origem do worker e nada funcionaria.
   - **Variable** `VITE_MERCADO_PAGO_PUBLIC_KEY` — pode ficar vazia até a
     Fase 3 (sem ela a aba Cartão mostra "método indisponível").
2. Rodar o workflow. A URL sai como `https://viapianastore.<conta>.workers.dev`.
3. Voltar ao backend e ajustar `ALLOWED_ORIGINS` para essa origem (sem barra
   no final). Reiniciar o serviço.
4. Smoke test no site publicado: vitrine carrega do catálogo, busca/filtros,
   página de produto, criar conta + login, carrinho, checkout até a tela
   final (sem PSP, termina em "entraremos em contato pelo WhatsApp").
5. Depois do primeiro deploy validado, trocar o gatilho do workflow para
   `push: { branches: [main] }` (nota no topo do próprio arquivo).

## Fase 3 — Pagamentos: PIX, cartão e boleto (Mercado Pago)

Detalhes: `PENDENCIAS.txt` → Sprint 6b. Resumo:

1. Criar aplicação (CheckoutBricks) na conta vendedor da Carolina.
2. `MERCADO_PAGO_ACCESS_TOKEN` (APP_USR-...) no backend;
   Public Key → variable `VITE_MERCADO_PAGO_PUBLIC_KEY` no GitHub + **rodar o
   workflow de deploy do frontend de novo** (a key entra no build).
3. `MERCADO_PAGO_WEBHOOK_URL=https://SEU-BACKEND/api/pagamento/webhook/mercadopago`.
4. Configurar o webhook no painel MP (evento "Pagamentos") só para obter o
   secret → `MERCADO_PAGO_WEBHOOK_SECRET` e então **`WEBHOOK_REQUIRE_SIGNATURE=true`**
   (fail-closed; sem o secret configurado deixe `false`).
5. Teste ponta a ponta: PIX, cartão e boleto num pedido barato (Varetas,
   R$ 8,00). O PIX também passa pelo Mercado Pago desde 13/09/2026 — não há
   mais certificado nem credencial Sicredi.

**Atenção:** com o Mercado Pago ativo, pedido `novo` sem pagamento expira em
24h com devolução de estoque (`PEDIDO_EXPIRA_HORAS`). Pedido negociado por
WhatsApp deve ir para "Em andamento" no admin.

## Fase 4 — Frete (Melhor Envio)

Detalhes: `PENDENCIAS.txt` → Sprint 7. Resumo:

1. Gerar token (escopo shipping-calculate) na conta Melhor Envio da Carolina.
2. `MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_CONTATO` (e-mail técnico),
   `FRETE_CEP_ORIGEM` (CEP de despacho em Ponta Grossa, só dígitos).
3. Validar cotação no checkout com CEP de outra cidade; pedido ≥ R$ 300 deve
   mostrar a opção mais barata "Grátis".

## Fase 5 — Domínio, DNS e SSL

1. Registrar o domínio (ex. registro.br) e colocar o DNS no Cloudflare.
2. Frontend: Workers & Pages → viapianastore → Settings → Domains & Routes →
   Add Custom Domain (SSL automático).
3. Backend: subdomínio `api.` apontando para o Render/Railway (CNAME; ambos
   emitem certificado sozinhos).
4. Propagar a mudança de URL nos 3 lugares:
   - `ALLOWED_ORIGINS` (backend) → nova origem do site
   - Variable `VITE_API_URL` no GitHub → `https://api.seudominio.com.br` +
     **novo deploy do frontend**
   - `MERCADO_PAGO_WEBHOOK_URL` + URL na tela de Webhooks do painel MP
5. **Hardening de auth (item 7 do VULNERABILIDADES.txt):** com o domínio no ar,
   frontend e backend passam a compartilhar o domínio registrável — momento
   certo de migrar o JWT de localStorage para cookie `HttpOnly; Secure;
   SameSite=Lax; Domain=.seudominio.com` (fecha roubo de token por XSS sem
   reabrir CSRF). Antes do domínio isso exigiria `SameSite=None` + CSRF e ficaria
   pior. Plano detalhado no VULNERABILIDADES.txt, item 7.

## Fase 6 — Pós-go-live (operação)

Pendências já mapeadas, fora do código:

- [ ] Supabase: conferir se a **confirmação de e-mail** está ativa
  (Authentication → Providers → Email).
- [ ] Supabase: **rotacionar a senha do session pooler** (exposta em chat em
  15/07) e preencher `SUPABASE_DB_URL` no `backend/.env` local.
- [ ] Backups: rodar `scripts/backup_db.sh` uma vez, conferir o `.dump` e
  agendar diário (exemplo de systemd user timer no cabeçalho do script).
  Testar restauração num projeto Supabase de teste.
- [ ] Ajustar o **estoque real** pela aba Estoque do admin (seed deixou 20
  para tudo).
- [ ] Estorno/chargeback NÃO reverte pedido automaticamente — tratar
  manualmente no admin quando o pagamento aparecer refunded/charged_back.
- [ ] Monitoramento/observabilidade (Sprint 12): no mínimo, uptime check no
  `GET /` do backend e no site (ex. UptimeRobot, gratuito).

## Checklist rápido de smoke test (depois de cada fase)

- `GET /` do backend → `{"status":"ok"}`
- Site: vitrine, produto, conta, carrinho, checkout completo
- Pagamento de teste do método recém-ativado (PIX / cartão / boleto)
- Admin: pedido aparece, status muda, auditoria registra
- Headers de segurança presentes no site (CSP etc.): `curl -sI https://SITE | grep -i content-security`
