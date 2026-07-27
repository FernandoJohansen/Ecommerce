# Domain & Email Strategy

## Decision

Purchase a custom domain (e.g. `carolinaviapiana.com.br`) before launch.

**Cost:** ~R$40/year via [Registro.br](https://registro.br)

## Why

- Professional sender address for auth emails — Supabase's generic domain increases spam rate
- Required to activate the JWT → httpOnly cookie migration (needs SameSite=Lax on same-site; see `auth-cookie-migration-deferred.md`)
- Enables transactional email (order confirmations, shipping updates) — currently the one missing feature
- Marketing list compounds in value as customer base grows

## Implementation Order

1. **Buy domain + configure DNS** — unblocks everything below; do this first
2. **Supabase custom SMTP** — point auth emails at your domain (config-only, no code change)
3. **Transactional email service** — Brevo recommended (free up to 300 emails/day, ~R$54/mo to upgrade); integrate with FastAPI for order/shipping notifications
4. **Marketing emails** — implement last; requires LGPD opt-in checkbox at registration and unsubscribe link (neither exists yet)

## Email Service Recommendation

**Brevo** (`brevo.com`) — best free tier for starting out (300 emails/day, no credit card required), EU-hosted (LGPD-friendly), simple SMTP setup.

| Plan | Emails/mo | Price |
|---|---|---|
| Free | ~9k (300/day cap) | R$0 |
| Starter | 20k (no daily cap) | ~R$54/mo* |

\*Approximate at R$6/USD; check brevo.com for current pricing.

**Setup:** create account → add domain → follow DNS wizard (SPF + DKIM + DMARC in Cloudflare) → paste SMTP credentials into Supabase → done. No code changes needed.

Alternatives if Brevo doesn't scale: Amazon SES (~R$0.60/1k emails, cheapest at volume), SendGrid.

## LGPD Requirements for Marketing

Before sending any promotional email:
- Explicit opt-in consent checkbox at `/cadastro` (not pre-checked)
- Unsubscribe link in every marketing email
- Consent stored with timestamp in DB

Transactional emails (order confirmation, shipping) do not require opt-in — they are necessary for contract fulfillment.
