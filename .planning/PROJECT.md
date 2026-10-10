# Carolina Viapiana — Loja Online

## What This Is

E-commerce site for **Carolina Viapiana**, an artisanal aroma/diffuser brand in
Ponta Grossa-PR. Customers browse the catalog, buy online (PIX, card, boleto via
Mercado Pago) with shipping quotes from Melhor Envio, and track their orders;
the owner manages products, stock, orders and roles in an admin panel. The site
is in Brazilian Portuguese and ships to all of Brazil.

## Core Value

A customer can find a product, pay for it online, and receive it — and Carolina
can see and fulfil that order in the admin. If everything else fails, the
catalog → checkout → payment → admin order path must work.

## Requirements

### Validated

<!-- Built and working in code (milestone v1.0). Not yet validated in production. -->

- ✓ Catalog from the API (products, sizes, prices, scents, categories, search) — v1.0
- ✓ Product detail pages with photo galleries; admin photo upload — v1.0
- ✓ Cart (logged-in) and direct "Comprar agora" checkout (guest allowed) — v1.0
- ✓ Checkout with address, CEP auto-fill, CPF/CNPJ validation — v1.0
- ✓ Payments through Mercado Pago: PIX, card (Bricks), boleto; webhooks + fallback poll — v1.0
- ✓ WhatsApp fallback when no payment provider is configured — v1.0
- ✓ Shipping quote (Melhor Envio) with free shipping ≥ R$ 300 — v1.0
- ✓ Customer accounts: signup, login, password reset, profile/avatar, "Meus pedidos", tracking page — v1.0
- ✓ Admin: products CRUD, stock, orders with status flow and metrics, roles, audit log — v1.0
- ✓ Product reviews with moderation — v1.0
- ✓ Hardening: RBAC, RLS, rate limiting, CSP/security headers, upload validation, LGPD masking and self-deletion, order expiry — v1.0

### Active

<!-- Milestone v1.1 — Launch. See REQUIREMENTS.md for IDs. -->

- [ ] Site and API running in production
- [ ] Real payments working end to end
- [ ] Legal pages and seller identification required for Brazilian online stores
- [ ] Shipping and transactional email active
- [ ] Custom domain carolinaviapiana.com.br live
- [ ] QA, SEO and accessibility pass
- [ ] Backups, monitoring and operational routines in place

### Out of Scope

- Sicredi PIX direct integration — replaced by Mercado Pago PIX on 2026-09-13 (single PSP, no mTLS certs)
- Native mobile app — web is enough for the brand's volume
- Marketplace / multi-seller — single brand store

## Context

- **Frontend:** TanStack Start (SSR React 19), TanStack Router/Query, Tailwind v4, shadcn/ui, deployed to Cloudflare Workers (worker name `viapianastore`). Package manager `bun`.
- **Backend:** FastAPI (Python 3.14) on Supabase (Postgres + Auth + Storage), Docker image, target host Render or Railway. Package manager `uv`.
- **Integrations:** Mercado Pago (PIX/card/boleto), Melhor Envio (quotes), Brevo (email).
- **History:** Built in sprints tracked in `PENDENCIAS.txt` (Sprints 1–10, Jul–Sep 2026). Go-live runbook in `docs/DEPLOY.md`. Security log in `VULNERABILIDADES.txt`; code audit in `docs/issues.md`.
- **State on 2026-10-10:** code complete; nothing deployed yet (deploy workflow never run, no GitHub secrets/variables). Domain registered 2026-09-16 but DNS not configured.

## Constraints

- **Design**: strict black-and-white `oklch` palette, Cormorant Garamond + Inter, near-flat radius — see CLAUDE.md
- **Tech stack**: do not edit `routeTree.gen.ts` or `components/ui/*`; do not re-add Vite plugins
- **Legal**: Brazilian consumer law (CDC, Decreto 7.962/2013) and LGPD apply — seller ID, policies, 7-day withdrawal
- **Fiscal**: NF-e needs Carolina's e-CNPJ A1 certificate and Inscrição Estadual
- **Budget**: small business — prefer free/cheap tiers (Cloudflare, Render/Railway, UptimeRobot)
- **Git**: commits without Co-Authored-By trailers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TanStack Start + Cloudflare Workers instead of Next.js/Vercel | Diverged from original PDF; see STACK.md | ✓ Good |
| Supabase client instead of SQLModel/Alembic | Simpler; dated SQL migrations in `backend/migrations/` | ✓ Good |
| All payments via Mercado Pago (incl. PIX) | One PSP, no Sicredi mTLS certs needed at launch | — Pending (needs prod test) |
| Everything degrades cleanly without credentials | Can go live in stages without frontend redeploys | ✓ Good |
| Webhook signature required by default (fail-closed) | Security audit Issue 3 | ✓ Good |
| JWT in localStorage until custom domain exists | HttpOnly cookie only safe with shared registrable domain | ⚠️ Revisit in Phase 14 |
| Domain `carolinaviapiana.com.br` | Registered 2026-09-16 at Registro.br | — Pending DNS |

---
*Last updated: 2026-10-10 after GSD bootstrap from PENDENCIAS.txt and launch scan*
