# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

E-commerce landing page for **Carolina Viapiana**, an artisanal aroma/diffuser brand based in Ponta Grossa-PR, Brazil. The site is a single-page experience (in Brazilian Portuguese) with a product showcase and a WhatsApp order form.

## Repository Structure

```
viapianastore/
├── frontend/   # TanStack Start (SSR React) app, deployed to Cloudflare Workers
└── backend/    # FastAPI app
    ├── app/
    │   ├── api/v1/       # Route handlers (products, orders, auth, payments, categories)
    │   ├── core/         # Config, database client, security
    │   ├── models/       # Pydantic DB-entity models (what Supabase returns)
    │   ├── schemas/      # Pydantic API schemas (request/response)
    │   ├── repositories/ # Raw Supabase queries
    │   ├── services/     # Business logic (calls repositories)
    │   ├── dependencies/ # FastAPI dependency functions (e.g. auth)
    │   └── main.py       # App factory, middleware, router registration
    ├── schema.sql        # Supabase schema + seed data
    └── requiriments.txt  # Python dependencies
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

- `src/components/AtendimentoForm.tsx` — Order form. On submit, composes a pre-filled WhatsApp message and opens `wa.me/<WHATSAPP>`. The `WHATSAPP` constant at the top of that file needs to be updated with the real phone number.
- Products (`PRODUTOS`) and available scents (`AROMAS`) are hardcoded arrays in `AtendimentoForm.tsx`.

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
