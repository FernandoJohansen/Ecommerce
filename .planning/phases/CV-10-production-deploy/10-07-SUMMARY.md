---
phase: 10-production-deploy
plan: 07
subsystem: infra
tags: [deploy, render, ci, cors]
requires: [10-01, 10-02, 10-03]
provides:
  - "Backend live on Render: https://ecommerce-vdmm.onrender.com (Docker, Free, Virginia)"
  - "workers.dev subdomain confirmed: paradoxxnoob -> site will be https://viapianastore.paradoxxnoob.workers.dev"
affects: [10-08, 10-09]
key-files:
  modified: []
decisions:
  - "Render service name is ecommerce-vdmm (not viapianastore-api); URL https://ecommerce-vdmm.onrender.com is VITE_API_URL for 10-08"
  - "ALLOWED_ORIGINS = FRONTEND_URL = https://viapianastore.paradoxxnoob.workers.dev (custom domain carolinaviapiana.com.br waits for Phase 14)"
metrics:
  completed: 2026-10-11
---

# Phase 10 Plan 07: Push, CI and Render backend Summary

Phase 10 code is on `main` with CI green, and the backend runs on Render over HTTPS with the production env; the smoke test passes.

## Tasks

1. **Push gate:** Fernando approved the push (previous session).
2. **Push + CI:** `git push origin main` (33f7836..a65ccc8); CI run 38083817719 green (frontend + backend).
3. **Render service:** created by Fernando at `https://ecommerce-vdmm.onrender.com`. Fernando confirmed region Virginia, plan Free, health check `/`, Auto-Deploy After CI Checks Pass, `PORT=8000`. Env: `ENVIRONMENT=production`, `ALLOWED_ORIGINS`/`FRONTEND_URL` = `https://viapianastore.paradoxxnoob.workers.dev`, `RATE_LIMIT_TRUSTED_PROXY_HOPS=1`, `SUPABASE_URL`, `SUPABASE_KEY`, `PAYMENT_TOKEN_SECRET`. The workers.dev subdomain was read via the Cloudflare MCP (account "Paradoxxnoob@gmail.com's Account").

## Verification

```
$ scripts/smoke.sh https://ecommerce-vdmm.onrender.com
OK: GET / responde status ok
OK: GET /health/db responde status ok
OK: GET /api/produtos retorna lista não vazia
OK: API envia x-content-type-options
OK: API envia strict-transport-security
OK: CORS nega origem desconhecida
smoke OK
$ curl -s -o /dev/null -w '%{http_code}' https://ecommerce-vdmm.onrender.com/docs
404
```

## Deviations from Plan

- **`SUPABASE_URL` misconfigured twice before passing.** First it held the Supabase dashboard address: `/api/produtos` returned a JSON string with a Next.js HTML page, while `/health/db` still said ok. Then the DB calls failed (503) until Fernando corrected the URL/key. Third run passed.
- **Follow-up (for 10-09):** `/health/db` only checks that `.execute()` does not raise. A wrong `SUPABASE_URL` that answers with HTML still reports ok, so UptimeRobot on `/health/db` would miss it. The health check should confirm the response data is a list.
- **`PAYMENT_TOKEN_SECRET` was pasted into the chat** (against T-10-28). Saved at `~/viapiana-render-secret.txt` (mode 600) at Fernando's request; recommended rotating it and keeping it in KeePassXC before Phase 11.
- **Old Workers on the Cloudflare account:** `carolinaviapiana` and `ecommerce` exist from earlier tests and may be public. Left untouched; Fernando to decide on deletion.

## Self-Check: PASSED
