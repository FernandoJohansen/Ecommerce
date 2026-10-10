---
phase: 10-production-deploy
plan: 01
subsystem: backend-health-smoke
tags: [health, smoke, fastapi, deploy]
requires: []
provides:
  - "GET /health/db (rate limited 30/min, generic 503)"
  - "scripts/smoke.sh post-deploy smoke script"
affects: [10-09]
key-files:
  created:
    - backend/tests/test_health.py
    - scripts/smoke.sh
  modified:
    - backend/app/main.py
decisions:
  - "30/minute rate limit on /health/db (UptimeRobot at 5 min only needs 0.2/min)"
metrics:
  tasks: 2
  completed: 2026-10-10
requirements: [DEPLOY-01, DEPLOY-03]
---

# Phase 10 Plan 01: Health endpoint and smoke script Summary

`GET /health/db` (single `aromas` read, constant `{"status":"ok"}` or generic 503, 30/minute slowapi limit) plus `scripts/smoke.sh` covering API, CORS and site headers or the Cloudflare Access gate.

## Tasks

| Task | Commits |
|------|---------|
| 1 (TDD) /health/db | e753032 (RED), 60f6880 (GREEN) |
| 2 smoke.sh | see git log (`feat(10-01): add post-deploy smoke script`) |

## Verification

- `pytest tests/`: 76 passed, 14 skipped (5 new health tests); `ruff check app` clean; Dockerfile untouched (no forwarded-allow-ips).
- smoke.sh: `bash -n` OK, no args exits 2 with `Uso:`, unreachable API exits 1 with FAIL lines. shellcheck not installed. Not run against a live deployment (none exists yet).

## Deviations from Plan

- Worktree base was reset to the expected commit 1ce8d75 at startup (per the worktree check).
- Tests were run with the main checkout's venv (`/home/jon/projeto/Ecommerce/backend/.venv/bin/python -m pytest`) since the worktree has no venv; behavior is equivalent.

## Known Stubs

None.

## Self-Check: PASSED
