# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

E-commerce landing page for **Carolina Viapiana**, an artisanal aroma/diffuser brand based in Ponta Grossa-PR, Brazil. The site is a single-page experience (in Brazilian Portuguese) with a product showcase and a WhatsApp order form.

## Repository Structure

```
Ecommerce/
├── frontend/                        # TanStack Start (SSR React), Cloudflare Workers
│   ├── src/
│   │   ├── assets/                  # Static images (logo, products)
│   │   ├── components/
│   │   │   ├── AtendimentoForm.tsx  # Homepage order section
│   │   │   ├── CompraProduto.tsx    # Shared purchase controls
│   │   │   ├── Reveal.tsx           # Scroll animation wrapper
│   │   │   ├── pagamento/           # Boleto, cartão, PIX views
│   │   │   └── ui/                  # shadcn/ui components (do not modify directly)
│   │   ├── hooks/
│   │   ├── lib/                     # api.ts, auth.ts, checkout.ts, utils, etc.
│   │   ├── routes/                  # File-based routes (see Routing section)
│   │   ├── styles.css               # Tailwind tokens + design system
│   │   ├── routeTree.gen.ts         # Auto-generated — never edit manually
│   │   ├── router.tsx
│   │   ├── server.ts
│   │   └── start.ts
│   ├── vite.config.ts
│   ├── wrangler.jsonc
│   └── package.json
├── backend/                         # FastAPI app
│   ├── app/
│   │   ├── api/v1/                  # Route handlers: products, orders, auth, payments,
│   │   │                            #   categories, cart, frete, audit, users
│   │   ├── core/                    # Config, database, security, rate limit, LGPD,
│   │   │                            #   image upload, payment token, roles
│   │   ├── models/                  # Pydantic DB-entity models (what Supabase returns)
│   │   ├── schemas/                 # Pydantic API schemas (request/response)
│   │   ├── repositories/            # Raw Supabase queries
│   │   ├── services/                # Business logic; clients: MercadoPago, MelhorEnvio
│   │   ├── dependencies/            # FastAPI dependency functions (e.g. auth)
│   │   └── main.py                  # App factory, middleware, router registration
│   ├── migrations/                  # Dated SQL migration files
│   ├── scripts/                     # Admin helper scripts (e.g. conceder_admin.py)
│   ├── certs/                       # TLS certs (legacy, gitignored)
│   ├── schema.sql                   # Supabase schema + seed data
│   ├── Dockerfile
│   └── requiriments.txt             # Python dependencies (note the typo)
├── docs/
│   ├── agents/                      # Agent instructions (issue-tracker, triage, domain)
│   ├── research/                    # Research docs (MelhorEnvio, MercadoPago, Sicredi, NFe)
│   └── DEPLOY.md
├── scripts/                         # Repo-level scripts (backup_db.sh)
├── backups/                         # DB dumps
├── .github/workflows/               # CI and deploy workflows
├── docker-compose.yml
└── CLAUDE.md
```

## Frontend

**Stack:** TanStack Start (SSR) · TanStack Router (file-based) · TanStack Query · React 19 · Tailwind CSS v4 · shadcn/ui · Cloudflare Workers

**Package manager:** `bun`

### Commands (run from `frontend/`)

```bash
bun dev          # Start dev server
bun build        # Production build (Cloudflare Workers target)
bun lint         # ESLint
bun format       # Prettier
```

### Routing

Routes live in `src/routes/`. TanStack Router generates `src/routeTree.gen.ts` automatically — **never edit that file manually**. The root layout is `src/routes/__root.tsx`; the homepage is `src/routes/index.tsx`.

### Vite config

`vite.config.ts` loads plugins manually: Tailwind CSS, tsconfig paths, TanStack Start, Vite React, and (build-only) the Cloudflare plugin. **Do not add those plugins a second time** or the build will break with duplicate plugin errors.

### Design system

- **Fonts:** Cormorant Garamond (serif headings via `.serif` utility) + Inter (body)
- **Colors:** Strict black-and-white palette using `oklch`; semantic tokens defined in `src/styles.css`. New colors must use `oklch` format and be registered in both `:root` and `.dark` blocks, then mapped in `@theme inline`.
- **Radius:** Near-flat (`0.125rem`) — keep UI elements sharp/square.
- **UI components:** shadcn/ui components are in `src/components/ui/` and should not be modified directly; extend via wrappers.

### Key business logic

- Products and scents come from the API (`GET /api/produtos`, `GET /api/aromas`) — nothing is hardcoded in the frontend anymore.
- `src/components/AtendimentoForm.tsx` — Homepage order section; renders the catalog with the shared `CompraProduto` purchase controls.
- Routes: `index`, `produto.$slug`, `carrinho`, `checkout`, `pagamento.$pedidoId`, `pedidos`, `rastreio.$pedidoId`, `perfil`, `login`, `cadastro`, `esqueci-senha`, `redefinir-senha`, `admin`
- Full checkout flow (address, shipping quote, PIX/card/boleto) in `checkout.tsx` → `pagamento.$pedidoId.tsx`. Without payment credentials configured, orders fall back to WhatsApp.

## Backend

**Stack:** FastAPI · uvicorn · Supabase · Python 3.14

**Package manager:** `uv`

### Commands (run from `backend/`)

```bash
uv run uvicorn app.main:app --reload   # Start dev server (port 8000)
```

Dependencies are in `requiriments.txt` (note the typo in the filename). Install with:

```bash
uv pip install -r requiriments.txt
```

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`FernandoJohansen/Ecommerce`), operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
