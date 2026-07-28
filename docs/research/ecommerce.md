# E-Commerce Engineering Best Practices

Research compiled from Stripe, MercadoPago, Cloudflare, PostgreSQL, OWASP, MDN, OpenTelemetry, and other primary sources on 2026-07-27.

---

## 1. Checkout & Payment Flows

### Idempotency Keys

**Why they exist:** Network retries can cause the same request to be processed twice, resulting in duplicate charges or orders. An idempotency key lets the server deduplicate — it stores the result of the first request and returns it verbatim for any subsequent request with the same key.

**Stripe implementation:**
- Header: `Idempotency-Key: <value>` (up to 255 characters; use V4 UUIDs)
- POST requests accept the header; GET/DELETE do not (they are idempotent by nature)
- Keys are retained for **at least 24 hours**; after pruning, reusing an old key generates a new request
- If the same key is submitted with **different parameters**, Stripe returns an error — it does not silently replace the stored result ([source](https://docs.stripe.com/api/idempotent_requests))

**MercadoPago implementation:**
- Header: `X-Idempotency-Key: <UUID>` (1–64 characters; UUID format recommended)
- Mandatory for the Payments and Refunds API since 2024-01-09 for new integrations
- Same guarantee: duplicate requests return the first response; different params with the same key require a new key within 24 hours ([source](https://www.mercadopago.com.ar/developers/en/news/2023/01/04/Idempotency-key-usage-will-be-mandatory))

```python
# Example: generate per-checkout-attempt key (store it before the request)
import uuid

idempotency_key = str(uuid.uuid4())
headers = {"X-Idempotency-Key": idempotency_key}
# Store idempotency_key in the order record before calling MercadoPago
```

### Webhook Reliability (At-Least-Once Delivery & Deduplication)

Stripe and MercadoPago both guarantee **at-least-once delivery** — the same event may arrive more than once. You must deduplicate on your end.

**Deduplication pattern:**
1. Verify the webhook signature before any processing
2. Check if the event ID already exists in a `webhook_events` table
3. If it exists, return `200 OK` and stop — do not re-process
4. Process the event, then insert the event ID

```python
# FastAPI example
async def handle_webhook(event_id: str, payload: dict):
    exists = await db.fetchval(
        "SELECT 1 FROM webhook_events WHERE event_id = $1", event_id
    )
    if exists:
        return {"status": "already_processed"}

    # Process here...
    await process_payment_event(payload)

    await db.execute(
        "INSERT INTO webhook_events (event_id, processed_at) VALUES ($1, NOW())",
        event_id
    )
```

**MercadoPago webhook specifics:**
- Notification payload fields: `id`, `type`, `action`, `data.id`, `date_created`, `live_mode`
- Signature in `x-signature` header (HMAC); validate using MP SDK or manually
- MP waits **22 seconds** for `200`/`201` response; retries every 15 minutes thereafter
- Event types include: `payment` (covers PIX, card, boleto), `chargebacks`, `fraud_alerts` ([source](https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks))

**Stripe additional best practices:**
- Verify `Stripe-Signature` header (HMAC-SHA256 + timestamp with 5-minute replay window)
- Return `200` immediately; process asynchronously via a queue (background task / worker)
- Subscribe only to events your integration uses — reduces surface area ([source](https://docs.stripe.com/webhooks#best-practices))

### PCI-DSS Scope Reduction via Tokenization

Using a hosted fields / JS-SDK approach (MercadoPago.js, Stripe Elements) means card data travels **directly from the browser to the payment processor** — it never touches your servers.

| Approach | PCI scope | Audit requirement |
|---|---|---|
| Hosted fields / MercadoPago.js | Minimal (SAQ A equivalent) | Annual self-assessment |
| Direct card capture on your server | Full PCI-DSS (300+ controls) | Annual QSA audit |

**What is safe to store:**
- Card type, last 4 digits, expiry date — not subject to PCI compliance
- MercadoPago `card_id` token — safe to store for one-click purchases

**Never store:** full PAN, CVV, magnetic stripe data ([source](https://docs.stripe.com/security/guide))

---

## 2. Inventory & Order State Machines

### Optimistic vs Pessimistic Locking for Stock Reservation

**Pessimistic locking** (`SELECT FOR UPDATE`) — lock the row before reading, guarantees no concurrent modification:

```sql
BEGIN;
SELECT stock FROM products WHERE id = $1 FOR UPDATE;
-- Check stock > 0 in application
UPDATE products SET stock = stock - 1 WHERE id = $1;
COMMIT;
```

**Optimistic locking** — read without lock, detect conflicts at write time using a version column:

```sql
-- Read
SELECT stock, version FROM products WHERE id = $1;
-- Write (fails if another transaction incremented version)
UPDATE products SET stock = stock - 1, version = version + 1
WHERE id = $1 AND version = $read_version AND stock > 0;
-- If 0 rows affected → conflict → retry
```

**`SKIP LOCKED` for queue-like patterns** (e.g., multiple workers processing reservations):

```sql
SELECT id FROM pending_reservations
WHERE status = 'pending'
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

`SKIP LOCKED` allows each worker to grab a different row without blocking, enabling parallel processing without deadlocks. ([source](https://www.postgresql.org/docs/current/explicit-locking.html))

**Recommendation for this project:**
- Use `SELECT FOR UPDATE` on the `products` row at checkout
- Use a `CHECK (stock >= 0)` constraint as a hard safety net
- Reserve at order creation, decrement on payment confirmation, release on expiry/cancellation

### Overselling Prevention

**Database-level safeguard:**
```sql
ALTER TABLE products ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);
```

**Application-level reservation table pattern** (more flexible — supports TTL):

```sql
CREATE TABLE stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    quantity INT NOT NULL,
    order_id UUID,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Available stock view:
-- products.stock - SUM(reservations.quantity WHERE expires_at > NOW())
```

Run a periodic cleanup job (cron or pg_cron) to release expired reservations.

### Order Status Lifecycle

Reference: Shopify's financial status enum — a widely adopted state machine for e-commerce orders.

| Status | Meaning |
|---|---|
| `pending` | Payment method submitted; awaiting confirmation (e.g., boleto not yet paid) |
| `authorized` | Card authorized but not yet captured |
| `paid` | Funds fully collected |
| `partially_paid` | Partial payment received |
| `refunded` | Full refund issued |
| `partially_refunded` | Partial refund issued |
| `voided` | Authorization cancelled before capture |
| `expired` | PIX or boleto payment window elapsed without payment |

*Sources: [Shopify OrderDisplayFinancialStatus](https://shopify.dev/docs/api/admin-graphql/latest/enums/OrderDisplayFinancialStatus), [Shopify order statuses](https://help.shopify.com/en/manual/fulfillment/managing-orders/order-status)*

**PostgreSQL implementation:**
```sql
CREATE TYPE order_financial_status AS ENUM (
    'pending', 'authorized', 'paid', 'partially_paid',
    'refunded', 'partially_refunded', 'voided', 'expired', 'cancelled'
);
```

---

## 3. Performance & Scalability

### CDN Edge Caching (Cloudflare)

**Relevant `Cache-Control` directives for product catalog pages:**

| Directive | Effect |
|---|---|
| `public` | Allows edge (CDN) to cache the response |
| `max-age=N` | Browser caches for N seconds |
| `s-maxage=N` | Edge caches for N seconds (overrides `max-age` at CDN level) |
| `stale-while-revalidate=N` | Serve stale content for up to N seconds while fetching fresh |
| `no-store` | Never cache (use for cart, checkout, user-specific pages) |

**Recommended values for this project:**

```
# Product catalog API (rarely changes):
Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400

# Product detail page (may have stock status):
Cache-Control: public, s-maxage=300, stale-while-revalidate=3600

# Cart, checkout, order pages (user-specific):
Cache-Control: no-store

# Static assets (images, JS, CSS with content hash):
Cache-Control: public, max-age=31536000, immutable
```

**Warning:** Do not combine `s-maxage` with `stale-while-revalidate` — `s-maxage` implies `proxy-revalidate`, which prevents serving stale content during the revalidation window. ([source](https://developers.cloudflare.com/cache/concepts/cache-control/))

### Database Indexing for E-Commerce

**Full-text search with GIN indexes:**

```sql
-- Add tsvector column
ALTER TABLE products ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce(description,''))
    ) STORED;

-- GIN index for fast text search
CREATE INDEX idx_products_search ON products USING GIN (search_vector);

-- Query
SELECT * FROM products WHERE search_vector @@ plainto_tsquery('portuguese', 'difusor lavanda');
```

GIN is **preferred over GiST** for text search: it is lossless (no false matches requiring table rechecks), multi-word searches are faster, and it uses `maintenance_work_mem` for faster builds. ([source](https://www.postgresql.org/docs/current/textsearch-indexes.html))

**B-tree indexes for order history queries:**

```sql
-- Orders by user + date (common pattern for order history pages)
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);

-- Orders by status (for admin panels)
CREATE INDEX idx_orders_status ON orders (status) WHERE status NOT IN ('paid', 'cancelled');

-- Payments by external ID (idempotency/webhook lookup)
CREATE INDEX idx_payments_external_id ON payments (external_id);
```

### Image Optimization

**Format:** Serve WebP or AVIF for product images. AVIF achieves ~50% smaller files than JPEG at equivalent quality; WebP ~25–35% smaller. Use `<picture>` to provide format fallbacks.

**Responsive images (`srcset`):**

```html
<img
  srcset="produto-480w.webp 480w, produto-800w.webp 800w, produto-1200w.webp 1200w"
  sizes="(max-width: 600px) 480px, (max-width: 900px) 800px, 1200px"
  src="produto-800w.webp"
  alt="Difusor de aromas"
  width="800"
  height="800"
  loading="lazy"
/>
```

**Lazy loading:**
- Use `loading="lazy"` on below-the-fold images
- **Do NOT** use `loading="lazy"` on above-the-fold images or the LCP image — it increases LCP time
- Browser starts loading lazy images ~1,250 px before they enter the viewport (4G); ~2,500 px on slow connections
- Always include `width` and `height` attributes to prevent Cumulative Layout Shift (CLS)
- Support: Chrome 77+, Firefox 75+, Safari 15.4+, Edge 79+ ([source](https://web.dev/articles/browser-level-image-lazy-loading))

*Sources: [MDN HTML Performance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/HTML), [web.dev lazy loading](https://web.dev/articles/browser-level-image-lazy-loading)*

---

## 4. Security

### OWASP Top 10:2025 Applied to This Project

| # | Risk | E-Commerce Manifestation | Mitigation |
|---|---|---|---|
| A01 | Broken Access Control | IDOR: user requests `/api/pedidos/123` belonging to another user; metadata tampering (JWT user_id) | Check `order.user_id == current_user.id` server-side on every order endpoint; deny-by-default |
| A02 | Security Misconfiguration | Debug endpoints left open in prod; permissive CORS; default credentials | Strict CORS allowlist; disable `/docs` in prod; rotate all secrets |
| A03 | Injection | SQL injection via unsanitized product search; NoSQL injection | Use parameterized queries only — never string-format SQL; FastAPI/SQLAlchemy do this by default |
| A04 | Cryptographic Failures | Storing PIX keys or card data in plaintext | Never store card numbers; use MercadoPago tokens; encrypt sensitive fields at rest |
| A07 | Authentication Failures | Brute force on `/login`; session fixation | Rate limit login; use short-lived JWT; invalidate sessions on password change |
| A08 | Software/Data Integrity | Mass assignment: `PATCH /user` accepting `is_admin=true` | Explicit Pydantic schemas per endpoint; never pass raw request body to ORM |

*Sources: [OWASP Top 10:2025](https://owasp.org/Top10/2025/), [OWASP A01](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/)*

**IDOR prevention example (FastAPI):**

```python
@router.get("/pedidos/{order_id}")
async def get_order(order_id: uuid.UUID, current_user: User = Depends(get_current_user)):
    order = await orders_repo.get(order_id)
    if not order or order.user_id != current_user.id:
        raise HTTPException(status_code=404)  # 404, not 403 — don't reveal existence
    return order
```

### Rate Limiting on Checkout/Payment Endpoints

Cloudflare rate limiting rules require: expression (which path), characteristics (what to count per), period (seconds), threshold (max requests), action (block/challenge).

**Recommended limits for this project:**

| Endpoint | Limit | Period | Action |
|---|---|---|---|
| `POST /api/pagamentos` | 5 requests | 60 s per IP | Block 10 min |
| `POST /api/auth/login` | 10 requests | 60 s per IP | Challenge (CAPTCHA) |
| `POST /api/pedidos` | 20 requests | 60 s per IP | Block 5 min |
| `GET /api/produtos` | 200 requests | 60 s per IP | Block 1 min |

**Note:** Cloudflare rate limiting is not designed for exact precision — counter updates may be delayed. Configure thresholds with a buffer above expected legitimate traffic. Enterprise plans support per-ASN and per-country rules. ([source](https://developers.cloudflare.com/waf/rate-limiting-rules/))

### Fraud Signals (MercadoPago)

**Device Fingerprint:** MercadoPago collects non-sensitive device data (OS, browser, screen resolution) via MercadoPago.js to build a device fingerprint. This is attached to payment requests automatically when using the JS SDK and is used in ML-based fraud scoring.

**3DS 2.0 (Antifraude Plus):** Available as an add-on; triggers strong customer authentication for high-risk transactions, reducing chargebacks. For Shopify integrations it is enabled via the "Antifraude Plus" app.

**Application-level velocity checks** (implement in FastAPI):

```python
async def check_velocity(user_id: uuid.UUID, ip: str) -> None:
    """Block if > 3 failed payments in last hour from same user or IP."""
    failed_count = await db.fetchval("""
        SELECT COUNT(*) FROM payments
        WHERE (user_id = $1 OR ip_address = $2)
          AND status = 'failed'
          AND created_at > NOW() - INTERVAL '1 hour'
    """, user_id, ip)
    if failed_count >= 3:
        raise HTTPException(status_code=429, detail="Too many failed payment attempts")
```

---

## 5. Brazilian E-Commerce Specifics

### PIX Instant Payment Flow

**QR Code types:**
- **Static QR** — fixed amount or amount-free; reusable; no expiration
- **Dynamic QR** — single-use; contains amount and expiration; required for e-commerce checkout

**MercadoPago PIX flow (Orders API):**

1. `POST /v1/orders` with `payment_method: {type: "pix"}` and `expiration_time` (ISO 8601 duration)
2. Response includes:
   - `qr_code` — alphanumeric Pix Copia e Cola string
   - `qr_code_base64` — base64 PNG for rendering
   - `ticket_url` — hosted Pix page
3. Default expiration: **24 hours**; minimum 30 minutes; maximum 30 days
4. After 30 days past expiration, the transaction auto-expires and cannot be manually cancelled
5. Initial status: `action_required` / `status_detail: waiting_transfer`

**endToEndId for reconciliation:**
- PIX spec (Banco Central) defines `endToEndId` as a globally unique ID assigned by the originating institution at transfer time
- Format: `E{ispb}{yyyyMMddHHmm}{random_alphanum}` (32 chars)
- Use `endToEndId` + `txid` as the compound unique key when storing received PIX payments for deduplication: `UNIQUE (txid, endToEndId)`
- Implement a fallback cron poll (hourly) to catch webhooks missed during bank instability

*Sources: [MercadoPago PIX integration](https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-integration/pix), [Banco Central PIX](https://www.bcb.gov.br/estabilidadefinanceira/pix)*

### Boleto Bancário Lifecycle

| Stage | Detail |
|---|---|
| Creation | Boleto generated with `date_of_expiration` (vencimento); typically 3 business days default |
| Before due date | Payable at any bank, ATM, lottery agent, supermarket, or internet banking |
| After due date | Payable **only at the issuer's bank**; may include penalty/interest if configured by issuer |
| Clearance delay | 1–3 business days after payment — account not credited instantly |
| MercadoPago timeout | If unpaid for 30 days after due date → automatically cancelled/expired |

**Webhook events to handle:**
- `payment` with `status: approved` → boleto cleared, fulfil order
- `payment` with `status: cancelled` or `status: rejected` → release stock reservation
- Poll the payment status API as a safety net (boleto clearing notifications can be delayed)

*Sources: [Wikipedia Boleto](https://en.wikipedia.org/wiki/Boleto), [MercadoPago webhooks](https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks)*

### CEP Lookup & Shipping Quotes (MelhorEnvio)

**Authentication:** OAuth 2.0; create an application in the MelhorEnvio panel to obtain `client_id` and `client_secret`. Token is passed as `Authorization: Bearer <token>`.

**Key API operations:**

| Operation | Description |
|---|---|
| Freight quote (`cotação de fretes`) | Calculate shipping cost and ETA from origin CEP to destination CEP |
| List carriers (`listar transportadoras`) | Available carriers for a given route |
| Add to cart (`inserir fretes no carrinho`) | Reserve a shipment slot before purchasing |
| Purchase freight (`compra de fretes`) | Finalize the shipment purchase |
| Generate label (`geração de etiquetas`) | Get the shipping label PDF/ZPL |
| Track shipment (`status da etiqueta`) | Get lifecycle status of a label |

**Shipping quote request minimum fields:** `from.postal_code`, `to.postal_code`, `package.weight`, `package.width`, `package.height`, `package.length`.

*Source: [MelhorEnvio docs](https://docs.melhorenvio.com.br/)*

### LGPD Data Minimization

Brazil's Lei Geral de Proteção de Dados (LGPD) — Article 6 Necessity Principle — requires processing only the minimum personal data needed for the stated purpose. Article 16 governs retention exceptions.

**Key obligations for order records:**

| Principle | Application |
|---|---|
| Minimization | Collect only: name, email, CPF (for NF-e), shipping address, phone. Do not collect unnecessary demographics. |
| Retention | Define explicit retention period; document justification. Common practice: 5 years for tax/fiscal records (legal obligation), then delete or anonymize. |
| Anonymization | After fulfillment and fiscal retention period: replace `name`, `email`, `cpf`, `phone`, `address` with anonymized values. Keep `order_total`, `product_ids`, `created_at` for business analytics. |
| Deletion right | Implement a `DELETE /api/usuario/dados` endpoint; must delete or anonymize all personal data on request (except legally required retention). |

**Anonymization SQL pattern:**

```sql
-- Run after retention period expires (e.g., 5 years post-order)
UPDATE orders SET
    customer_name = 'ANONYMIZED',
    customer_email = NULL,
    customer_cpf = NULL,
    shipping_address = NULL,
    phone = NULL,
    anonymized_at = NOW()
WHERE created_at < NOW() - INTERVAL '5 years'
  AND anonymized_at IS NULL;
```

*Sources: [LGPD compliance guide](https://secureprivacy.ai/blog/lgpd-compliance-requirements), [LGPD official](https://www.gov.br/secretariageral/pt-br/noticias/2020/agosto/lgpd-vigencia)*

---

## 6. Observability

### Structured Logging (OpenTelemetry)

**Key principles:**
- Events are **named, time-stamped occurrences** (`checkout.started`, `payment.failed`) — distinct from spans (operations with duration) and plain logs (unstructured diagnostic messages)
- Event names must be **static** — never embed dynamic values (order IDs, user IDs) in the name; put them in attributes
- Include `trace_id` and `span_id` in every log record to correlate across distributed calls
- Use `error.type` attribute on failure events for grouping in dashboards

**Recommended event names for this project:**

| Event name | Attributes |
|---|---|
| `checkout.started` | `user_id`, `cart_item_count`, `cart_total` |
| `payment.initiated` | `user_id`, `order_id`, `payment_method`, `amount`, `currency` |
| `payment.succeeded` | `user_id`, `order_id`, `payment_id`, `payment_method` |
| `payment.failed` | `user_id`, `order_id`, `error.type`, `payment_method` |
| `webhook.received` | `provider`, `event_type`, `event_id` |
| `webhook.duplicate` | `provider`, `event_id` |
| `order.status_changed` | `order_id`, `from_status`, `to_status` |
| `stock.reservation_created` | `product_id`, `quantity`, `order_id` |
| `stock.reservation_released` | `product_id`, `reason` (`expired`/`cancelled`/`paid`) |

*Source: [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/)*

### Key Metrics

| Metric | 2026 Benchmark | How to measure |
|---|---|---|
| Cart abandonment rate | ~70% global average; 75% on mobile | `carts_created` vs `orders_placed` |
| Checkout completion rate | ~47% of those who start | `checkout_started` vs `order_placed` events |
| Conversion rate (visit → purchase) | 1.7–2.7% (e-commerce average) | `page_views` vs `orders_placed` |
| Payment failure rate | Track: target <5% | `payment.failed` / `payment.initiated` |

**Top checkout abandonment causes (2026):** surprise shipping costs (39%), slow delivery (21%), payment trust concerns (19%), forced account creation (19%), complex checkout (18%). ([source](https://www.clickpost.ai/blog/cart-abandonment-rate))

### Error Alerting for Payment & Webhook Failures

**Dead-letter queue pattern** (for webhook processing):

```python
# On webhook processing failure, push to a retry queue
async def process_webhook_with_retry(event: dict, attempt: int = 0):
    try:
        await process_webhook(event)
    except Exception as e:
        if attempt < 3:
            await retry_queue.push(event, delay=2 ** attempt * 60)  # exponential backoff
        else:
            await dead_letter_queue.push(event)  # alert ops
            logger.error("webhook.dead_lettered", event_id=event["id"], error=str(e))
```

**Retry budget:** 3 attempts with exponential backoff (1 min, 2 min, 4 min). After exhaustion, alert via email/Slack and store in `failed_webhooks` table for manual review.

**Alert thresholds:**
- `payment.failed` rate > 10% in a 5-minute window → page on-call
- `webhook.dead_lettered` any occurrence → send alert (these should never happen in normal operation)
- MercadoPago already retries webhooks every 15 min after no `200`; your retry queue handles application-level failures separately

*Sources: [MercadoPago webhooks](https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks), [OpenTelemetry events](https://opentelemetry.io/docs/specs/semconv/general/events/)*
