# Roadmap: Carolina Viapiana — Loja Online

## Overview

The store was built in sprints (Jul–Sep 2026, tracked in `PENDENCIAS.txt`) and is
code complete as milestone v1.0. Milestone v1.1 takes it live: production deploy,
real payments, legal compliance, shipping/email, the custom domain, a QA pass and
operational routines. v2.0 adds fiscal invoices and fulfilment automation after launch.

## Milestones

- ✅ **v1.0 Code-Complete Store** - Phases 1-9 (completed 2026-10-10, pre-GSD sprints 1–10)
- 🚧 **v1.1 Launch** - Phases 10-16 (in progress)
- 📋 **v2.0 Post-Launch** - Phases 17-19 (planned)

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

<details>
<summary>✅ v1.0 Code-Complete Store (Phases 1-9) - COMPLETED 2026-10-10</summary>

Built before GSD was adopted; details in `PENDENCIAS.txt` and git history. No PLAN/SUMMARY files exist for these phases.

- [x] **Phase 1: Infrastructure & Setup** - Docker Compose, CI, env hygiene, README (Sprint 1)
- [x] **Phase 2: Database & UI Foundation** - Supabase schema, design system, admin shell, RBAC (Sprint 2)
- [x] **Phase 3: Product System** - Catalog from API, product pages, image upload, search, categories (Sprint 3)
- [x] **Phase 4: Cart & Admin CMS** - Cart, stock, product CRUD with per-size prices (Sprint 4)
- [x] **Phase 5: Checkout** - Prices, order items, address form, guest checkout, CPF/CNPJ (Sprints 5, 8)
- [x] **Phase 6: Payments** - Mercado Pago PIX/card/boleto, webhooks, idempotency, fallback poll (Sprints 6, 6b; Sicredi dropped 2026-09-13)
- [x] **Phase 7: Shipping Quotes & Tracking** - Melhor Envio quotes, free shipping, tracking page (Sprint 7)
- [x] **Phase 8: Order Management** - Admin orders + metrics, status flow, "Meus pedidos", reviews (Sprint 9)
- [x] **Phase 9: Operational Hardening** - Audit log, retries, rate limiting, CSP, LGPD masking/deletion, backups script, code-audit fixes, CI fix (Sprint 10)

</details>

### 🚧 v1.1 Launch (In Progress)

**Milestone Goal:** The store is live at carolinaviapiana.com.br taking real orders and payments, legally compliant, monitored and backed up.

- [ ] **Phase 10: Production Deploy** - Backend and frontend running in production on default URLs
- [ ] **Phase 11: Payments Go-Live** - Mercado Pago production credentials and real end-to-end payments
- [ ] **Phase 12: Legal & Trust Pages** - Seller ID, policies, consent and WhatsApp contact
- [ ] **Phase 13: Shipping & Email Activation** - Melhor Envio quotes and Brevo transactional email live
- [ ] **Phase 14: Custom Domain & Auth Cookie** - carolinaviapiana.com.br + api subdomain, HttpOnly auth cookie
- [ ] **Phase 15: QA, SEO & Polish** - Responsive, performance, SEO, accessibility, analytics
- [ ] **Phase 16: Operations Readiness** - Backups, monitoring, secrets rotation, stock, LGPD retention

## Phase Details

### Phase 10: Production Deploy

**Goal**: Backend and frontend run in production on their default URLs (Render/Railway + workers.dev) with the WhatsApp fallback flow working
**Depends on**: Phase 9
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05
**Success Criteria** (what must be TRUE):

  1. `curl https://<backend>/` returns `{"status":"ok"}` and `/api/produtos` returns the catalog
  2. The workers.dev site loads the catalog, login works, and checkout ends in the WhatsApp message
  3. CI is green on `main` and the frontend deploys automatically on push
  4. Production DB has every migration in `backend/migrations/` applied

**Plans**: 10 plans
Plans:
**Wave 1**

- [ ] 10-01-PLAN.md — `GET /health/db` + unit tests; reusable `scripts/smoke.sh`
- [ ] 10-02-PLAN.md — `docs/DEPLOY.md` runbook: Render/Access/UptimeRobot steps, limits table, rollback, Supabase CLI flow
- [ ] 10-03-PLAN.md — Verify Supabase CLI package, install Docker/pg tools, rotate DB password, secrets to password manager

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 10-04-PLAN.md — Local Supabase, encrypted prod backup, prod schema dump vs legacy replay diff
- [ ] 10-07-PLAN.md — Push + green CI; Render service (Virginia, Free, After CI) with prod env; API smoke

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 10-05-PLAN.md — Close prod gaps, baseline migration + seed, archive legacy migrations, local `.env` + integration tests
- [ ] 10-08-PLAN.md — First manual frontend deploy, Cloudflare Access gate, manual UI pass
- [ ] 10-09-PLAN.md — XFF rate-limit verification behind Render; UptimeRobot 5-min monitor on `/health/db`

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 10-06-PLAN.md — [BLOCKING] Mark baseline applied on prod; restore-tested backup; transactional test-data cleanup

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 10-10-PLAN.md — CI-gated `workflow_run` frontend auto-deploy; final push and smoke

**Runbook**: `docs/DEPLOY.md` Phases 1–2

### Phase 11: Payments Go-Live

**Goal**: Customers pay online with PIX, card or boleto and the order turns `pago` automatically
**Depends on**: Phase 10
**Requirements**: PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):

  1. A real PIX purchase (Varetas, R$ 8,00) shows a QR code and flips the order to `pago`
  2. A real card purchase and a boleto are created and reconciled
  3. Webhook calls without a valid signature are rejected; valid ones are processed once
  4. Unpaid `novo` orders expire after 24h and return stock

**Plans**: TBD
**Runbook**: `docs/DEPLOY.md` Phase 3

### Phase 12: Legal & Trust Pages

**Goal**: The store meets Brazilian e-commerce disclosure rules and customers can reach the seller
**Depends on**: Phase 10
**Requirements**: LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05, LEGAL-06
**Success Criteria** (what must be TRUE):

  1. Footer on every page shows legal name, CNPJ/CPF, email and phone
  2. Privacy, terms and exchanges/returns pages exist and are linked from the footer
  3. Signup and checkout reference the policies before submission
  4. "WhatsApp" mentions open a working `wa.me` chat with the store

**Plans**: TBD
**Needs from Carolina**: legal name, CNPJ, contact email/phone, WhatsApp number, returns policy terms

### Phase 13: Shipping & Email Activation

**Goal**: Checkout charges real shipping and customers receive transactional emails
**Depends on**: Phase 11
**Requirements**: SHIP-01, MAIL-01
**Success Criteria** (what must be TRUE):

  1. Checkout with a CEP from another state shows Melhor Envio options; orders ≥ R$ 300 show a free option
  2. Placing and paying an order sends emails that land in the inbox (not spam)

**Plans**: TBD
**Runbook**: `docs/DEPLOY.md` Phase 4

### Phase 14: Custom Domain & Auth Cookie

**Goal**: The store is served from carolinaviapiana.com.br and auth tokens are no longer readable by JavaScript
**Depends on**: Phase 11
**Requirements**: DOM-01, DOM-02, DOM-03
**Success Criteria** (what must be TRUE):

  1. `https://carolinaviapiana.com.br` and `www` load the site with a valid certificate
  2. `https://api.carolinaviapiana.com.br/` returns `{"status":"ok"}` and the site uses it
  3. Mercado Pago webhooks arrive at the new API URL
  4. After login, no JWT is present in localStorage; session works via HttpOnly cookie

**Plans**: TBD
**Runbook**: `docs/DEPLOY.md` Phase 5; `VULNERABILIDADES.txt` item 7

### Phase 15: QA, SEO & Polish

**Goal**: The site works well on every device, is findable by search engines and shareable on social media
**Depends on**: Phase 14
**Requirements**: QA-01, QA-02, QA-03, QA-04, QA-05
**Success Criteria** (what must be TRUE):

  1. Every route renders without horizontal scroll on a 360px phone
  2. `/robots.txt` and `/sitemap.xml` are served; shared links show a preview image
  3. Lighthouse accessibility ≥ 90 and LCP < 2.5s on the home page (mobile)
  4. Page views are recorded in the analytics dashboard

**Plans**: TBD

### Phase 16: Operations Readiness

**Goal**: The store can be operated and recovered safely after launch
**Depends on**: Phase 10
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06
**Success Criteria** (what must be TRUE):

  1. A backup runs daily and one dump has been restored into a test project
  2. An uptime alert fires when the backend or site is down
  3. Supabase pooler password is new; new accounts must confirm email
  4. Admin stock matches physical stock
  5. Retention policy and refund procedure are written down

**Plans**: TBD
**Runbook**: `docs/DEPLOY.md` Phase 6

### 📋 v2.0 Post-Launch (Planned)

**Milestone Goal:** Fiscal compliance and less manual fulfilment work.

- [ ] **Phase 17: NF-e Issuance** - Focus NFe integration, DANFE/XML storage (NFE-01, NFE-02)
- [ ] **Phase 18: Fulfilment Automation** - Melhor Envio labels, tracking events, status notifications (FUL-01..03)
- [ ] **Phase 19: Platform Scaling** - Redis rate limits, refund automation, payment logging (PLAT-01..03)

## Progress

**Execution Order:**
10 → 11 → 12 → 13 → 14 → 15 → 16 (12 and 16 can start right after 10)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infrastructure & Setup | v1.0 | pre-GSD | Complete | 2026-07-10 |
| 2. Database & UI Foundation | v1.0 | pre-GSD | Complete | 2026-07-10 |
| 3. Product System | v1.0 | pre-GSD | Complete | 2026-07-14 |
| 4. Cart & Admin CMS | v1.0 | pre-GSD | Complete | 2026-07-14 |
| 5. Checkout | v1.0 | pre-GSD | Complete | 2026-07-15 |
| 6. Payments | v1.0 | pre-GSD | Complete | 2026-09-13 |
| 7. Shipping Quotes & Tracking | v1.0 | pre-GSD | Complete | 2026-07-18 |
| 8. Order Management | v1.0 | pre-GSD | Complete | 2026-08-16 |
| 9. Operational Hardening | v1.0 | pre-GSD | Complete | 2026-10-10 |
| 10. Production Deploy | v1.1 | 0/TBD | Not started | - |
| 11. Payments Go-Live | v1.1 | 0/TBD | Not started | - |
| 12. Legal & Trust Pages | v1.1 | 0/TBD | Not started | - |
| 13. Shipping & Email Activation | v1.1 | 0/TBD | Not started | - |
| 14. Custom Domain & Auth Cookie | v1.1 | 0/TBD | Not started | - |
| 15. QA, SEO & Polish | v1.1 | 0/TBD | Not started | - |
| 16. Operations Readiness | v1.1 | 0/TBD | Not started | - |
| 17. NF-e Issuance | v2.0 | 0/TBD | Not started | - |
| 18. Fulfilment Automation | v2.0 | 0/TBD | Not started | - |
| 19. Platform Scaling | v2.0 | 0/TBD | Not started | - |
