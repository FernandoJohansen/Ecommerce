---
phase: 10-production-deploy
plan: 04
subsystem: database
tags: [supabase, backup, schema-diff, migrations, postgres]
requires:
  - phase: 10-03
    provides: "Toolchain (Docker, Supabase CLI 2.120.0, pg tools) and rotated DB password"
provides:
  - "supabase/config.toml (project_id viapianastore) and Local Supabase running in Docker"
  - "Encrypted prod backup (public + auth) taken after the password rotation (D-13)"
  - "Prod public schema dump, local replay dump, normalized diff and 11-check gap list (D-24)"
  - "backups/schema/gap_fix.sql drafting the one missing migration (mp_pix_constraint)"
affects: [10-05, 10-06]
key-files:
  created:
    - supabase/config.toml
    - supabase/.gitignore
  modified: []
key-decisions:
  - "Both sides dumped with `supabase db dump` (privileges kept), so the pg_dump variant was not needed"
  - "Prod is missing 2026-09-13_mp_pix_constraint.sql; fix drafted in gap_fix.sql for review in 10-05, not applied"
  - "pedidos.cpf exists only in the replay (added by sprint7, absent in prod, unused by code): prod is correct, baseline keeps prod"
requirements-completed: [DEPLOY-04]
duration: ~1h50m (incl. ~40 min first Docker image pull)
completed: 2026-10-10
---

# Phase 10 Plan 04: Local Supabase, prod backup and schema diff Summary

**Local Supabase is up, an encrypted prod backup exists, and the diff shows prod is missing exactly one migration (`2026-09-13_mp_pix_constraint.sql`), which currently makes every Mercado Pago PIX payment insert violate a CHECK constraint.**

## Tasks

1. **supabase init + Local Supabase + legacy replay** (commit `dda8283`)
   - `project_id = "viapianastore"`; frontend dev port is **8080** (vite.config.ts), so `site_url = http://localhost:8080`, `additional_redirect_urls = [http://localhost:8080, http://127.0.0.1:8080]`. `[db.seed]` points at `./seed.sql` (created in 10-05). `supabase/migrations/` empty.
   - Local stack (Postgres 17.11.0.004): API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres, Studio http://127.0.0.1:54323, Mailpit http://127.0.0.1:54324.
   - Replay of `backend/schema.sql` + 18 migrations (`backups/schema/replay.log`): 10 errors, all "already exists" because schema.sql already contains later migrations' DDL — sprint3 (`produtos.imagens`), sprint6 (`pagamentos`, `pagamentos_pedido_idx`), sprint7_mercado_pago (`pagamentos.metodo`, `pagamentos_identificador_psp`), sprint7_frete (`pedidos.frete_centavos`), sprint8 (`pedidos.cpf_cnpj`), sprint10 (`audit_log`, `audit_log_created_idx`). No other errors.
   - `backups/schema/local_replay_schema.sql` (566 lines) via `supabase db dump --local --schema public`.
2. **Fernando: prod backup + schema dump** (human-action, no commit)
   - Backups: `backups/viapiana_2026-10-10_184745.dump.gpg` and `backups/viapiana_2026-10-10_185449.dump.gpg` (duplicate from a re-run), gpg symmetric, both after the 10-03 rotation. `pg_restore --list` check found all 3 TABLE DATA entries (public pedidos, public produtos, auth users).
   - `backups/schema/prod_schema.sql` (565 lines) via `supabase db dump --db-url … --schema public`.
3. **Diff + gap list** (no commit; outputs gitignored)
   - Normalized (blank, `--`, `SET`, `\restrict` lines dropped) into `prod.norm.sql` (311 lines) and `replay.norm.sql` (312 lines); `schema.diff` = 68 lines, 4 hunks.
   - Grants/revokes on tables and functions: identical between prod and replay.

## Check table (D-24)

| # | Check | Prod | Evidence |
|---|-------|------|----------|
| 1 | `pagamentos_identificador_psp` = `txid IS NOT NULL OR mp_payment_id IS NOT NULL` | **MISSING** | prod has old sprint7 CHECK: `(metodo='pix' AND txid IS NOT NULL) OR (metodo IN ('cartao','boleto') AND mp_payment_id IS NOT NULL)` |
| 2 | `pagamentos.status` default `'pending'` | **MISSING** | prod: `DEFAULT 'ATIVA'::text` |
| 3 | table `avaliacoes` | PRESENT | `CREATE TABLE IF NOT EXISTS "public"."avaliacoes"` |
| 4 | `avaliacoes.moderado_em` | PRESENT | column + `avaliacoes_pendentes_idx … WHERE moderado_em IS NULL` |
| 5 | table `webhook_events` | PRESENT | table, RLS enabled |
| 6 | `pedidos.email_cliente` (2026-07-28) | PRESENT | `"email_cliente" "text"` |
| 7 | `pedidos_user_id_idx`, `pedidos_status_created_idx` | PRESENT | both `CREATE INDEX` lines |
| 8 | `produtos_nome_unique`, `aromas_nome_unique` | PRESENT | both `CREATE UNIQUE INDEX` lines |
| 9 | RLS hardening: `*_auth_all` policies dropped | PRESENT | only `produtos_public_read` / `aromas_public_read` policies exist |
| 10 | `ajustar_estoque`, `reservar_estoque_pedido`, `repor_estoque_pedido` exist; EXECUTE not granted to anon/authenticated | PRESENT | `REVOKE ALL … FROM PUBLIC`; `GRANT ALL … TO service_role` only |
| 11 | objects only in prod | none | — (only in replay: `pedidos.cpf`, see below) |

Other diff content: column order differences in `pagamentos`, `pedidos`, `produtos` from ALTER TABLE ADD COLUMN — **ordem de colunas (ok)**. `pedidos.cpf` exists only in the replay (added by sprint7_mercado_pago, absent in prod, no code references it): prod is correct, no action.

## Impact of the gap

`payment_service.py:183` inserts PIX rows with `metodo='pix'` and `mp_payment_id` but no `txid`. Under the prod CHECK this insert fails, so **PIX checkout is broken in production until `gap_fix.sql` is applied**. Card and boleto are unaffected. The new CHECK is looser than the old one, so existing rows stay valid.

`backups/schema/gap_fix.sql` (gitignored, `BEGIN;` … `COMMIT;`): drop/re-add `pagamentos_identificador_psp` as `txid IS NOT NULL OR mp_payment_id IS NOT NULL`, set `status` default `'pending'`. Applied by Fernando in plan 10-05 after review.

## Deviations

- **Replay errors:** 10 "already exists" errors instead of the 2 the plan expected; all benign (schema.sql already contains that DDL).
- **Docker access:** the session isn't in the docker group yet; Docker commands ran through `newgrp docker` (`sg` is not installed on CachyOS).
- **Connection string:** the project ref derived from `backend/.env` `SUPABASE_URL` was rejected by the pooler ("tenant/user not found"). The dump worked with the Dashboard's Session pooler URI. Fernando should check that `backend/.env` holds current values.
- **Task 3 executed inline by the orchestrator** (the isolation guard requires worktrees for executors, and the gitignored dumps exist only in the main tree).
- First backup attempt failed (malformed URL → pg_dump fell back to the local socket) and left a 70-byte empty `.dump.gpg`, which was deleted.

## Self-Check: PASSED

- `supabase/config.toml` contains `project_id = "viapianastore"`; commit `dda8283` exists
- `backups/viapiana_*.dump.gpg`, `backups/schema/{prod_schema,local_replay_schema}.sql`, `schema.diff`, `prod.norm.sql`, `replay.norm.sql`, `gap_fix.sql` exist
- `git status --porcelain backups/` is empty
