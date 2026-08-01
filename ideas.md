# Ideas & Roadmap

## Launch Checklist (priority order)

### 1. Apply 2 pending DB migrations to production
Both are on disk but not yet in prod. Until they run, **every order creation returns 500**.

```bash
psql $SUPABASE_POSTGRES_URL -f backend/migrations/2026-07-27_audit_issues.sql
psql $SUPABASE_POSTGRES_URL -f backend/migrations/2026-07-28_email_cliente.sql
```

What `2026-07-27_audit_issues.sql` adds:
- `reservar_estoque_pedido(JSONB)` function — called on every order; without it orders 500
- `repor_estoque_pedido(JSONB)` function — stock never restored on cancellation without it
- `webhook_events` table — all Sicredi/MP webhook callbacks silently no-op without it
- `anonymized_at` column on `pedidos` — LGPD account deletion leaves PII in DB without it

What `2026-07-28_email_cliente.sql` adds:
- `email_cliente` column on `pedidos` — `order_service.criar_pedido()` inserts this column; missing → 500

### 2. Set `VITE_API_URL` before production build
`frontend/.env` currently has `VITE_API_URL=` (empty). The Cloudflare Worker has no proxy,
so every API call 404s in production. Set the real backend URL before running `bun build`:

```
VITE_API_URL=https://<your-backend-host>
```

### 3. Fix rate limit IP header ✅ (done)
Added `RATE_LIMIT_CLIENT_IP_HEADER=cf-connecting-ip` to `backend/.env`.
Without this, behind Cloudflare all clients share one rate-limit bucket (Cloudflare's egress IP).

### 4. Configure at least one payment method
PIX via Sicredi is the simplest (no card processing, no MP account needed):

```
SICREDI_CLIENT_ID=...
SICREDI_CLIENT_SECRET=...
SICREDI_CERT_PATH=backend/certs/sicredi.crt
SICREDI_KEY_PATH=backend/certs/sicredi.key
```

Or MercadoPago for card + boleto + PIX in one:
```
MERCADO_PAGO_ACCESS_TOKEN=...
MERCADO_PAGO_WEBHOOK_SECRET=...
VITE_MERCADO_PAGO_PUBLIC_KEY=...   # frontend/.env
VITE_MERCADO_PAGO_ENABLED=true     # frontend/.env
```

### 5. Configure Brevo for transactional email
```
BREVO_API_KEY=...
EMAIL_FROM=noreply@carolinaviapiana.com.br
```

---

## Scale (when traffic grows)

- **Cloudflare R2 for product images** — zero egress cost, plugs directly into the existing
  image upload endpoint; replace Supabase storage bucket with R2
- **Supabase Edge Function for stock reservation** — `reservar_estoque_pedido` is already a DB
  function; wrapping it in an Edge Function eliminates FastAPI round-trips under peak load
- **Cloudflare Cache Rule for catalog** — `GET /api/produtos` changes rarely; 60s cache TTL
  collapses catalog load to near-zero backend hits
- **Full-text product search** — Supabase has `pg_trgm`; add a `/produtos?q=` endpoint with
  trgm index for search bar (handles 10k+ SKUs)
- **PWA / installable mobile** — service worker + manifest makes the site installable from
  mobile Safari/Chrome; drives re-engagement for a repeat-purchase product like scents
- **Fly.io multi-region** — `fly scale count 2 --region gru` for Brazilian latency;
  pair with Supabase read replicas for the catalog

---

## Monetization Beyond Product Sales

### Subscription / recurring revenue
- **Monthly scent box** — subscriber picks intensity, receives 2–3 diffuser refills; highest
  LTV for this product category; integrate with MercadoPago subscriptions API
- **Seasonal limited editions** — Valentine's, Natal, winter/summer collections tied to
  the subscription tier

### B2B / Wholesale
- **Salon, spa, yoga studio, hotel accounts** — bulk pricing tier, invoice billing;
  the admin panel already has role-based access — add a `parceiro` role + B2B checkout
- **Corporate gifting** — custom branded diffusers (logo + scent), MOQ 50 units;
  high margin, near-zero marketing cost, companies buy for employee gifts / events

### Digital products (zero COGS)
- **PDF guide: "Como aromatizar ambientes"** — R$19–29, pure margin, sell via Hotmart or
  as a product SKU in this store
- **Online scent-blending workshop** — live session (Zoom), sold via Kiwify/Hotmart;
  no inventory, no shipping
- **Scent profile quiz → personalized recommendation** — drives conversion; quiz result
  emails product links (Brevo is already wired)

### Platform / white-label (long-term)
- This is a complete artisan e-commerce stack. Once running, license it to other small-batch
  producers (candles, soaps, cosmetics) as a SaaS — monthly fee per store
- Multi-tenant version needs only: `store_id` column on products/orders +
  subdomain routing in Cloudflare Workers

### Content / community
- **Blog / SEO** — "como aromatizar ambientes", "melhores aromas para home office" etc.;
  TanStack Start is SSR so pages are indexable out of the box
- **YouTube/Reels** — production process content → brand trust → direct orders
- **Affiliate/referral program** — existing customers earn credit per referral;
  implement as a `cupom_origem` column on `pedidos` (one migration away)
