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
| 10-xx | TBD | TBD | DEPLOY-01 | — | `/health/db` returns no data, generic 503 on failure, rate limited | unit | `cd backend && uv run pytest tests/test_health.py -q` | ❌ W0 | ⬜ pending |
| 10-xx | TBD | TBD | DEPLOY-01 | — | N/A | smoke | `scripts/smoke.sh https://<api>` | ❌ W0 | ⬜ pending |
| 10-xx | TBD | TBD | DEPLOY-02 | — | `VITE_API_URL` guard fails fast | manual dispatch | `gh workflow run "Deploy Frontend" && gh run watch` | manual | ⬜ pending |
| 10-xx | TBD | TBD | DEPLOY-03 | — | CORS rejects foreign origins; rate-limit key is client IP | smoke | `curl -sI -H "Origin: https://evil.example" $API/api/produtos` (no ACAO) | ❌ W0 | ⬜ pending |
| 10-xx | TBD | TBD | DEPLOY-04 | — | N/A | CLI | `supabase migration list` (all Local+Remote) | manual | ⬜ pending |
| 10-xx | TBD | TBD | DEPLOY-05 | — | Deploy only after CI success on main | CI | `gh run list --workflow CI --branch main -L1` | manual | ⬜ pending |

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
