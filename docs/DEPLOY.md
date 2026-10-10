# Roteiro de go-live — viapianastore

Guia único, na ordem, para colocar o site no ar. Consolida os roteiros de
ativação espalhados no `PENDENCIAS.txt` (Sprints 6, 6b e 7). O código já está
pronto e validado (build do frontend, imagem Docker do backend e CI passam);
o que falta é infraestrutura, credenciais e configuração — passos que exigem
acesso aos painéis. Os hosts são **Render** (backend) e **Cloudflare Workers**
(frontend); o banco é o Supabase.

Princípio de segurança do código: **tudo degrada de forma limpa**. Sem
credenciais do Mercado Pago o site funciona com pedido combinado pelo
WhatsApp; sem token do Melhor Envio o checkout segue sem frete. Dá para ir ao
ar na Fase 1–2 e ativar pagamentos/frete depois, sem novo deploy do frontend.

Notas operacionais:

- **Não existe stack de staging**: o deploy vai direto para produção (D-09).
  Por isso o site fica privado (Cloudflare Access) até o fim da Fase 11.
- Todas as contas (Cloudflare, Render, Supabase, UptimeRobot) são do Fernando
  por enquanto (D-06). A passagem para a Carolina acontece depois, sem checklist
  formal (D-08).

---

## Fase 1 — Backend no ar (Render)

A imagem é `backend/Dockerfile` (porta 8000, usuário não-root, healthcheck em
`GET /`). O Render entrega HTTPS público na 443 (exigido pelos webhooks do
Mercado Pago).

1. Render → New → Web Service → repositório `FernandoJohansen/Ecommerce`.
   - Language: **Docker**; Branch: `main`; Root Directory: `backend`;
     Dockerfile Path: `./Dockerfile`.
   - Region: **Virginia (US East)**. O Supabase está em `sa-east-1` e o Render
     não tem região na América do Sul (D-28, substitui D-04). A região não pode
     ser alterada depois.
   - Instance Type: **Free** (D-02). Só subir de plano com evidência: estourar
     as 750 h/mês, latência inaceitável ou OOM nos 512 MB.
2. Settings → Health Check Path: `/` (D-01).
3. Settings → Build & Deploy → Auto-Deploy: **After CI Checks Pass** (D-21).
   O Render não faz deploy se não encontrar checks, então o CI nunca pode ter
   filtro de paths.
4. Variáveis de ambiente (ver `backend/.env.example` para todas):

   | Variável | Valor | Origem |
   |---|---|---|
   | `SUPABASE_URL` | URL do projeto Supabase | Supabase → Project Settings → API |
   | `SUPABASE_KEY` | service role key (secreta) | Supabase → Project Settings → API |
   | `ENVIRONMENT` | `production` | fixo |
   | `ALLOWED_ORIGINS` | `https://viapianastore.<subdominio>.workers.dev` (sem barra no final) | subdomínio em Workers & Pages → Overview |
   | `FRONTEND_URL` | mesma origem de `ALLOWED_ORIGINS` | idem |
   | `PAYMENT_TOKEN_SECRET` | saída de `openssl rand -hex 32` | gerado localmente |
   | `RATE_LIMIT_TRUSTED_PROXY_HOPS` | `1` (provisório — validar com o teste de XFF abaixo) | fixo |
   | `PORT` | `8000` (o Dockerfile escuta em 8000; o padrão do Render é 10000) | fixo |

   Deixar **sem definir** no Render por enquanto: Mercado Pago, Melhor Envio,
   Brevo, `SUPABASE_DB_URL` e `ENABLE_API_DOCS`.

5. Deploy e teste: `curl https://SEU-BACKEND/` → `{"status":"ok"}` e
   `https://SEU-BACKEND/api/produtos` → catálogo.
6. Anotar a URL pública do backend — ela entra na Fase 2 como `VITE_API_URL`.

### Segredos

A cópia mestre de todo segredo de produção (senha do banco Supabase, service
role key, `PAYMENT_TOKEN_SECRET`, token da API da Cloudflare) fica no
**gerenciador de senhas** (D-15). Render e GitHub guardam as cópias em uso.
Nunca no repositório nem no `backend/.env`.

Regra de rotação (D-30): a senha do banco/pooler do Supabase é rotacionada
antes do primeiro backup e antes de o Render receber segredos (Dashboard →
Project Settings → Database → Reset database password).

### Validar o IP do rate limit (XFF)

Confirma que `RATE_LIMIT_TRUSTED_PROXY_HOPS=1` está correto atrás do proxy do
Render. Duas partes:

a. Da máquina de dev, enviar 31 requisições a `$API/health/db`, cada uma com
   um header `X-Forwarded-For` falso diferente. A 31ª deve retornar **429** (os
   valores forjados são ignorados).
b. Com o limite estourado, abrir `$API/health/db` num celular em dados móveis:
   deve retornar **200** (chaves por cliente, não um balde compartilhado).

Se (a) ou (b) falhar, ajustar `RATE_LIMIT_TRUSTED_PROXY_HOPS` e repetir.

### Monitoramento (UptimeRobot)

- Monitor HTTP(s) com keyword em `$API/health/db`, keyword `ok`, intervalo de
  **5 min** (D-29): mantém a instância acordada (abaixo do limite de 15 min de
  inatividade) e conta como atividade no Supabase (D-03, D-17).
- Contato de alerta: somente o e-mail do Fernando (D-07).
- Render → Account Settings → Notifications: avisos de deploy falho também
  para o Fernando.
- Sem monitor do frontend enquanto o gate do Access estiver ligado (D-18).

> Opcional (hardening): as docs da API (`/docs`, `/openapi.json`) ficam
> desligadas por padrão; só ligam com `ENABLE_API_DOCS=true`.

## Fase 2 — Frontend no ar (Cloudflare Workers)

O deploy é o workflow **Deploy Frontend** (`.github/workflows/deploy-frontend.yml`).

Ordem: Render primeiro, depois `VITE_API_URL`, depois a primeira execução
manual do workflow (`gh workflow run "Deploy Frontend"`) e, logo em seguida,
ligar o Access.

1. No GitHub, `Settings > Secrets and variables > Actions`:
   - **Secret** `CLOUDFLARE_API_TOKEN` — token criado com o template
     "Edit Cloudflare Workers" (Cloudflare → My Profile → API Tokens).
   - **Variable** `VITE_API_URL` — URL pública do backend no Render (Fase 1).
     Entra no bundle e na CSP em tempo de build; mudar exige novo deploy. O
     workflow **falha de propósito** sem ela.
   - **Variable** `VITE_MERCADO_PAGO_PUBLIC_KEY` — pode ficar vazia até a
     Fase 3 (sem ela a aba Cartão mostra "método indisponível").
2. Rodar o workflow. A URL sai como `https://viapianastore.<subdominio>.workers.dev`.
3. Voltar ao Render e ajustar `ALLOWED_ORIGINS` e `FRONTEND_URL` para essa
   origem (sem barra no final).
4. Supabase → Authentication → URL Configuration: Site URL e Redirect URLs
   incluem a origem workers.dev.
5. Smoke test (ver checklist no fim).
6. **Gatilho automático** (D-22): depois que o primeiro deploy manual passar no
   smoke test, o workflow passa a `workflow_run` no sucesso do CI para pushes em
   `main` (feito no plano 10-10).

### Site privado (Cloudflare Access)

D-16. Workers & Pages → `viapianastore` → Settings → Domains & Routes → linha
workers.dev → **Enable Cloudflare Access** → Manage Cloudflare Access:

- Policy: **Allow**; Include → Emails = somente o e-mail do Fernando.
- Login method: **One-time PIN**.
- No primeiro uso do Zero Trust pede um nome de time e o plano Free.

Por quê (D-10): o WhatsApp é só para dúvidas/FAQ, nunca para pedido ou
pagamento. O checkout atual ainda termina numa mensagem de WhatsApp, então o
site fica privado até o fallback ser removido (Fase 12) e os pagamentos
funcionarem. O gate é removido no fim da Fase 11. O fallback de WhatsApp do
checkout nunca pode chegar a clientes.

## Fase 3 — Pagamentos: PIX, cartão e boleto (Mercado Pago)

Detalhes: `PENDENCIAS.txt` → Sprint 6b. Resumo:

1. Criar aplicação (CheckoutBricks) na conta vendedor da Carolina.
2. `MERCADO_PAGO_ACCESS_TOKEN` (token de produção da aplicação) no backend;
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
3. Backend: subdomínio `api.` apontando para o Render (CNAME; o Render emite
   o certificado sozinho).
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

## Limites dos planos gratuitos

| Serviço | Limite | Sinal de alerta | O que fazer |
|---|---|---|---|
| Render Free | Dorme após 15 min ocioso (cold start ~1 min); 750 h/mês por workspace (cabe só um serviço free sempre acordado); instância única; rollback só para os 2 últimos deploys; sem portas SMTP | Primeira requisição lenta, "suspended", reinícios por OOM nos logs | Manter o monitor de 5 min; subir de plano só com evidência |
| Supabase Free | 500 MB de banco, 1 GB de storage, 5 GB de egress, 50k MAU; pausa após ~1 semana sem atividade; sem backups automáticos (D-19) | Banner "project paused", e-mails de cota | Monitor de 5 min conta como atividade; rodar `scripts/backup_db.sh`; upgrade se a cota apertar |
| Cloudflare Workers Free | 100k requisições/dia, 10 ms de CPU/requisição, 50 subrequests (D-05) | Erro 1027 (teto diário), 1102 (CPU) | Workers Paid só com evidência |
| UptimeRobot Free | 50 monitores, intervalo mínimo de 5 min | Alertas atrasados | Conferir os termos de uso comercial antes do lançamento (Fase 16) |
| GitHub Actions | Cota de minutos do plano | Jobs em fila ou falhando por cota | Reduzir execuções; revisar plano |

## Rollback

D-25.

- **Backend:** Render → serviço → Events → deploy anterior → Rollback (no plano
  free só os 2 últimos aparecem). Depois, `git revert <sha>` e push (o Render
  faz novo deploy após o CI).
- **Frontend:** `cd frontend && bunx wrangler rollback` (escolher a versão
  anterior; confirmar opções com `bunx wrangler rollback --help`). Depois,
  `git revert`.
- **Banco:** migrations são só para frente; corrigir com uma nova migration.
  Recuperação de desastre = restaurar um dump de `scripts/backup_db.sh` (os
  comandos de restauração estão no cabeçalho do script).

## Banco: desenvolvimento local e migrations (Supabase CLI)

D-11, D-12, D-23, D-27.

- Desenvolvimento local usa o Supabase Local em Docker:
  `bunx supabase@2.120.0 start`. API `http://127.0.0.1:54321`, banco
  `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, Studio `54323`,
  Mailpit `54324`.
- `backend/.env` aponta para o stack local, nunca para produção.
  `SUPABASE_DB_URL` só é exportada no shell ao rodar o backup.
- Testes de integração (`cd backend && uv run pytest tests/integration -v`)
  rodam apenas contra o Supabase Local e não estão no CI.
- Histórico: `supabase/migrations/20261010000000_baseline.sql` é o schema de
  produção verificado (baseline); o seed de dev local é `supabase/seed.sql`; os
  18 arquivos antigos estão arquivados em `supabase/legacy-migrations/` (só
  histórico, nunca reexecutar).
- Fluxo de mudança: `bunx supabase@2.120.0 migration new <nome>` → editar →
  `supabase db reset` local → rodar os testes → commit →
  `supabase link --project-ref <ref>` (uma vez) → `supabase db push` →
  `supabase migration list` deve mostrar Local == Remote.
- **Proibido em produção:** `db push --include-seed`, `db reset --linked` e
  editar `supabase_migrations` à mão (use `supabase migration repair`).

## Fase 6 — Pós-go-live (operação)

Pendências já mapeadas, fora do código:

- [ ] Supabase: conferir se a **confirmação de e-mail** está ativa
  (Authentication → Providers → Email).
- [x] Supabase: **rotacionar a senha do session pooler** — feito na Fase 10
  (D-30). `SUPABASE_DB_URL` só no shell ao rodar o backup.
- [ ] Backups: rodar `scripts/backup_db.sh` uma vez, conferir o `.dump` e
  agendar diário (exemplo de systemd user timer no cabeçalho do script).
  Testar restauração num projeto Supabase de teste.
- [ ] Ajustar o **estoque real** pela aba Estoque do admin (seed deixou 20
  para tudo).
- [ ] Estorno/chargeback NÃO reverte pedido automaticamente — tratar
  manualmente no admin quando o pagamento aparecer refunded/charged_back.
- [x] Monitor UptimeRobot do backend (`/health/db`, 5 min) — feito na Fase 10.
- [ ] Monitor UptimeRobot do frontend — pendente até remover o gate do Access
  (D-18).

## Checklist rápido de smoke test (depois de cada fase)

- Script: `scripts/smoke.sh https://<backend>.onrender.com https://viapianastore.<subdominio>.workers.dev`
  deve terminar em `smoke OK` (D-26). Com o gate do Access ligado, os headers do
  site só são checados se `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET`
  estiverem exportados.
- Passada manual na UI, logado pelo Access: vitrine carrega, busca, página de
  produto, criar conta + login, carrinho, checkout até a tela final. Ficar de
  olho em erro 1102 do Workers.
- Pagamento de teste do método recém-ativado (a partir da Fase 11)
- Admin: pedido aparece, status muda, auditoria registra
