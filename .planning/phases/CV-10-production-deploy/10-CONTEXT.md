# Phase 10: Production Deploy - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend runs on Render and frontend on Cloudflare Workers (`viapianastore.<account>.workers.dev`), both in production, with the frontend kept **private behind Cloudflare Access** until Phase 11 (payments) is done. Local development moves off the production database onto Local Supabase, migrations move to the Supabase CLI, production data is backed up and cleaned of test data, and CI/auto-deploy is in place. Covers DEPLOY-01..05.

Not in this phase: Mercado Pago credentials (Phase 11), removing the WhatsApp order fallback (Phase 12), custom domain (Phase 14), full monitoring/backup schedule (Phase 16).

</domain>

<decisions>
## Implementation Decisions

### Backend host & plan
- **D-01:** Backend on **Render**, Docker web service from `backend/Dockerfile`, health check path `/`.
- **D-02:** Render **Free plan permanently**. Upgrade only when concrete problems appear (hitting 750 h/month, unacceptable latency, 512 MB memory errors).
- **D-03:** Keep the free instance awake with **UptimeRobot pinging every 10 min**, set up in this phase (pulled forward from Phase 16) so in-process background jobs (order expiry, MP fallback poll, LGPD anonymization) keep running.
- **D-04 [informational]:** Render region = **same region as the Supabase project** (researcher to look up the project's region).
- **D-05:** Cloudflare Workers **Free** plan.

### Account ownership
- **D-06 [informational]:** All production services (Cloudflare, Render, Supabase, UptimeRobot) live in **Fernando's accounts**; transfer to Carolina later. Supabase project is already in Fernando's account.
- **D-07:** Downtime and failed-deploy alerts go to **Fernando only**.
- **D-08 [informational]:** No handover checklist now — handle transfer when it happens.

### Environments & data
- **D-09 [informational]:** **Straight to production**, no staging stack.
- **D-10:** **WhatsApp is only for FAQ/questions, never for orders or payment** (user rule, applies project-wide). In this phase, the deployed site is kept private so the existing WhatsApp checkout fallback never reaches a customer; the fallback itself is removed in Phase 12.
- **D-11:** Local development uses **Local Supabase in Docker** (`supabase start`), seeded from `backend/schema.sql` + `backend/migrations/`. `backend/.env` no longer points at production.
- **D-12:** Integration tests (`backend/tests/integration/`) run **against Local Supabase only**, never production; not added to CI.
- **D-13:** Production DB: **back up first** (`scripts/backup_db.sh`), **then delete test data** — test orders, `pedido_itens`, payments, webhook events, test users/reviews/audit noise — while **keeping products, scents/aromas, categories, product images and Fernando's admin role**.
- **D-14:** Cleanup happens **in this phase, after Local Supabase works** (so nothing writes test data to prod again).
- **D-15:** Master copy of production secrets lives in a **password manager**; Render and GitHub hold the live copies.

### Privacy while unlaunched
- **D-16:** Frontend gated with **Cloudflare Access** (free, one-time email PIN) — **only Fernando's email** allowed. Remove the gate at the end of Phase 11.

### Health & monitoring
- **D-17:** Add a **`GET /health/db` endpoint** that runs one lightweight Supabase query, returns no data, and is rate limited. UptimeRobot pings it every 10 min — keeps Render awake, detects DB outages, and counts as DB activity so the free Supabase project doesn't pause.
- **D-18:** No frontend monitor while the Access gate is up; add it when the gate comes off (Phase 11/16).

### Supabase plan
- **D-19:** Supabase **Free** plan. No automatic backups on Free, so manual backups (D-13 now, schedule in Phase 16) are essential.
- **D-20:** Document a **free-tier limits table** (Render, Supabase, Cloudflare Workers, UptimeRobot) with the warning sign for each, in `docs/DEPLOY.md`.

### Deploy & migrations flow
- **D-21:** Render **auto-deploys on push to `main` only after CI passes** ("After CI checks pass").
- **D-22:** Frontend "Deploy Frontend" workflow: run **manually once**, smoke test, then **switch to push-on-main gated on CI**.
- **D-23:** Migrations move to the **Supabase CLI**: dated files into `supabase/migrations/`, tested locally, applied to prod with `supabase db push`, so applied-state is tracked.
- **D-24:** Before adopting the CLI, **verify prod schema** by dumping it and diffing against `schema.sql` + migrations (incl. `2026-09-13_mp_pix_constraint.sql`); apply anything missing, then mark all existing migrations as applied in the CLI history.
- **D-25:** Rollback via **platform buttons** — Render "Rollback" and `wrangler rollback` — documented in `docs/DEPLOY.md`; then fix forward with a git revert.
- **D-26:** Post-deploy smoke test = **small curl script** (`/`, `/health/db`, `/api/produtos`, security headers on the site) **+ manual UI pass** (login, cart, checkout).

### Post-research amendments (2026-10-10, approved by Fernando)
- **D-27:** Migrations baseline (refines D-11/D-23/D-24): dump prod schema, diff against a local replay of `schema.sql` + migrations, fix any gap, then commit the verified dump as a single `supabase/migrations/<14-digit-ts>_baseline.sql`; mark it applied on prod with `supabase migration repair --status applied`; extract seed data into `supabase/seed.sql`; archive the 18 legacy files from `backend/migrations/`. New migrations after this use the CLI timestamp format.
- **D-28:** Render region = **Virginia (US East)** — supersedes D-04 (Supabase is in `sa-east-1`; Render has no South America region).
- **D-29:** UptimeRobot interval = **5 min** — supersedes the 10 min in D-03/D-17.
- **D-30:** **Rotate the Supabase pooler/DB password in this phase**, before the D-13 backup and before secrets go into Render.

### Claude's Discretion
- Exact Render service settings (instance name, env var grouping), uvicorn proxy-header flags so HTTPS/forwarded IPs are correct behind Render.
- How `/health/db` queries (cheapest read) and its rate limit value.
- Exact cleanup SQL and how test rows are identified (review the list with Fernando before deleting).
- Whether to rotate the Supabase pooler password now, since `SUPABASE_DB_URL` is needed for the D-13 backup (rotation is OPS-01 in Phase 16; doing it here is fine).
- Backend API on Render stays publicly reachable (needed for webhooks later); CORS `ALLOWED_ORIGINS` limited to the workers.dev origin.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Deploy runbook & requirements
- `docs/DEPLOY.md` — Phase 1 (backend on Render) and Phase 2 (frontend on Workers) steps, env table, smoke checklist; to be extended with limits table, rollback, Access gate
- `.planning/REQUIREMENTS.md` — DEPLOY-01..05
- `.planning/ROADMAP.md` — Phase 10 success criteria

### Backend runtime & config
- `backend/Dockerfile` — image, fixed port 8000, non-root user
- `backend/app/main.py` — background loops (`_expirar_pedidos_loop`, `_sincronizar_pagamentos_loop`, `_anonimizar_dados_loop`), `GET /` health, startup checks
- `backend/app/core/config.py` — env vars, `ENVIRONMENT=production` CORS guard, `PAYMENT_TOKEN_SECRET` fallback, `ENABLE_API_DOCS`
- `backend/app/core/ratelimit.py` — slowapi limiter, `RATE_LIMIT_TRUSTED_PROXY_HOPS`
- `backend/.env.example` — full env var list

### Frontend deploy
- `.github/workflows/deploy-frontend.yml` — manual trigger, `VITE_API_URL` guard, `CLOUDFLARE_API_TOKEN`
- `.github/workflows/ci.yml` — CI jobs that gate auto-deploys
- `frontend/wrangler.jsonc` — worker name `viapianastore`
- `frontend/src/server.ts` — CSP/security headers (connect-src built from `VITE_API_URL`)
- `frontend/.env.example`

### Database & data
- `backend/schema.sql` — base schema + seed
- `backend/migrations/` — 18 dated SQL migrations to move into `supabase/migrations/`
- `scripts/backup_db.sh` — pg_dump via session pooler (`SUPABASE_DB_URL`), restore commands in header
- `backend/tests/integration/conftest.py` — loads `backend/.env`; skips without it

### History
- `PENDENCIAS.txt` — notes on which migrations were applied to production and when
- `VULNERABILIDADES.txt` — security decisions (CORS, rate limiting, headers)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/backup_db.sh`: already does encrypted pg_dump with rotation — use as-is for the pre-cleanup backup.
- `app/core/ratelimit.py` limiter: reuse for `/health/db` rate limit.
- `app/core/database.py` Supabase client: reuse for the `/health/db` query.
- Deploy workflow already fails fast without `VITE_API_URL` — just add the push trigger + CI gate.

### Established Patterns
- Everything degrades cleanly without credentials (MP, Melhor Envio, Brevo unset → features off), so the backend can deploy with only Supabase + core vars.
- `ENVIRONMENT=production` enables the `ALLOWED_ORIGINS` wildcard guard; API docs off by default.
- Background jobs are in-process asyncio loops → require a single always-awake instance (hence D-03/D-17).
- Rate limiting is in-memory per instance → single Render instance is correct.

### Integration Points
- New `/health/db` route registers in `backend/app/main.py` next to `GET /`.
- `supabase/` directory (CLI config + migrations) at repo root; `backend/.env` for local points at `supabase start` URLs/keys.
- Render ↔ GitHub (auto-deploy after CI), Cloudflare Access ↔ workers.dev hostname, UptimeRobot ↔ `/health/db`.

</code_context>

<specifics>
## Specific Ideas

- "WhatsApp will be only for FAQ" — never an order or payment channel.
- Keep the whole stack on free tiers; upgrade only on evidence.
- Smoke script should be reusable after every deploy (later phases re-run it).

</specifics>

<deferred>
## Deferred Ideas

- **Remove WhatsApp order/payment fallback** (`frontend/src/routes/checkout.tsx`, `frontend/src/components/pagamento/pix-view.tsx`, `frontend/src/components/pagamento/comum.tsx`, `/atendimento` route + `AtendimentoForm`) and turn `/atendimento` into FAQ/contact — **Phase 12** (update its roadmap entry).
- **Remove the Cloudflare Access gate** and add the frontend uptime monitor — end of **Phase 11** / Phase 16.
- **Account handover to Carolina** (Cloudflare, Render, Supabase, UptimeRobot) — when it happens; no checklist now.
- **Integration tests in CI** with Supabase in GitHub Actions — not now.

</deferred>

---

*Phase: 10-production-deploy*
*Context gathered: 2026-10-10*
