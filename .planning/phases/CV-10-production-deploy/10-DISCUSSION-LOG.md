# Phase 10: Production Deploy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-10
**Phase:** 10-production-deploy
**Areas discussed:** Backend host & plan, Account ownership, Environments & data, Deploy & migrations flow, How private is 'private', Health check depth, Supabase plan

---

## Backend host & plan

| Option | Description | Selected |
|--------|-------------|----------|
| Render | DEPLOY.md written for it; Docker; health check `/`; works with fixed port 8000 | ✓ |
| Railway | Usage-based; needs Dockerfile to honor $PORT | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Starter, always-on | ~US$7/month; jobs always run; no cold starts | |
| Free now, upgrade before payments | Free for smoke tests, Starter at Phase 11 | |
| Free permanently | Sleeps after 15 min; cold starts; jobs only while awake | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Pinger every 10 min | UptimeRobot keeps it awake within 750 free hours | ✓ |
| Let it sleep | Accept cold starts | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Match Supabase region | Every request queries Supabase | ✓ |
| Closest to Brazil | Ohio/Virginia | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| When real problems appear | 750h limit, latency, 512 MB | ✓ |
| Before real payments | Upgrade at Phase 11 | |
| Never | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare Workers Free | 100k req/day | ✓ |
| Paid US$5/month | | |

**User's choice:** Render Free + UptimeRobot keep-alive, region matching Supabase, Workers Free.

---

## Account ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Carolina's, you as member | Business owns infra | |
| Yours, transfer later | Faster now; transfer redoes tokens/DNS/webhooks | ✓ |
| Yours, permanently | | |

| Option | Description | Selected |
|--------|-------------|----------|
| My account | Supabase project under Fernando | ✓ |
| Carolina's account | | |
| Not sure | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Only you | Alerts to Fernando | ✓ |
| You and Carolina | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Write handover checklist now | | |
| Handle it when it happens | | ✓ |

---

## Environments & data

| Option | Description | Selected |
|--------|-------------|----------|
| Straight to production | URL private acts as staging | ✓ (after clarification) |
| Staging stack first | Second Render/Supabase/Worker | |

**Notes:** User first answered "I dont want to get in WhatsApp, WhatsApp will be only for FAQ". Clarified: the WhatsApp order fallback must never reach customers. Options offered: (a) deploy but keep URL private until Phase 11, (b) run 10+11 back to back, (c) other. User chose **(a), straight to production**. Fallback removal deferred to Phase 12.

| Option | Description | Selected |
|--------|-------------|----------|
| Separate free dev project | Second Supabase project | |
| Keep using production | | |
| Local Supabase (Docker) | `supabase start` | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Back up, then clean test data | Keep catalog + admin role | ✓ |
| Leave as is | | |
| Wipe and reseed | | |

| Option | Description | Selected |
|--------|-------------|----------|
| In Phase 10 after Local Supabase works | | ✓ |
| Right before public launch | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Password manager | | ✓ |
| Only in Render/GitHub | | |
| Encrypted file in repo | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Against Local Supabase only | | ✓ |
| Local + in CI | | |

---

## Deploy & migrations flow

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on push after CI passes | | ✓ |
| Auto on every push | | |
| Manual only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Push trigger after first validated deploy | | ✓ |
| Keep manual | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase CLI migrations | `supabase db push`, tracked | ✓ |
| Keep manual SQL editor | | |
| Auto-apply from CI | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Compare schema dump vs files | | ✓ |
| Trust the notes | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Platform rollback buttons | Render Rollback + wrangler rollback | ✓ |
| Git revert only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Small script + manual UI pass | | ✓ |
| Manual checklist only | | |
| Automated browser test | | |

---

## How private is 'private'

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare Access gate | Free, email PIN | ✓ |
| Obscurity + noindex | | |
| Obscurity only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Only you | | ✓ |
| You and Carolina | | |

---

## Health check depth

| Option | Description | Selected |
|--------|-------------|----------|
| New /health/db endpoint | One light Supabase query | ✓ |
| Keep GET / only | | |
| Two monitors | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Wait until Access gate is removed | | ✓ |
| Yes, now | | |

---

## Supabase plan

| Option | Description | Selected |
|--------|-------------|----------|
| Free | No auto backups; /health/db prevents pausing | ✓ |
| Pro (~US$25/month) | | |
| Free now, Pro at launch | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Document limits in DEPLOY.md | | ✓ |
| No | | |

---

## Claude's Discretion

- Render service details, uvicorn proxy headers
- `/health/db` query and rate limit
- Exact cleanup SQL (review with user before deleting)
- Rotating the pooler password now vs Phase 16
- Backend stays publicly reachable; CORS limited to workers.dev origin

## Deferred Ideas

- Remove WhatsApp order/payment fallback; `/atendimento` → FAQ/contact — Phase 12
- Remove Access gate + frontend monitor — end of Phase 11 / Phase 16
- Account handover to Carolina — when it happens
- Integration tests in CI — not now
