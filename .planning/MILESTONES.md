# Project Milestones: Carolina Viapiana — Loja Online

## v1.0 Code-Complete Store (Completed: 2026-10-10)

**Delivered:** A full e-commerce codebase — catalog, cart, checkout, Mercado Pago payments, shipping quotes, customer accounts and admin — ready to deploy.

**Phases completed:** 1-9 (built as Sprints 1–10 before GSD; no PLAN/SUMMARY files)

**Key accomplishments:**
- Catalog, product pages, photo upload, search and categories served from the FastAPI + Supabase backend
- Checkout with address, CEP auto-fill, CPF/CNPJ, guest purchase and WhatsApp fallback
- PIX, card and boleto through Mercado Pago with signed, deduplicated webhooks and a fallback poll
- Admin: products, stock, orders with status flow and metrics, roles, audit log, review moderation
- Security and LGPD hardening: RBAC, RLS, rate limits, CSP, upload validation, data masking and self-deletion

**Stats:**
- 92 commits, 2026-05-10 → 2026-10-10
- 18 dated SQL migrations; 71 backend unit tests

**Git range:** first commit → `d59fa6b`

**What's next:** v1.1 Launch — deploy, real payments, legal pages, domain, QA, operations.

---
