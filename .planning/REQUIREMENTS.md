# Requirements: Carolina Viapiana — Loja Online

**Defined:** 2026-10-10
**Core Value:** A customer can find a product, pay for it online, and receive it — and Carolina can see and fulfil that order in the admin.

## v1.1 Requirements (Launch)

### Deploy

- [ ] **DEPLOY-01**: Backend runs on Render/Railway over HTTPS; `GET /` returns `{"status":"ok"}`
- [ ] **DEPLOY-02**: Frontend deployed to Cloudflare Workers via the "Deploy Frontend" workflow (`CLOUDFLARE_API_TOKEN` secret, `VITE_API_URL` variable)
- [ ] **DEPLOY-03**: Production env set: `ALLOWED_ORIGINS`, `PAYMENT_TOKEN_SECRET`, `RATE_LIMIT_TRUSTED_PROXY_HOPS=1`, `ENVIRONMENT=production`
- [ ] **DEPLOY-04**: All migrations applied in production, including `2026-09-13_mp_pix_constraint.sql`
- [ ] **DEPLOY-05**: CI green on `main`; frontend deploy triggers on push to `main` after first validated deploy

### Payments

- [ ] **PAY-01**: Mercado Pago production credentials set (`MERCADO_PAGO_ACCESS_TOKEN`, `VITE_MERCADO_PAGO_PUBLIC_KEY`)
- [ ] **PAY-02**: Webhook configured with secret (`MERCADO_PAGO_WEBHOOK_URL`, `MERCADO_PAGO_WEBHOOK_SECRET`) and signature check on
- [ ] **PAY-03**: Real low-value purchase succeeds end to end with PIX, card and boleto; order turns `pago` in admin

### Legal & Trust

- [ ] **LEGAL-01**: Footer shows legal name, CNPJ/CPF, email and phone (Decreto 7.962/2013)
- [ ] **LEGAL-02**: Privacy policy page (LGPD)
- [ ] **LEGAL-03**: Terms of use page
- [ ] **LEGAL-04**: Exchanges and returns page, including 7-day right of withdrawal (CDC art. 49)
- [ ] **LEGAL-05**: Signup and checkout link to / ask acceptance of the policies
- [ ] **LEGAL-06**: Working WhatsApp contact (`wa.me` link) where the site promises WhatsApp

### Shipping & Email

- [ ] **SHIP-01**: Melhor Envio active (`MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_CONTATO`, `FRETE_CEP_ORIGEM`); checkout shows real quotes
- [ ] **MAIL-01**: Brevo active (`BREVO_API_KEY`, `EMAIL_FROM`) with SPF/DKIM on the domain; order emails arrive

### Domain

- [ ] **DOM-01**: `carolinaviapiana.com.br` (and `www`) serve the site over HTTPS via Cloudflare
- [ ] **DOM-02**: `api.carolinaviapiana.com.br` serves the backend; URL updated in `ALLOWED_ORIGINS`, `VITE_API_URL`, Mercado Pago webhook
- [ ] **DOM-03**: Auth token moved from localStorage to `HttpOnly; Secure; SameSite=Lax` cookie (VULNERABILIDADES item 7)

### QA & Discoverability

- [ ] **QA-01**: Responsive check of every route on phone/tablet/desktop
- [ ] **QA-02**: `robots.txt`, `sitemap.xml`, `og:image` and per-page meta
- [ ] **QA-03**: Accessibility pass (labels, contrast, keyboard)
- [ ] **QA-04**: Performance pass (LCP image priority, WebP/AVIF, `srcset` — audit Issues 11–12)
- [ ] **QA-05**: Privacy-friendly analytics installed

### Operations

- [ ] **OPS-01**: Supabase pooler password rotated; email confirmation enabled
- [ ] **OPS-02**: Daily DB backup scheduled and one restore tested
- [ ] **OPS-03**: Uptime monitoring on backend `GET /` and the site
- [ ] **OPS-04**: Real stock levels entered (seed set everything to 20)
- [ ] **OPS-05**: LGPD data-retention policy decided with Carolina and documented
- [ ] **OPS-06**: Refund/chargeback handling procedure documented for the admin

## v2 Requirements

Deferred to after launch. Tracked but not in the current roadmap.

### Fiscal

- **NFE-01**: Issue NF-e automatically for paid orders (Focus NFe preferred)
- **NFE-02**: Store and show DANFE/XML/PDF to admin and customer

### Fulfilment

- **FUL-01**: Buy shipping labels through Melhor Envio
- **FUL-02**: Tracking events shown on `/rastreio` instead of only an external link
- **FUL-03**: Automatic email/WhatsApp notifications on status changes

### Platform

- **PLAT-01**: Shared rate-limit store (Redis) for multi-instance backend
- **PLAT-02**: Automatic order reversal on refund/chargeback
- **PLAT-03**: Structured payment logging (audit Issues 16–17)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Sicredi PIX | Replaced by Mercado Pago PIX (2026-09-13) |
| Native mobile app | Web covers the brand's volume |
| Multi-seller marketplace | Single-brand store |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPLOY-01 | Phase 10 | Pending |
| DEPLOY-02 | Phase 10 | Pending |
| DEPLOY-03 | Phase 10 | Pending |
| DEPLOY-04 | Phase 10 | Pending |
| DEPLOY-05 | Phase 10 | Pending |
| PAY-01 | Phase 11 | Pending |
| PAY-02 | Phase 11 | Pending |
| PAY-03 | Phase 11 | Pending |
| LEGAL-01 | Phase 12 | Pending |
| LEGAL-02 | Phase 12 | Pending |
| LEGAL-03 | Phase 12 | Pending |
| LEGAL-04 | Phase 12 | Pending |
| LEGAL-05 | Phase 12 | Pending |
| LEGAL-06 | Phase 12 | Pending |
| SHIP-01 | Phase 13 | Pending |
| MAIL-01 | Phase 13 | Pending |
| DOM-01 | Phase 14 | Pending |
| DOM-02 | Phase 14 | Pending |
| DOM-03 | Phase 14 | Pending |
| QA-01 | Phase 15 | Pending |
| QA-02 | Phase 15 | Pending |
| QA-03 | Phase 15 | Pending |
| QA-04 | Phase 15 | Pending |
| QA-05 | Phase 15 | Pending |
| OPS-01 | Phase 16 | Pending |
| OPS-02 | Phase 16 | Pending |
| OPS-03 | Phase 16 | Pending |
| OPS-04 | Phase 16 | Pending |
| OPS-05 | Phase 16 | Pending |
| OPS-06 | Phase 16 | Pending |

**Coverage:**
- v1.1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-10-10*
*Last updated: 2026-10-10 after GSD bootstrap*
