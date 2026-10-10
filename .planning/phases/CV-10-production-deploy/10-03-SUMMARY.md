---
phase: 10-production-deploy
plan: 03
subsystem: infra
tags: [deploy, toolchain, supabase, docker, secrets]
requires: []
provides:
  - "Working toolchain: Docker + Compose, pg_dump/psql 18.6, Supabase CLI 2.120.0 via bunx, gpg, gh"
  - "Rotated Supabase DB/pooler password (D-30); production Supabase values in KeePassXC (D-15)"
affects: [10-04, 10-05, 10-06, 10-07]
key-files:
  modified: []
decisions:
  - "Password manager is KeePassXC (local .kdbx); entry 'Viapiana — Supabase' holds DB password, session pooler URL, project ref, SUPABASE_URL, SUPABASE_KEY (service_role)"
  - "Region confirmed sa-east-1, so Render uses Virginia (D-28)"
metrics:
  completed: 2026-10-10
---

# Phase 10 Plan 03: Toolchain and credentials Summary

Dev machine is ready for Local Supabase, backups and the CLI baseline; the Supabase DB password was rotated and the production Supabase values are stored in KeePassXC.

## Tasks

1. **CLI legitimacy gate:** Fernando checked npmjs.com/package/supabase (repo github.com/supabase/cli, v2.120.0) and approved.
2. **Human actions:** `docker-compose` and `docker-buildx` installed, `jon` added to the `docker` group, region sa-east-1 confirmed, DB password rotated, new pooler URL + project ref + URL + service_role key saved in KeePassXC.
3. **Toolchain check (versions):**
   - Docker: `hello-world` OK (via `newgrp docker`; see deviations)
   - Docker Compose 5.6.0
   - pg_dump / psql (PostgreSQL) 18.6
   - Supabase CLI 2.120.0 (`bunx supabase@2.120.0`)
   - gpg (GnuPG) 2.4.9
   - gh: logged in as FernandoJohansen

## Deviations from Plan

- **`backend/.env` does not exist on this machine** (not in the repo, gitignored, no other `.env` under `~/projeto`; no GitHub Actions secrets). There was nothing to copy into the password manager. Supabase values were taken from the dashboard. Mercado Pago and Melhor Envio secrets (and a fresh `PAYMENT_TOKEN_SECRET`) still need to be fetched from their dashboards before Render setup in 10-07. Plan 10-05 must create `backend/.env` from `.env.example` instead of editing an existing file.
- **Postgres server major version was not reported** as a number. `pg_dump` 18.6 is newer than any Supabase-hosted major (15/17), so the `>=` requirement holds; 10-04 should still note the server version from `pg_dump`'s output header.
- **Docker group not active in the current session:** `jon` is in `/etc/group` for `docker`, but sessions started before the change need a log out/in (or Claude Code restart) to use `docker` directly. Verified with `newgrp docker`.

## Verification

`docker run --rm hello-world` (via newgrp), `pg_dump --version`, `bunx supabase@2.120.0 --version` = 2.120.0, `gh auth status` all succeed. No secret values were read or recorded.

## Self-Check: PASSED
