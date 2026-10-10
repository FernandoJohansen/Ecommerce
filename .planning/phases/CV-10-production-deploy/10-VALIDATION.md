---
phase: 10
slug: production-deploy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-10
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.4.1 + pytest-asyncio (backend); ESLint + build (frontend) |
| **Config file** | `backend/tests/conftest.py`, `backend/tests/integration/conftest.py` |
| **Quick run command** | `cd backend && uv run pytest tests/ -q && uv run ruff check app` |
| **Full suite command** | CI equivalent (ruff + compileall + pytest + docker build) + `cd frontend && bun run lint && bun run build`; integration: `cd backend && uv run pytest tests/integration -v` against Local Supabase |
| **Estimated runtime** | ~60 seconds (quick), ~5 min (full) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** `scripts/smoke.sh` green on prod + manual UI pass + `supabase migration list` clean
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-T1 | 10-01 | 1 | DEPLOY-01 | T-10-01..03 | `/health/db` returns no data, generic 503 on failure, rate limited | unit | `cd backend && uv run pytest tests/test_health.py -q` | ❌ W0 (created in task) | ⬜ pending |
| 10-01-T2 | 10-01 | 1 | DEPLOY-01 | T-10-05 | N/A | script | `bash -n scripts/smoke.sh && (scripts/smoke.sh; test $? -eq 2)` | ❌ W0 (created in task) | ⬜ pending |
| 10-05-T3 | 10-05 | 3 | DEPLOY-04 (D-11/D-12) | T-10-17 | local dev never touches prod | integration | `cd backend && uv run pytest tests/integration -v` (Local Supabase) | ✅ | ⬜ pending |
| 10-06-T1 | 10-06 | 4 | DEPLOY-04 | T-10-20 | N/A | CLI | `supabase migration list` (20261010000000 Local+Remote) + `supabase db push` nothing to push | manual | ⬜ pending |
| 10-07-T2 | 10-07 | 2 | DEPLOY-05 | T-10-25 | N/A | CI | `gh run list --workflow CI --branch main -L1` = success | manual | ⬜ pending |
| 10-07-T3 | 10-07 | 2 | DEPLOY-01, DEPLOY-03 | T-10-26, T-10-27 | CORS rejects foreign origins; docs 404 | smoke | `scripts/smoke.sh https://<api>` | ✅ after 10-01 | ⬜ pending |
| 10-08-T2 | 10-08 | 3 | DEPLOY-02 | T-10-35 | `VITE_API_URL` guard; CSP connect-src = API | manual dispatch | `gh workflow run "Deploy Frontend" && gh run watch` + `scripts/smoke.sh <api> <site>` | ✅ | ⬜ pending |
| 10-08-T3 | 10-08 | 3 | DEPLOY-02 (D-16) | T-10-31, T-10-32 | site gated by Access | smoke + manual | `curl -sI <site>/` -> location cloudflareaccess.com | ✅ | ⬜ pending |
| 10-09-T1 | 10-09 | 3 | DEPLOY-03 | T-10-36 | spoofed XFF ignored | live | 31x `curl -H "X-Forwarded-For: ..." <api>/health/db` -> last 429 | ✅ | ⬜ pending |
| 10-10-T1 | 10-10 | 5 | DEPLOY-05 | T-10-40, T-10-41 | deploy only after CI success on push to main | yaml assert | `uv run --no-project --with pyyaml python -c ...` (see plan) | ✅ | ⬜ pending |
| 10-10-T3 | 10-10 | 5 | DEPLOY-05 | T-10-41 | auto deploy after CI | CI | `gh run list --workflow "Deploy Frontend" -L1` event=workflow_run, success | manual | ⬜ pending |

*Planner fills exact Task IDs. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_health.py` — covers `/health/db` (ok, DB failure → 503, no data leaked)
- [ ] `scripts/smoke.sh` — `/`, `/health/db`, `/api/produtos`, CORS, site headers
- [ ] Docker + Supabase CLI + Postgres client tools installed (human)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UI pass: catalog, login, cart, checkout ends in WhatsApp message | DEPLOY-02 | Behind Cloudflare Access (email PIN) | Log in through Access, walk the flow, watch for Worker error 1102 |
| Render service + env vars set | DEPLOY-01/03 | Dashboard-only | Check Render env against `docs/DEPLOY.md` table |
| Rate-limit IP correctness behind Render | DEPLOY-03 | Requires real proxy chain | Compare logged client IP with a known public IP |
| Cloudflare Access gate | D-16 | Dashboard + email | Incognito visit shows Access login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
