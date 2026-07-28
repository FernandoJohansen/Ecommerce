# Code Audit Issues

Audit conducted 2026-07-27 against the e-commerce best practices in `docs/research/ecommerce.md`.
All issues fixed 2026-07-27. Migration file: `backend/migrations/2026-07-27_audit_issues.sql`.

> **Action required:** run `2026-07-27_audit_issues.sql` in the Supabase SQL Editor before deploying.

---

## HIGH

### Issue 1 — Idempotency key not persisted before MercadoPago call
- **File:** `backend/app/services/payment_service.py:363,452`
- `uuid4().hex` is generated inline as the argument to `criar_pagamento`. The key is never stored before the HTTP call. If the network times out after MP receives the request but before the response arrives, a retry produces a new key and causes a duplicate charge.
- **Fix:** Persist the idempotency key to the `pagamentos` row before issuing the MP call; on retry, look up and reuse the stored key.

---

### Issue 2 — No webhook event-ID deduplication table
- **File:** `backend/schema.sql` (absent); `backend/app/services/payment_service.py` (`processar_webhook_mercadopago`, `processar_webhook_pix`)
- MercadoPago guarantees at-least-once delivery. The current guard (skip already-`approved` orders) is not race-safe — two simultaneous webhooks for a `pending` order can both read `pending` and both process.
- **Fix:** Create a `webhook_events` table with `event_id TEXT UNIQUE`; insert the MP `data.id` atomically before processing (`INSERT ... ON CONFLICT DO NOTHING`).

---

### Issue 3 — Webhook signature verification defaults to off
- **File:** `backend/app/core/config.py:53`; `backend/app/main.py:39`
- `WEBHOOK_REQUIRE_SIGNATURE` defaults to `false`. When `MERCADO_PAGO_WEBHOOK_SECRET` is not configured, the webhook endpoint accepts all unauthenticated calls and still processes the payload. Should fail-closed in production.
- **Fix:** Change `WEBHOOK_REQUIRE_SIGNATURE` default to `true`; document that the MP secret must be configured before enabling MercadoPago.

---

### Issue 4 — Multi-product stock reservation is not atomic
- **File:** `backend/app/services/order_service.py:122–129`
- `baixar_estoque` is called in a Python `for` loop, one product at a time, outside a single DB transaction. Two simultaneous checkouts can each succeed the first product's decrement and then both fail or succeed on the second. The rollback loop (`_desfazer_estoque`) also runs as separate HTTP calls — non-atomic.
- **Fix:** Wrap the entire multi-product stock reservation and `insert_pedido` inside a single database transaction, or use a stored procedure that decrements all items atomically.

---

### Issue 5 — No LGPD data deletion endpoint
- **File:** Absent from all route files (`auth.py`, `users.py`, etc.)
- LGPD Art. 18 grants data subjects the right to erasure. There is no endpoint that deletes or anonymizes a user's personal data (name, email, CPF, phone, address) on request. The only LGPD measure present is CPF masking in API responses — a display concern, not a data-lifecycle one.
- **Fix:** Implement `DELETE /api/auth/meus-dados`: anonymize personal fields in `pedidos` rows (replace with `ANONYMIZED/NULL`), then call the Supabase Admin API to delete the auth user. Retain order totals and product IDs for fiscal compliance (5-year retention exception).

---

## MEDIUM

### Issue 6 — Order status enum is incomplete; no DB CHECK constraint
- **File:** `backend/app/schemas/order.py:124`; `backend/schema.sql:60`
- Current set: `{novo, em_andamento, pago, enviado, concluido, cancelado}`. Missing: `expirado` (cancelled ≠ expired), `reembolsado` (refund webhooks update `pagamentos` but never flip the order status), `autorizado`, `anulado`. No `CHECK` constraint on `pedidos.status` — any string can be written.
- **Fix:** Add `expirado` and `reembolsado` to the enum; add `CHECK (status IN (...))` to the schema; automate order status update on confirmed refund webhook.

---

### Issue 7 — No state-machine transition guard on `PATCH /pedidos`
- **File:** `backend/app/api/v1/orders.py:48`
- The staff-only PATCH endpoint accepts any valid status value including illegal transitions (e.g., `cancelado → pago`). A staff error or compromised session could mark a cancelled order as paid with no payment record behind it.
- **Fix:** Implement an allowed-transitions matrix; validate `(current_status, new_status)` in `update_pedido_status` before writing.

---

### Issue 8 — No velocity check on failed payment attempts
- **File:** `backend/app/services/payment_service.py` (absent)
- After N failed card attempts in 1 hour, the next attempt is not blocked — only the 10/min IP rate limit applies. A fraudster testing stolen cards would only be slowed, not stopped.
- **Fix:** Implement a `check_velocity` function that counts `rejected` payment rows for `user_id` or IP in the last hour and raises HTTP 429 after 5 failures.

---

### Issue 9 — No `Cache-Control` on product catalog API responses
- **File:** `backend/app/api/v1/products.py:29` (`GET /produtos`, `GET /aromas`)
- FastAPI returns no `Cache-Control` header. Cloudflare will not cache these responses. Every page load hits the backend and Supabase, even though catalog data changes rarely.
- **Fix:** Add `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` to the product and aroma list endpoints.

---

### Issue 10 — No `Cache-Control: no-store` on personalized endpoints
- **File:** `backend/app/api/v1/cart.py`, `payments.py`, `orders.py` (absent)
- Cart, payment status, and order detail responses carry no `Cache-Control` header. An edge misconfiguration could cause a CDN to serve one user's session data to another.
- **Fix:** Add `Cache-Control: no-store` to all authenticated/personalized endpoints.

---

### Issue 11 — LCP hero image missing `fetchpriority="high"` and WebP/AVIF
- **File:** `frontend/src/routes/index.tsx:173`
- The full-screen hero `<img>` has no `fetchpriority="high"` and is served as a plain JPEG with no `<picture>` element or `srcset` with WebP/AVIF alternatives. This is the highest-impact unoptimized asset on the page and directly affects LCP.
- **Fix:** Add `fetchpriority="high"` to the hero `<img>`; convert to WebP/AVIF; add a `<picture>` element with format fallbacks.

---

### Issue 12 — Product images have no `srcset` and no WebP/AVIF
- **File:** `frontend/src/routes/index.tsx:344`; `frontend/src/components/AtendimentoForm.tsx:112`
- Product images are served as full-resolution JPEG/PNG regardless of screen size. `width`/`height` and `loading="lazy"` are correct; the missing piece is responsive sizing and modern format delivery.
- **Fix:** Use Supabase Storage image transformation (`?width=`, `?format=webp`) or Cloudflare Images to serve appropriately-sized WebP via `srcset`.

---

### Issue 13 — PIX `e2eid` (endToEndId) not UNIQUE in schema
- **File:** `backend/schema.sql:99`
- The Bacen PIX spec requires `(txid, endToEndId)` as the compound deduplication key. `txid` has `UNIQUE` but `e2eid` does not. The current protection is code-level only (`status == "CONCLUIDA"` short-circuits); a subtle code change could break it.
- **Fix:** Add `UNIQUE (e2eid)` (allowing NULLs) or `UNIQUE (txid, e2eid)` to `pagamentos` as a DB-level deduplication guard.

---

### Issue 14 — No fallback cron poll for missed webhooks
- **File:** `backend/app/main.py` (absent — only `_expirar_pedidos_loop` exists)
- The design relies entirely on webhooks and frontend polling. If a customer pays via PIX, closes the browser, and the webhook is permanently lost, the expiration loop will **cancel a paid order**.
- **Fix:** Add a background loop (or `pg_cron` job) that hourly queries Sicredi for all `ATIVA` PIX charges older than 5 minutes and MP for all `pending` payments older than 10 minutes, and syncs their status.

---

### Issue 15 — No data anonymization job or retention enforcement
- **File:** `backend/schema.sql` (no `anonymized_at` column); absent from all services
- Full CPF, name, and address sit in the database indefinitely. LGPD requires deletion or anonymization after the declared retention period (5 years for fiscal records).
- **Fix:** Add `anonymized_at TIMESTAMPTZ` to `pedidos`; implement a `pg_cron` or background job running the anonymization SQL against orders older than 5 years where `anonymized_at IS NULL`.

---

### Issue 16 — No structured logging in `payment_service.py`
- **File:** `backend/app/services/payment_service.py` (no `logger` instantiation, no log calls)
- The highest-value code path is completely silent. No `payment.initiated`, `payment.succeeded`, or `payment.failed` events are emitted. Post-incident debugging and fraud investigation are blind.
- **Fix:** Add `logger = logging.getLogger(__name__)` and emit structured log records for at minimum: `payment.initiated`, `payment.succeeded`, `payment.failed`, `webhook.received`, `webhook.duplicate`.

---

### Issue 17 — Webhook handlers emit no logs
- **File:** `backend/app/api/v1/payments.py:107,166`
- When a webhook arrives, nothing is written to any log. No audit trail exists to confirm a webhook was received, validated, or processed.
- **Fix:** Log `webhook.received` with `provider`, `event_type`, and `event_id` (MP `data.id` or Sicredi `txid`) at the start of each webhook handler, before any processing.

---

## LOW

### Issue 18 — Stock expiration poll is coarse (24 h default)
- **File:** `backend/app/main.py:25` (`PEDIDO_EXPIRA_HORAS`)
- An abandoned checkout locks stock for up to 24 hours. There is no fine-grained `stock_reservations` table with per-row TTLs.
- **Fix:** Reduce default expiry to 30–60 minutes for unstarted payments, or implement a `stock_reservations` table with `expires_at` timestamps cleaned by `pg_cron`.

---

### Issue 19 — No startup guard preventing `ALLOWED_ORIGINS=*` in production
- **File:** `backend/app/main.py:85`; `backend/app/core/config.py:8`
- If `ALLOWED_ORIGINS` is misconfigured to `*` in production, CORS is wide open with no server-side safety net.
- **Fix:** Add a startup assertion that `ALLOWED_ORIGINS` does not contain `*` when `ENVIRONMENT=production`.

---

### Issue 20 — Rate limiter uses in-memory counters
- **File:** `backend/app/core/ratelimit.py:1–17`
- `slowapi` stores counters in process memory. Multiple backend instances each maintain independent counters — effective limit is `10 × N instances`. The comment in `ratelimit.py` acknowledges this.
- **Fix:** Use a shared Redis backend for `slowapi` when running more than one instance; or push rate limiting to Cloudflare WAF rules.

---

### Issue 21 — Missing `VITE_MERCADO_PAGO_PUBLIC_KEY` silently degrades card UI
- **File:** `frontend/src/components/pagamento/cartao-view.tsx:8`
- When the env var is absent, the card payment component renders "unavailable" silently. No build-time assertion ensures the variable is set when `MERCADO_PAGO_ENABLED=true`.
- **Fix:** Add a runtime check or Vite env-var validation that errors at build time if `MERCADO_PAGO_ENABLED` is true but `VITE_MERCADO_PAGO_PUBLIC_KEY` is empty.

---

## Confirmed correct (passes)

- `CHECK (estoque >= 0)` constraint exists in `schema.sql`
- IDOR: `exigir_acesso_pedido` checks `order.user_id == user.id` and returns 404 (not 403)
- No raw SQL string interpolation — Supabase client API used throughout
- `/docs` (Swagger) disabled in production by default
- Card data never hits the server — MercadoPago.js Brick tokenizes in-browser
- Boleto clearance delay disclosed to user; vencimento check is correct

---

## Priority order

1. Issue 2 — webhook deduplication table (race-safe foundation)
2. Issue 1 — persist idempotency key before MP call
3. Issue 3 — fail-closed webhook signature
4. Issue 5 — LGPD deletion endpoint
5. Issue 4 — atomic multi-product stock reservation
6. Issue 14 — fallback cron poll for missed webhooks
7. Issues 16 + 17 — payment logging (prerequisite for investigating everything else)
