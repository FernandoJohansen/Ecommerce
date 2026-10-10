# Phase 10: Production Deploy - Research

**Researched:** 2026-10-10
**Domain:** Render (Docker, free) + Cloudflare Workers/Access + Supabase CLI (local + prod migrations) + GitHub Actions gating
**Confidence:** MEDIUM-HIGH (platform behaviors verified in official docs; a few items flagged ASSUMED)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01 Backend on Render, Docker web service from `backend/Dockerfile`, health check path `/`.
- D-02 Render Free plan permanently; upgrade only on concrete problems (750 h, latency, 512 MB OOM).
- D-03 Keep free instance awake with UptimeRobot pinging every 10 min (pulled forward from Phase 16).
- D-04 Render region = same region as the Supabase project (researcher to look up).
- D-05 Cloudflare Workers Free plan.
- D-06 All prod services in Fernando's accounts; transfer to Carolina later.
- D-07 Downtime/failed-deploy alerts go to Fernando only.
- D-08 No handover checklist now.
- D-09 Straight to production, no staging stack.
- D-10 WhatsApp is only for FAQ/questions, never orders/payment. Site kept private so the WhatsApp checkout fallback never reaches a customer; fallback removed in Phase 12.
- D-11 Local dev uses Local Supabase in Docker (`supabase start`), seeded from `backend/schema.sql` + `backend/migrations/`. `backend/.env` no longer points at production.
- D-12 Integration tests run against Local Supabase only, never prod; not added to CI.
- D-13 Prod DB: back up first (`scripts/backup_db.sh`), then delete test data (orders, pedido_itens, payments, webhook events, test users/reviews/audit noise) while keeping products, aromas, categories, product images, Fernando's admin role.
- D-14 Cleanup happens in this phase, after Local Supabase works.
- D-15 Master copy of prod secrets in a password manager; Render and GitHub hold live copies.
- D-16 Frontend gated with Cloudflare Access (free, one-time email PIN), only Fernando's email. Remove gate at end of Phase 11.
- D-17 Add `GET /health/db`: one lightweight Supabase query, returns no data, rate limited. UptimeRobot pings it every 10 min.
- D-18 No frontend monitor while Access gate is up.
- D-19 Supabase Free plan; manual backups essential.
- D-20 Document a free-tier limits table (Render, Supabase, Cloudflare Workers, UptimeRobot) with warning signs in `docs/DEPLOY.md`.
- D-21 Render auto-deploys on push to `main` only after CI passes ("After CI checks pass").
- D-22 "Deploy Frontend" workflow: run manually once, smoke test, then switch to push-on-main gated on CI.
- D-23 Migrations move to Supabase CLI: dated files in `supabase/migrations/`, tested locally, applied to prod with `supabase db push`.
- D-24 Before adopting CLI, verify prod schema by dumping and diffing against `schema.sql` + migrations (incl. `2026-09-13_mp_pix_constraint.sql`); apply anything missing, then mark all existing migrations as applied in CLI history.
- D-25 Rollback via platform buttons (Render Rollback, `wrangler rollback`), documented in `docs/DEPLOY.md`; then fix forward with git revert.
- D-26 Post-deploy smoke = small curl script (`/`, `/health/db`, `/api/produtos`, security headers on the site) + manual UI pass (login, cart, checkout).

### Claude's Discretion
- Exact Render service settings (name, env grouping), uvicorn proxy-header flags.
- How `/health/db` queries and its rate limit value.
- Exact cleanup SQL and how test rows are identified (review list with Fernando before deleting).
- Whether to rotate the Supabase pooler password now (needed for `SUPABASE_DB_URL` backup; OPS-01 is Phase 16 but doing it here is fine).
- Backend API on Render stays publicly reachable; CORS `ALLOWED_ORIGINS` limited to the workers.dev origin.

### Deferred Ideas (OUT OF SCOPE)
- Remove WhatsApp order/payment fallback + `/atendimento` to FAQ (Phase 12).
- Remove Access gate + frontend uptime monitor (end of Phase 11 / 16).
- Account handover to Carolina.
- Integration tests in CI.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPLOY-01 | Backend on Render/Railway over HTTPS; `GET /` returns `{"status":"ok"}` | Render settings, PORT, health check, region finding |
| DEPLOY-02 | Frontend on Workers via "Deploy Frontend" workflow | Workflow gating, Access gate, secrets/vars |
| DEPLOY-03 | Prod env: `ALLOWED_ORIGINS`, `PAYMENT_TOKEN_SECRET`, `RATE_LIMIT_TRUSTED_PROXY_HOPS=1`, `ENVIRONMENT=production` | Env table, XFF pitfall |
| DEPLOY-04 | All migrations applied in prod incl. `2026-09-13_mp_pix_constraint.sql` | Supabase CLI adoption plan, schema verification |
| DEPLOY-05 | CI green on main; frontend deploy on push to main after first validated deploy | `workflow_run` gating |
</phase_requirements>

## Summary

The code is deploy-ready; this phase is mostly infrastructure plus three small code changes (`/health/db`, deploy workflow trigger, `supabase/` directory + smoke script) and docs. The majority of tasks are human-only dashboard work (Render, Cloudflare Zero Trust/Access, UptimeRobot, GitHub secrets, Supabase), so plans need `checkpoint:human-action` tasks with exact click paths and `checkpoint:human-verify` for outputs.

Three findings change the locked plan's assumptions and must be surfaced to Fernando:
1. **D-04 cannot be met literally.** The Supabase project is in `sa-east-1` (Sao Paulo) (session pooler host `aws-1-sa-east-1.pooler.supabase.com` found in repo docs/scripts). Render has no Sao Paulo region (Oregon, Ohio, Virginia, Frankfurt, Singapore). Closest = **Virginia (US East)**. Recommend Virginia.
2. **`backend/schema.sql` is NOT a faithful baseline** to which the 18 migrations can be replayed: it already contains `pagamentos` and `audit_log` (later migrations do `CREATE TABLE` without `IF NOT EXISTS` and would fail) but lacks `avaliacoes` and `webhook_events`. So D-11 ("seed from schema.sql + migrations") and D-23/D-24 need a baseline strategy (below).
3. **Neither Docker nor the Supabase CLI nor `pg_dump`/`psql` is installed on this machine** (probed). Local Supabase (D-11) and the backup (D-13) are blocked until they are installed.

**Primary recommendation:** Sequence work as: (A) code/docs changes in repo, (B) install tooling + Local Supabase + baseline, (C) backend on Render + UptimeRobot, (D) frontend manual deploy + Access gate, (E) backup then prod verification/cleanup/CLI adoption, (F) switch auto-deploy triggers and run smoke.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Catalog/orders API, health endpoints | API / Backend (Render) | Database | FastAPI owns logic; `/health/db` checks DB reachability |
| SSR + security headers (CSP) | Frontend Server (Workers) | CDN | `src/server.ts` sets CSP from `VITE_API_URL` at build time |
| Private-site gate | CDN / Edge (Cloudflare Access) | — | Enforced before the Worker runs; no app code |
| Migration history / schema | Database (Supabase) | CI/dev machine (CLI) | `supabase_migrations.schema_migrations` tracks applied state |
| Auto-deploy gating | CI (GitHub Actions) | Render, Cloudflare | Render watches check runs; frontend uses `workflow_run` |
| Keep-awake + uptime | External (UptimeRobot) | Backend `/health/db` | Traffic every 10 min prevents Render sleep and Supabase pause |
| Backups | Dev machine script | Supabase | Free plan has no automatic backups |

## Standard Stack

### Core
| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| Render Web Service (Docker, Free) | n/a | Backend host | Locked D-01/D-02 |
| Cloudflare Workers + wrangler | wrangler via `bunx` in CI (already in workflow) | Frontend host | Locked D-05 |
| Cloudflare Access (Zero Trust Free) | n/a | Private gate | Locked D-16 |
| Supabase CLI (`supabase` npm) | 2.120.0 (npm view, modified 2026-10-09) | Local stack, migrations, `db push` | Locked D-23 |
| UptimeRobot Free | n/a | Keep-awake + alerts | Locked D-03 |
| Docker | install (missing) | Required by `supabase start`/`db pull`/`db diff` | Supabase docs |
| PostgreSQL client tools (`pg_dump`, `psql`) | >= server major version | `backup_db.sh`, cleanup, dump diff | Missing locally |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `workflow_run` deploy trigger | `deploy` job with `needs:` inside `ci.yml` | Simpler and keeps one run graph, but D-22 names the separate "Deploy Frontend" workflow; `workflow_run` keeps it |
| Install supabase CLI globally | `bun add -d supabase` in repo root/frontend, `bunx supabase` | Pinned version; needs Node 20+ (present: v26). Repo root has no package.json, so global/brew/AUR or a pinned `bunx supabase@2.120.0` is cleaner |

**Installation (human, Arch/CachyOS host):**
```bash
sudo pacman -S docker postgresql   # postgresql provides pg_dump/psql client; start docker: sudo systemctl enable --now docker; add user to docker group
# Supabase CLI: use pinned bunx (no global install)
bunx supabase@2.120.0 --version
```
[ASSUMED: Arch package names `docker`, `postgresql`; `supabase` is also in AUR/community. Confirm pg_dump major >= Supabase server major (check Dashboard > Settings > Infrastructure).]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| supabase (CLI) | npm | multi-year, 2.120.0 published 2026-10-09 | high | github.com/supabase/cli (npm view repository.url) | unavailable (pip missing on host) | Documented in official Supabase docs as `npm install supabase --save-dev`; no postinstall output seen (`scripts.postinstall` empty). Tag [CITED: supabase.com/docs/guides/local-development/cli/getting-started]. Planner: still add `checkpoint:human-verify` before first install since slopcheck did not run |

**Packages removed due to slopcheck [SLOP]:** none. **Flagged [SUS]:** none. No other external packages are added by this phase (Python deps unchanged).

## Architecture Patterns

### System Architecture Diagram

```
Fernando browser --> Cloudflare Access (email PIN) --> Worker viapianastore.<acct>.workers.dev (SSR, CSP)
                                                           | browser XHR (VITE_API_URL, CORS = workers.dev origin)
                                                           v
UptimeRobot (10 min) --> GET /health/db ---------> Render (Virginia, Docker, uvicorn :8000, free, single instance)
                                                   |  GET / (Render health check)      |
                                                   v                                   v
                                         Supabase prod (sa-east-1, Free)   in-process loops (expiry, MP poll, LGPD)
GitHub push main --> CI (frontend, backend) --success--> Render deploy ("After CI checks pass")
                                          \--success--> workflow_run: Deploy Frontend --> wrangler deploy
Dev machine: supabase start (Docker) <-- supabase/migrations + seed.sql;  `supabase db push` --> prod
```

### Recommended additions to repo
```
supabase/
  config.toml            # from supabase init (commit)
  migrations/            # <14-digit timestamp>_name.sql
  seed.sql               # catalog seed (produtos, aromas, storage.buckets) extracted from schema.sql
scripts/smoke.sh         # post-deploy smoke (D-26)
backend/app/main.py      # + GET /health/db
backend/tests/test_health.py
.github/workflows/deploy-frontend.yml   # workflow_run + workflow_dispatch
docs/DEPLOY.md           # limits table, rollback, Access gate, supabase CLI flow
```

### Pattern 1: Render service settings (human-action)
- New > Web Service > repo `FernandoJohansen/Ecommerce`, Language **Docker**, Branch `main`, **Root Directory `backend`**, Dockerfile path `./Dockerfile`, Region **Virginia**, Instance **Free**.
- Health Check Path `/` (Settings > Health Checks). Docs: HTTP check must return 2xx/3xx within 5 s; failing 60 s consecutive => Render restarts instance; a new deploy that doesn't pass within 15 min is cancelled and the old one keeps serving. [CITED: render.com/docs/health-checks]
- Auto-Deploy: **After CI Checks Pass**. Render deploys only if all checks succeed and does **not** deploy if no checks are detected. [CITED: render.com/docs/deploys]
- **PORT:** Render default `PORT=10000`; Render says it usually detects another bound port but may fail. Dockerfile binds fixed 8000. Set env **`PORT=8000`** in Render so it is explicit (no Dockerfile change needed). [CITED: render.com/docs/web-services]
- Env vars (`backend/.env.example` has the full list; do not copy `.env`):

| Var | Value |
|-----|-------|
| `SUPABASE_URL`, `SUPABASE_KEY` | prod URL, service-role key (secret, from Supabase dashboard) |
| `ENVIRONMENT` | `production` (enables wildcard-CORS guard) |
| `ALLOWED_ORIGINS` | `https://viapianastore.<acct>.workers.dev` (no trailing slash; set after frontend's first deploy, then restart/redeploy) |
| `FRONTEND_URL` | same origin (password-reset redirect) |
| `RATE_LIMIT_TRUSTED_PROXY_HOPS` | `1` (see Pitfall 2 - verify) |
| `PAYMENT_TOKEN_SECRET` | `openssl rand -hex 32` |
| `PORT` | `8000` |
| `ENABLE_API_DOCS` | unset |
Leave MP / Melhor Envio / Brevo / `SUPABASE_DB_URL` unset on Render (backup var is local-only).

### Pattern 2: `/health/db` (code)
```python
# backend/app/main.py, next to GET /
from app.core.database import supabase  # existing client

@app.get("/health/db")
@limiter.limit("30/minute")
def health_db(request: Request):   # sync def: supabase-py is sync -> runs in threadpool
    try:
        supabase.table("aromas").select("id").limit(1).execute()
    except Exception:
        logger.warning("health/db failed", exc_info=True)
        return JSONResponse(status_code=503, content={"status": "error"})
    return {"status": "ok"}
```
Notes: `limiter.limit` requires a `request: Request` parameter; returns no data; UptimeRobot at 10 min = 6/h, so 30/min is far above legit use but caps abuse (in-memory, per instance). Verify the table/column name `aromas.id` exists (schema.sql line 25 defines `aromas`); pick any small always-present table. A 503 body is generic (no error leakage). The existing catch-all `Exception` handler re-raises non-APIError, so the explicit try/except is needed. Add unit test in `backend/tests/test_health.py` mocking `app.main.supabase` (root conftest sets mock env vars).

### Pattern 3: Frontend deploy gated on CI
```yaml
# .github/workflows/deploy-frontend.yml
on:
  workflow_dispatch:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
jobs:
  deploy:
    if: ${{ github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push') }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
```
`workflow_run` workflows execute from the default branch's copy of the file; `branches: [main]` filters on the triggering run's head branch; the `event == 'push'` check prevents PR runs (CI also runs on `pull_request`) from deploying. Keep the `VITE_API_URL` fail-fast step. [ASSUMED: standard GitHub Actions semantics; confirm with first run]. Per D-22: merge the YAML change only after the manual dispatch run is smoke-tested (or ship with workflow_dispatch only first, then a follow-up commit).

### Pattern 4: Cloudflare Access on the Worker (human-action)
Dashboard: Workers & Pages > `viapianastore` > Settings > Domains & Routes > workers.dev row > **Enable Cloudflare Access**; then **Manage Cloudflare Access** to set the allowed email (Fernando only). This covers workers.dev, preview URLs and routes. One-time PIN is the default identity method in Zero Trust (first-time Zero Trust onboarding asks for a team name; free plan). [CITED: developers.cloudflare.com/changelog/post/2025-10-03-one-click-access-for-workers; developers.cloudflare.com/workers/configuration/routing/workers-dev]. Free-plan eligibility and "no card required" for Zero Trust Free are [ASSUMED] - confirm in dashboard. Alternative: self-hosted application in Zero Trust > Access > Applications for only the hostname.
- Gate affects the browser-to-Worker traffic only. The Render API stays public (CORS-restricted), so XHR from the gated page works.
- **Smoke script impact:** an unauthenticated `curl` to the workers.dev URL returns a redirect/login page from Access, not the Worker's CSP headers. Options: (a) smoke script checks site headers only when `SITE_ACCESS_CLIENT_ID/SECRET` are provided (Access Service Token policy, `CF-Access-Client-Id`/`CF-Access-Client-Secret` headers) and otherwise prints SKIP; (b) test headers on the Worker before enabling Access (one-time) and re-enable the check after the gate is removed. Recommend (a)+manual check; keep the script generic for later phases.

### Pattern 5: Supabase CLI adoption on existing prod DB (D-11/D-23/D-24)
Facts [CITED: supabase.com/docs/guides/deployment/database-migrations; local-development/cli/getting-started]:
- `supabase init` creates `supabase/config.toml`, local files only.
- File names: `supabase/migrations/<timestamp>_<name>.sql` (14-digit, e.g. `20260711000000_catalogo_tabela_precos.sql`); applied in timestamp order. `supabase migration new <name>` creates a correctly named file.
- `supabase link --project-ref <ref>` connects to prod (asks for DB password).
- `supabase migration repair --status applied <timestamp>` only edits `supabase_migrations.schema_migrations`; it runs no SQL, so use only when schema truly matches.
- `supabase migration list` shows local vs remote history. `supabase db push` applies pending local migrations in order; `--include-seed` also seeds (never use against prod).
- `supabase db pull` writes a migration of the current remote schema (needs Docker shadow DB).
- `supabase db reset` re-applies migrations then `supabase/seed.sql`.
- `supabase start` prints API URL `http://127.0.0.1:54321`, DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, Studio 54323, Mailpit 54324, and `sb_publishable_...` / `sb_secret_...` keys.

**Recommended baseline strategy (decision for planner, mark as Open Question 1 for Fernando's OK):**
1. Install Docker/CLI/pg tools. Take the D-13 backup first (read-only, safe).
2. Dump prod schema only: `pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --no-privileges --schema=public -f prod_schema.sql`.
3. Build a local DB by replaying `schema.sql` then each migration in filename order (scratch Local Supabase) - expect failures from duplicate `CREATE TABLE pagamentos/audit_log` (finding 2). Diff local result vs prod dump (`supabase db diff` or `pg_dump` both and `diff`). Specifically confirm `pagamentos_identificador_psp` CHECK is the relaxed version and `pagamentos.status` default is `'pending'` (2026-09-13 migration), plus `avaliacoes`, `webhook_events`, `avaliacoes.moderado_em`, `email_cliente`, indexes, unique names, RLS-hardening policies.
4. Apply any migration missing in prod via SQL editor / psql (reviewed), re-dump, re-diff until clean (DEPLOY-04).
5. **Baseline file:** commit the verified prod schema dump as `supabase/migrations/20260101000000_baseline.sql` (single source of truth; local `supabase db reset` then works with zero replay conflicts). Move the 18 legacy files to `supabase/legacy-migrations/` (or leave in `backend/migrations/` with a README "historical, already folded into baseline") so history is retained. Mark baseline applied on prod: `supabase migration repair --status applied 20260101000000`. Future changes: `supabase migration new`, test with `db reset`, `supabase db push`.
   - This deviates from D-23's literal "dated files into supabase/migrations/" for the 18 old files; the alternative (rename 18 files with timestamps + fix schema.sql overlap, then repair all 18 as applied) is feasible but requires editing historical migrations to be idempotent. Present both; recommend baseline.
6. Extract the seed (`INSERT INTO produtos/aromas`, `storage.buckets` from schema.sql lines ~272-300) into `supabase/seed.sql`; `storage.buckets` inserts must tolerate existing rows (`ON CONFLICT DO NOTHING`).
7. Local `backend/.env`: `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_KEY=<secret key>`; remove prod values; keep `SUPABASE_DB_URL` only in a separate shell/env when running backups. Pitfall: backend pins `supabase==2.31.0`; whether it accepts the new `sb_secret_...` key format is unverified - if auth fails, use the legacy `service_role` JWT printed by `supabase status -o env` (`SERVICE_ROLE_KEY`) [ASSUMED]. Verify with the integration tests (`uv run pytest tests/integration -v`, D-12).
8. Backend auth flows use Supabase Auth (email confirmation): local Mailpit (54324) catches emails; set `FRONTEND_URL` accordingly. Prod: add the workers.dev URL to Supabase Auth > URL Configuration (Site URL + redirect allowlist) or password reset emails will not redirect correctly.

### Anti-Patterns to Avoid
- `--forwarded-allow-ips="*"` in the uvicorn CMD: it makes uvicorn rewrite `request.client.host` from the (spoofable) leftmost XFF and would defeat the repo's right-to-left hop logic in `core/ratelimit.py`. Leave uvicorn defaults; no Dockerfile change needed (HTTPS redirect and absolute URLs are not used by the app). [CITED: Render feedback thread says Render appends to client-supplied XFF; uvicorn default trusts 127.0.0.1 only]
- Running `supabase db push --include-seed` or `db reset --linked` against prod.
- Editing `supabase_migrations` by hand; use `migration repair`.
- Deleting prod rows outside a transaction.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration tracking | custom "applied" table | Supabase CLI history | Locked D-23 |
| Site privacy | auth middleware in Worker | Cloudflare Access | No code, enforced at edge |
| Keep-awake | in-app self-ping | UptimeRobot | Self-ping cannot wake a sleeping instance |
| Deploy gating | custom polling script | Render "After CI checks pass", `workflow_run` | Native |
| Encrypted backup | new script | existing `scripts/backup_db.sh` | Already does age/gpg + rotation |

## Common Pitfalls

### Pitfall 1: Render has no Sao Paulo region
Supabase is `sa-east-1`; nearest Render regions are Virginia/Ohio. Region cannot be changed after creation (new service needed). Pick Virginia now. Added latency per DB call (~110-130 ms RTT [ASSUMED]) multiplies on multi-query endpoints; watch order-creation latency. Fernando can confirm the Supabase region in Dashboard > Project Settings > General (or Connect > Session pooler host).

### Pitfall 2: Rate limiter hop count may be wrong behind Render
`RATE_LIMIT_TRUSTED_PROXY_HOPS=1` takes `ips[-1]` of XFF. If Render's chain appends more than one entry (e.g. an edge proxy IP after the client), every user would map to the same key (one shared bucket -> self-DoS on login/order limits) - or if it appends none, the client's spoofed value is used. Not verifiable from docs (Render docs do not describe XFF). **Verification task:** after first deploy, temporarily log (or use a throwaway debug run) `x-forwarded-for` and `request.client.host` for one request from a known IP, confirm the last entry is the real client IP, adjust hops. Mark DEPLOY-03 `HOPS=1` as provisional. Warning sign: 429s for unrelated users.

### Pitfall 3: Free instance sleep vs. loops
Free web services spin down after 15 min without inbound traffic and take ~1 min to wake; 750 free hours/workspace/month (a 31-day month is 744 h, so one always-awake service fits, but a second free service in the same workspace would exhaust it). If hours run out, all free services are suspended. Rollbacks only to the 2 most recent prior deploys. No outbound SMTP ports 25/465/587 (Brevo is HTTP API - fine). Render may restart the instance at any time, so loops must tolerate restarts. [CITED: render.com/docs/free]
Also: `_expirar_pedidos_loop` and `_sincronizar_pagamentos_loop` only start when `MERCADO_PAGO_ENABLED`; only the LGPD loop runs in Phase 10 (main.py lifespan).

### Pitfall 4: UptimeRobot interval
Free plan minimum interval is 5 min with 50 monitors [CITED: uptimerobot.com/pricing]; D-03's 10 min is allowed and < 15 min sleep threshold, but a missed ping or ~1 min cold start leaves little margin: recommend **5 min** (still free) unless Fernando prefers 10. One source says free plan is non-commercial (Oct 2024 terms) [LOW confidence, check terms]; the site is unlaunched/private now - flag for Phase 16 if commercial restriction applies. Configure e-mail alert to Fernando (D-07), HTTP monitor on `/health/db`; optionally "keyword" check for `"ok"`.

### Pitfall 5: Cloudflare Workers Free CPU limit
10 ms CPU per request, 100k req/day, 50 subrequests, 64 MiB bundle [CITED: developers.cloudflare.com/workers/platform/limits]. SSR of React pages can exceed 10 ms CPU (error 1102) on heavier routes. Warning sign: intermittent 1102/503 on SSR routes in the manual UI pass; fallback is Workers Paid ($5/mo) - report to Fernando, don't pre-upgrade (D-02/D-05 spirit).

### Pitfall 6: Access gate vs CORS/CSP and automation
Access does not alter API CORS. But curl smoke on the site and any Cloudflare-side health tooling get the login page (see Pattern 4). Also preview/version URLs are protected by the same toggle. Also Access JWT validation inside the Worker is recommended by Cloudflare but unnecessary here because the Worker holds no secrets (public data only) - note as accepted risk while hostname is obscure.

### Pitfall 7: `VITE_API_URL` is baked at build time
CSP `connect-src` in `src/server.ts` is built from it; the Render URL must be known (and the service created) before the first frontend deploy; changing the backend URL later (Phase 14 custom domain) needs a new frontend build. Order: Render first -> `VITE_API_URL` variable -> frontend deploy -> `ALLOWED_ORIGINS` on Render -> redeploy/restart.

### Pitfall 8: Supabase Free pauses inactive projects
Free projects pause after about a week of inactivity; `/health/db` via UptimeRobot counts as activity (D-17). No automatic backups on Free, hence D-13. Limits: 500 MB DB, 1 GB storage, 5 GB egress, 50k MAU, 2 free projects [CITED: supabase.com/docs/guides/platform/billing-on-supabase]. Product images are in Supabase Storage (1 GB cap).

### Pitfall 9: Render "After CI checks pass" with no checks
Render won't deploy when no checks are detected. CI runs on every push to `main`, so fine; but the first deploy (service creation) is a manual build. Do not make CI path-filtered. A failing CI (e.g. Docker build job) blocks backend deploy - good.

### Pitfall 10: Cleanup deleting the wrong data
`auth.users` deletion cascades to `user_roles` (FK ON DELETE CASCADE); deleting Fernando's user would drop the admin role. Always exclude his user id, run inside a transaction, and show row counts first.

## Prod cleanup approach (D-13/D-14)

Tables (from schema.sql + migrations): `produtos`, `aromas`, `categories`/category tables (check actual name in `backend/app/api/v1/categories.py` and migration `catalogo_tabela_precos`), `pedidos`, `pedido_itens`, `pagamentos`, `webhook_events`, `avaliacoes`, `carrinho_itens`, `user_roles`, `audit_log`, `auth.users`, storage buckets (product images). FK graph: `pedido_itens`, `pagamentos`, `avaliacoes` -> `pedidos` (ON DELETE CASCADE); `avaliacoes.produto_id` -> `produtos` (SET NULL); `user_roles` -> `auth.users` (CASCADE). `webhook_events` and `audit_log` have no FK to orders (audit_log.user_id is plain UUID).

Procedure (human reviews each step; psql from the dev machine using the session pooler URL, after the backup file is verified readable):
```sql
BEGIN;
-- 1. Review first (counts + sample)
SELECT count(*) FROM pedidos; SELECT count(*) FROM pagamentos; SELECT count(*) FROM webhook_events;
SELECT id, email, created_at FROM auth.users ORDER BY created_at;   -- Fernando picks users to keep
-- 2. Delete (children cascade from pedidos)
DELETE FROM avaliacoes;
DELETE FROM pedidos;                  -- cascades pedido_itens, pagamentos
DELETE FROM webhook_events;
DELETE FROM carrinho_itens;
DELETE FROM audit_log;
DELETE FROM auth.users WHERE id <> '<FERNANDO_UUID>';   -- cascades user_roles of others
-- 3. Verify: Fernando's role + catalog intact
SELECT * FROM user_roles; SELECT count(*) FROM produtos; SELECT count(*) FROM aromas;
-- COMMIT only after counts look right, else ROLLBACK
```
Stock: orders decrement `produtos.estoque` (RPC `ajustar_estoque`); test orders may have left stock reduced -> reset stock (`UPDATE produtos SET estoque = ...`) per Fernando's real numbers (DEPLOY.md Phase 6 notes real stock is a pending item). Because the backup is encrypted and may not contain `auth` if scoped, backup script dumps `public` + `auth` (see script header). Confirm restore path once (restore into a local Supabase, not prod) - cheap proof the backup is usable.

## Smoke script (D-26) - `scripts/smoke.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail
API="${1:?usage: smoke.sh https://api-host [https://site-host]}"; SITE="${2:-}"
fail(){ echo "FAIL: $*" >&2; exit 1; }
curl -fsS --max-time 90 "$API/" | grep -q '"status":"ok"' || fail "GET /"          # 90s tolerates cold start
curl -fsS --max-time 30 "$API/health/db" | grep -q '"status":"ok"' || fail "GET /health/db"
curl -fsS --max-time 30 "$API/api/produtos" | grep -q '^\[' || fail "GET /api/produtos"   # adjust to real shape
if [[ -n "$SITE" ]]; then
  hdrs=$(curl -sI --max-time 30 ${CF_ACCESS_CLIENT_ID:+-H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"} "$SITE")
  for h in content-security-policy x-content-type-options; do grep -qi "^$h:" <<<"$hdrs" || echo "WARN: missing $h (Access login page if gate is on)"; done
fi
echo "smoke OK"
```
Check the exact JSON shape of `/api/produtos` and which security headers `src/server.ts` actually sets before finalizing. Backend headers come from `SecurityHeadersMiddleware`.

## Free-tier limits table (D-20, for docs/DEPLOY.md)

| Service | Limit | Warning sign |
|---------|-------|--------------|
| Render Free web | sleeps after 15 min idle; ~1 min cold start; 750 h/month per workspace; single instance; no disk; rollbacks to 2 prior deploys; no SMTP ports; bandwidth/build minutes capped | slow first request, services "suspended", 512 MB OOM restarts in logs [CITED render.com/docs/free; 512 MB is ASSUMED] |
| Supabase Free | 500 MB DB, 1 GB storage, 5 GB egress, 50k MAU, pauses after ~1 week inactivity, no auto backups | "project paused" banner, 402/over-quota emails, DB size in Reports [CITED] |
| Cloudflare Workers Free | 100k req/day, 10 ms CPU/request, 50 subrequests, 64 MiB bundle | Error 1027 (daily cap), 1102 (CPU) [CITED] |
| UptimeRobot Free | 50 monitors, 5-min interval, possible non-commercial terms | email alerts stop / terms notice [CITED/LOW] |
| GitHub Actions | free minutes (private repo quotas) [ASSUMED] | queued/failed jobs for quota |

## Rollback (D-25)
- Render: service > Events/Deploys > **Rollback** on a previous deploy (free: 2 most recent) [CITED render.com/docs/free]; then `git revert` + push. Disable auto-deploy if needed while fixing.
- Workers: `cd frontend && bunx wrangler rollback` (select previous version). [ASSUMED: command per Cloudflare Workers versions docs; verify `wrangler rollback --help`]
- DB: no automatic rollback; migrations are forward-only; fix forward with a new migration; restore from `backup_db.sh` dump for disasters.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | `supabase start`, `db pull/diff` | NO | - | none (install; or Podman/colima per Supabase docs) |
| Supabase CLI | D-11, D-23 | NO | npm latest 2.120.0 | `bunx supabase@2.120.0` |
| pg_dump / psql | `backup_db.sh`, cleanup, dump diff | NO | - | `docker run --rm postgres:<ver> pg_dump ...` once Docker is installed |
| age | encrypted backup | NO | - | gpg 2.4.9 present (symmetric/public key supported by script) |
| gpg | backup | YES | 2.4.9 | - |
| bun | frontend | YES | 1.4.2 | - |
| node / npm | CLI via npm | YES | v26.10.0 / 12.2.0 | - |
| uv | backend tests | YES | 0.12.23 | - |
| gh | secrets/vars via CLI | YES | 2.102.0 | dashboard |
| curl | smoke | YES | 8.22.0 | - |
| wrangler | local rollback | NO (global) | - | `bunx wrangler` (as CI does) |
| slopcheck (pip) | package audit | NO (pip missing) | - | n/a |

**Missing with no fallback:** Docker daemon (blocks D-11 and CLI `db pull`); must be installed by Fernando (needs sudo).
**Human-only accounts/dashboards:** Render, Cloudflare (API token with Workers Scripts: Edit; Zero Trust onboarding), UptimeRobot, Supabase (DB password / pooler rotation, Auth URL config), GitHub secrets/variables (`gh secret set CLOUDFLARE_API_TOKEN`, `gh variable set VITE_API_URL` can be automated once the values exist).

## Task automation split (for planner checkpoints)
- Automatable (agent): `/health/db` + test; `deploy-frontend.yml` change; `supabase init`, config, seed.sql, scripts/smoke.sh; DEPLOY.md updates (limits table, rollback, Access, CLI flow); baseline diff scripts; cleanup SQL drafts; `gh variable set` once URL known.
- Human-action: install Docker/pg tools; Render service creation + env secrets; Supabase password rotation / region confirmation / Auth URL config; Cloudflare token + Access enable; UptimeRobot monitor; password-manager storage (D-15); running destructive cleanup (must be user-confirmed - config `always_confirm_destructive`); `supabase link` (password prompt) and `db push`.
- Human-verify: Render first deploy logs, curl outputs, manual UI pass (login, cart, checkout ending in WhatsApp message), alert test (pause monitor/stop service).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.4.1 + pytest-asyncio 0.24 (backend); ESLint + build (frontend) |
| Config file | `backend/tests/conftest.py` (mock env), `backend/tests/integration/conftest.py` (real env, skips without `.env`) |
| Quick run command | `cd backend && uv run pytest tests/ -q` |
| Full suite command | CI: ruff + compileall + pytest + docker build; local: `uv run pytest tests/integration -v` against Local Supabase |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-01 | `/` ok, `/health/db` ok/503, rate limited | unit (TestClient + mock) | `uv run pytest tests/test_health.py -q` | Wave 0 |
| DEPLOY-01 | live backend answers | smoke | `scripts/smoke.sh https://<api>` | Wave 0 |
| DEPLOY-02 | workflow deploys; `VITE_API_URL` guard | manual dispatch + `gh run watch` | `gh workflow run "Deploy Frontend" && gh run watch` | manual |
| DEPLOY-03 | prod env set; CORS limited; rate-limit IP correct | smoke + manual | `curl -sI -H "Origin: https://evil.example" $API/api/produtos` (no ACAO header); `curl -H "Origin: <workers.dev>"` (ACAO present) | Wave 0 (in smoke) |
| DEPLOY-04 | prod history == local migrations | CLI | `supabase migration list` (all rows Local+Remote) and schema dump diff empty | manual |
| DEPLOY-05 | CI green; deploy runs on push | CI | `gh run list --workflow CI --branch main -L1`; `gh run list --workflow "Deploy Frontend" -L2` | manual |
| D-12 | integration tests pass on Local Supabase | integration | `cd backend && uv run pytest tests/integration -v` | exists |

### Sampling Rate
- Per task commit: `uv run pytest tests/ -q` and `uv run ruff check app`
- Per wave merge: full CI equivalent + `bun run lint && bun run build` (frontend)
- Phase gate: smoke script green on prod + manual UI pass + `supabase migration list` clean

### Wave 0 Gaps
- [ ] `backend/tests/test_health.py` - covers `/health/db` (ok, DB failure -> 503, no data leaked)
- [ ] `scripts/smoke.sh`
- [ ] Docker + supabase CLI + pg tools installed (human)

## Security Domain (ASVS L1)

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (existing); Cloudflare Access email PIN for the gate |
| V3 Session Management | yes | JWT unchanged; no change this phase |
| V4 Access Control | yes | Access policy = Fernando's email only; service-role key only in Render env; admin role preserved in cleanup |
| V5 Input Validation | low | `/health/db` takes no input |
| V6 Cryptography | yes | `PAYMENT_TOKEN_SECRET` via `openssl rand -hex 32`; encrypted backups (age/gpg) |
| V7/V14 Config & Deployment | yes | `ENVIRONMENT=production`, docs off, explicit CORS, secrets in Render/GitHub only |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Leaked service-role / pooler password (pooler password exposed in chat 15/07 per DEPLOY.md) | Information disclosure | Rotate pooler/DB password now (Discretion item) before using `SUPABASE_DB_URL`; store in password manager (D-15); consider rotating service key if ever shared |
| XFF spoofing defeating rate limits | Spoofing/DoS | Right-to-left hop logic (existing); verify hop count (Pitfall 2) |
| `/health/db` abuse (DB load) | DoS | slowapi limit; no data returned; generic 503 |
| CORS wildcard | Tampering | `ENVIRONMENT=production` guard + explicit origin |
| Exposed API docs | Info disclosure | `ENABLE_API_DOCS` unset |
| Secrets in CI logs / repo | Info disclosure | GitHub secrets for `CLOUDFLARE_API_TOKEN`; variables only for public values (`VITE_*`); never commit `.env`; token scoped to Workers Scripts: Edit |
| Destructive SQL on prod | Tampering | verified backup first, transaction, row counts, Fernando confirmation |
| Unlaunched site reachable | Info disclosure / business | Access gate; note API is still public (catalog is public data) |
| Test data / PII in backups unencrypted | Info disclosure (LGPD) | configure `BACKUP_AGE_RECIPIENT` or gpg; store dump outside repo (`backups/` must be gitignored - verify) |
| workflow_run privilege (runs with secrets on default-branch code) | Elevation | Restrict to `event == 'push'` on main; never check out PR head with secrets |

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Supabase legacy anon/service_role JWT keys | `sb_publishable_` / `sb_secret_` keys shown by `supabase start` | Verify `supabase==2.31.0` accepts them; else use legacy JWT |
| Access via Zero Trust app setup | One-click "Enable Cloudflare Access" in Worker settings (Oct 2025) | Much simpler gate |
| Pinned CLI via npm devDependency recommended by Supabase | | Pin version |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Arch package names `docker`, `postgresql` provide needed tools | Standard Stack | Install step wording only |
| A2 | Zero Trust Free plan allows Access without payment card, supports this toggle | Pattern 4 | Gate may need card or fail; fallback: alternative gate or keep site undeployed |
| A3 | Render XFF chain format (last entry = real client with 1 hop) | Pitfall 2 | Rate-limit keys wrong; verify after deploy |
| A4 | `supabase status -o env` exposes legacy `SERVICE_ROLE_KEY` | Pattern 5 | Local `.env` key sourcing |
| A5 | supabase-py 2.31.0 may not accept `sb_secret_` keys | Pattern 5 | Local setup friction |
| A6 | `wrangler rollback` command usage | Rollback | Docs wording |
| A7 | `workflow_run` semantics as described | Pattern 3 | Deploy may not fire; test with dispatch |
| A8 | Render free = 512 MB RAM | Limits table | Wrong warning sign |
| A9 | Virginia RTT to sa-east-1 ~110-130 ms | Pitfall 1 | Latency expectations |
| A10 | UptimeRobot free is non-commercial | Pitfall 4 | Needs plan decision in Phase 16 |
| A11 | Virginia offers the Free instance type | Pattern 1 | Pick Ohio otherwise |

## Open Questions

1. **Baseline strategy for migrations (finding 2).** schema.sql overlaps migrations; recommend single baseline from verified prod dump + legacy files archived. Needs Fernando's OK since D-23 literally says dated files into `supabase/migrations/`.
2. **Render region.** Recommend Virginia (nearest to sa-east-1); D-04's "same region" is impossible. Confirm.
3. **UptimeRobot interval 5 vs 10 min.** Recommend 5.
4. **Category table name / storage bucket contents** to preserve in cleanup: confirm by reading `categories.py` and migrations during planning.
5. **Access vs smoke script on the site.** Service token or manual-only header check.
6. **Rotate pooler password now?** Recommend yes (needed for backup; previously exposed).

## Sources

### Primary (HIGH)
- https://render.com/docs/web-services (PORT 10000, bind 0.0.0.0)
- https://render.com/docs/deploys (After CI Checks Pass semantics)
- https://render.com/docs/health-checks (2xx/3xx in 5 s, restart after 60 s, 15 min deploy cancel)
- https://render.com/docs/free (sleep, 750 h, restrictions, rollbacks)
- https://render.com/docs/regions (Oregon, Ohio, Virginia, Frankfurt, Singapore; no region change)
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/ and https://developers.cloudflare.com/changelog/post/2025-10-03-one-click-access-for-workers (Access on workers.dev)
- https://developers.cloudflare.com/workers/platform/limits/
- https://supabase.com/docs/guides/deployment/database-migrations, https://supabase.com/docs/guides/local-development/cli/getting-started, https://supabase.com/docs/guides/platform/billing-on-supabase
- Repo: `backend/app/main.py`, `core/ratelimit.py`, `core/config.py`, `Dockerfile`, `.github/workflows/*.yml`, `schema.sql`, `scripts/backup_db.sh`, `docs/DEPLOY.md`

### Secondary (MEDIUM/LOW)
- https://uptimerobot.com/pricing (50 monitors / 5 min); non-commercial note from third-party guide (LOW)
- Render feedback thread on XFF appending; uvicorn proxy-headers behavior (MEDIUM)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all locked by CONTEXT; platform docs verified
- Architecture: MEDIUM-HIGH - baseline strategy and XFF hop count need on-machine verification
- Pitfalls: MEDIUM - several depend on first-deploy observation

**Research date:** 2026-10-10
**Valid until:** 2026-11-10 (platform UIs change; re-check Render/Cloudflare dashboard labels)
