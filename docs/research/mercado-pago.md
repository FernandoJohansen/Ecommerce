# Mercado Pago Payments API — Integration Research

Research compiled from official Mercado Pago documentation at developers.mercadopago.com on 2026-07-25.
Covers the **Checkout Transparente via Orders API** (current, recommended) and notes where behavior differs from the legacy `/v1/payments` endpoint.

---

## 1. Authentication

### Credential Types

Mercado Pago provides two credential types per application:

| Credential | Where Used | Purpose |
|---|---|---|
| **Public Key** | Frontend (MercadoPago.js) | Encrypts card data, fetches payment methods |
| **Access Token** | Backend only (server-side) | Creates payments, fetches order status |

Both credentials exist in two modes:
- **Test credentials** — available immediately after creating an application; no activation required.
- **Production credentials** — require activation by providing industry/website details in the developer panel.

Credentials are obtained at: **Your Integrations → select application → Testes > Credenciais de teste** (or Produção > Credenciais de produção).

### Passing the Access Token

Always pass the Access Token in the `Authorization` header. **Never** put it in a query parameter.

```
Authorization: Bearer {{YOUR_ACCESS_TOKEN}}
```

Example curl:

```bash
curl -H 'Authorization: Bearer APP_USR-xxxxxxxxxxxxxxxxxxxx' \
     https://api.mercadopago.com/v1/orders/ORD01JS2V6CM8KJ0EC4H502TGK1WP
```

Test tokens begin with the prefix `APP_USR-`.

### Base URL

All API calls go to:

```
https://api.mercadopago.com
```

There is **no separate sandbox base URL**. Sandbox behavior is controlled by which credentials you use (test vs. production tokens). When using test credentials the system runs in sandbox mode automatically.

*Sources: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/resources/credentials*

---

## 2. Creating Payments

### 2.1 Current API: Orders (POST /v1/orders)

Mercado Pago currently recommends the **Orders API** (`POST /v1/orders`) over the legacy `POST /v1/payments` endpoint. All examples below use the Orders API.

#### 2.1.1 Card Payments (Credit / Debit)

**Tokenization flow:**

1. Frontend loads **MercadoPago.js** with the Public Key.
2. The SDK renders a card form (Card Payment Brick) that captures PAN, expiry, CVV.
3. MercadoPago.js encrypts card data client-side and returns a **card token** (single-use, 7-day expiry, PCI-compliant).
4. Frontend sends the card token + order metadata to the backend.
5. Backend calls `POST /v1/orders` with the token.

**Request:**

```bash
POST https://api.mercadopago.com/v1/orders
Authorization: Bearer {{ACCESS_TOKEN}}
X-Idempotency-Key: {{UNIQUE_UUID}}
Content-Type: application/json
```

```json
{
  "type": "online",
  "processing_mode": "automatic",
  "total_amount": "50.00",
  "external_reference": "ext_ref_1234",
  "payer": {
    "email": "comprador@example.com"
  },
  "transactions": {
    "payments": [
      {
        "amount": "50.00",
        "payment_method": {
          "id": "master",
          "type": "credit_card",
          "token": "<card_token_from_frontend>",
          "installments": 1
        }
      }
    ]
  }
}
```

Key fields:
- `processing_mode`: `"automatic"` processes immediately; `"manual"` requires a separate capture call.
- `payment_method.id`: card brand identifier, e.g. `"visa"`, `"master"`, `"amex"`, `"elo"`.
- `payment_method.type`: `"credit_card"` or `"debit_card"`.
- `installments`: number of installments (1 = full; use higher values for *parcelas*).

**Response (success):**

```json
{
  "id": "ORD01JS2V6CM8KJ0EC4H502TGK1WP",
  "type": "online",
  "processing_mode": "automatic",
  "status": "processed",
  "status_detail": "accredited",
  "total_amount": "50.00",
  "transactions": {
    "payments": [
      {
        "id": "PAY01JS2V6CM8KJ0EC4H504R7YE34",
        "status": "processed",
        "status_detail": "accredited",
        "amount": "50.00"
      }
    ]
  }
}
```

**3DS 2.0:** For enhanced fraud protection, include the `config.online.transaction_security` node:

```json
{
  "config": {
    "online": {
      "transaction_security": {
        "validation": "on_fraud_risk",
        "liability_shift": "required"
      }
    }
  }
}
```

When 3DS challenge is required the response returns `status: "action_required"` / `status_detail: "pending_challenge"`. The challenge URL is at `transactions.payments[i].payment_method.transaction_security.url` — embed it in an iframe. The buyer has 40 minutes. Listen for `window.postMessage` with `{ status: "COMPLETE" }` and then poll `GET /v1/orders/{id}` for the final status.

*Sources: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-integration/cards, https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/integrate-3ds*

---

#### 2.1.2 PIX

PIX requires pre-registered Pix keys in the seller's Mercado Pago account.

**Request:**

```bash
POST https://api.mercadopago.com/v1/orders
Authorization: Bearer {{ACCESS_TOKEN}}
X-Idempotency-Key: {{UNIQUE_UUID}}
Content-Type: application/json
```

```json
{
  "type": "online",
  "processing_mode": "automatic",
  "total_amount": "50.00",
  "external_reference": "pedido-123",
  "payer": {
    "email": "comprador@example.com",
    "first_name": "João",
    "last_name": "Silva",
    "identification": {
      "type": "CPF",
      "number": "12345678909"
    }
  },
  "transactions": {
    "payments": [
      {
        "amount": "50.00",
        "payment_method": {
          "id": "pix",
          "type": "bank_transfer"
        },
        "expiration_time": "PT30M"
      }
    ]
  }
}
```

Key fields:
- `payment_method.id`: `"pix"`
- `payment_method.type`: `"bank_transfer"`
- `expiration_time`: ISO 8601 duration. Default is 24 hours (`PT24H`). Minimum 30 minutes (`PT30M`), maximum 30 days (`P30D`).
- `payer.identification`: CPF is required for PIX in Brazil.

**Response:**

```json
{
  "id": "ORD01...",
  "status": "action_required",
  "status_detail": "waiting_transfer",
  "transactions": {
    "payments": [
      {
        "status": "action_required",
        "status_detail": "waiting_transfer",
        "payment_method": {
          "qr_code": "00020126580014br.gov.bcb.pix...",
          "qr_code_base64": "iVBORw0KGgoAAAANSUhEUgAABWQAYVkAQAAAA...",
          "ticket_url": "https://www.mercadopago.com.br/sandbox/payments/..."
        }
      }
    ]
  }
}
```

- `qr_code`: the raw Pix Copia e Cola string for text-based copying.
- `qr_code_base64`: base64-encoded PNG image; render directly in `<img src="data:image/png;base64,...">`.
- `ticket_url`: full hosted page with both QR image and copy-paste text.

Once paid, the order status transitions to `processed` / `accredited`. Subscribe to webhooks (see Section 3) to receive real-time confirmation.

*Sources: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-integration/pix*

---

#### 2.1.3 Boleto Bancário

**Request:**

```bash
POST https://api.mercadopago.com/v1/orders
Authorization: Bearer {{ACCESS_TOKEN}}
X-Idempotency-Key: {{UNIQUE_UUID}}
Content-Type: application/json
```

```json
{
  "type": "online",
  "processing_mode": "automatic",
  "total_amount": "50.00",
  "external_reference": "pedido-456",
  "payer": {
    "email": "comprador@example.com",
    "first_name": "João",
    "last_name": "Silva",
    "identification": {
      "type": "CPF",
      "number": "12345678909"
    },
    "address": {
      "street_name": "Av. das Nações Unidas",
      "street_number": "3003",
      "zip_code": "06233903",
      "neighborhood": "Bonfim",
      "state": "SP",
      "city": "Osasco"
    }
  },
  "transactions": {
    "payments": [
      {
        "amount": "50.00",
        "payment_method": {
          "id": "boleto",
          "type": "ticket"
        },
        "expiration_time": "P3D"
      }
    ]
  }
}
```

Key fields:
- `payment_method.id`: `"boleto"` (for Boleto Bancário via Bradesco/Banco do Brasil).
- `payment_method.type`: `"ticket"`.
- `payer.identification`: **CPF is mandatory** for boleto in Brazil.
- `payer.address`: **all address fields are mandatory** — street_name, street_number, zip_code, neighborhood, state, city. If no street number, send `"N/A"`.
- `address.state`: two-character state code only (e.g. `"SP"`, `"PR"`, `"RJ"`).
- `expiration_time`: ISO 8601 duration. Default is **3 business days**. Range: 1–30 days after creation.

**Response:**

```json
{
  "status": "action_required",
  "status_detail": "waiting_payment",
  "transactions": {
    "payments": [
      {
        "status": "action_required",
        "status_detail": "waiting_payment",
        "payment_method": {
          "ticket_url": "https://www.mercadopago.com/...",
          "barcode_content": "3335008800000000006004835002...",
          "digitable_line": "23793380296060054351030006333303799140000020000",
          "financial_institution": "boleto"
        }
      }
    ]
  }
}
```

- `ticket_url`: hosted page with boleto instructions and printable boleto.
- `barcode_content`: the barcode number.
- `digitable_line`: the typed/numeric line for bank payment terminals.

*Sources: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-integration/boleto*

---

### 2.2 Legacy API: POST /v1/payments

The older `/v1/payments` endpoint is still functional but is now called "Payments API (legacy)" in the official reference. The request structure is different:

- Uses `transaction_amount` (number) instead of `total_amount` (string).
- Uses flat `payment_method_id` (e.g. `"visa"`, `"pix"`, `"bolbradesco"`) instead of a nested `transactions.payments` array.
- PIX QR code is returned in `point_of_interaction.transaction_data.qr_code` and `qr_code_base64`.
- Boleto barcode is returned in `barcode.content` and `transaction_details.external_resource_url`.
- Uses `date_of_expiration` (ISO 8601 datetime string) instead of `expiration_time` (duration).

**Note:** The current backend (`/home/p4r4d0xx/projeto/Ecommerce/backend/`) should evaluate whether to target `/v1/orders` (preferred) or remain on `/v1/payments`. The Orders API is the documented current standard as of mid-2026.

*Source: API Reference section at https://www.mercadopago.com.br/developers/en/reference*

---

## 3. Webhook Notifications

### Webhooks vs IPN

| Feature | Webhooks | IPN (deprecated) |
|---|---|---|
| Signature validation | Yes (HMAC-SHA256 via `x-signature` header) | Header present but **cannot be validated** |
| Event types | `orders`, `payment`, chargebacks, subscriptions, wallet_connect, and more | `payment`, `merchant_order`, `chargebacks` |
| Status | Current, recommended | Being phased out — **migrate to Webhooks** |

### Configuration

Configure via the developer dashboard:

1. Go to **Your Integrations** → select the application.
2. Navigate to **Webhooks → Configure Notifications**.
3. Set an HTTPS URL for production (and optionally test).
4. Select event types (e.g. **Order** / `orders`).
5. Click Save — the dashboard generates a **secret key** for signature validation.

Alternatively, pass `notification_url` in the body when creating a payment/order for per-transaction notification URLs.

### Event Types

The webhook `type` field indicates the resource:

| Type | When triggered |
|---|---|
| `orders` | Order created or updated (Orders API) |
| `payment` | Legacy payment created/updated |
| `subscription_authorized_payment` | Subscription charge |
| `subscription_preapproval` | Subscription linked |
| `mp-connect` | OAuth account linked |
| `wallet_connect` | Wallet Connect transaction |
| `topic_claims_integration_wh` | Refund or claim |
| `topic_chargebacks_wh` | Chargeback |
| `stop_delivery_op_wh` | Fraud alert |

### Payload Structure

Mercado Pago POSTs to your URL with these headers and body:

**Headers:**
```
x-signature: ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839
x-request-id: 8e5b2f23-1a4c-4b8d-91f2-3c7e0a9b1234
```

**Body:**
```json
{
  "id": 12345,
  "live_mode": true,
  "type": "payment",
  "date_created": "2015-03-25T10:04:58.396-04:00",
  "user_id": 44444,
  "api_version": "v1",
  "action": "payment.created",
  "data": {
    "id": "999999999"
  }
}
```

The `data.id` field is the resource ID. Use it to fetch the full resource from the API.

### Signature Validation (HMAC-SHA256)

The `x-signature` header format:

```
ts=<unix_timestamp>,v1=<hmac_sha256_hex>
```

**Validation steps:**

1. Extract `ts` and `v1` from the `x-signature` header.
2. Build the signed string: `id:<data.id_query_param>;request-id:<x-request-id_header>;ts:<ts>;`
3. Compute `HMAC-SHA256(signed_string, secret_key)` where `secret_key` is the key shown in your integrations panel.
4. Compare computed hash with `v1`. If they match, the notification is authentic.

**Python example:**

```python
import hmac, hashlib

def validate_mercadopago_webhook(
    x_signature: str,
    x_request_id: str,
    data_id: str,   # from query param ?data.id=...
    secret: str,
) -> bool:
    parts = dict(p.split("=", 1) for p in x_signature.split(","))
    ts = parts.get("ts", "")
    v1 = parts.get("v1", "")
    manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
    expected = hmac.new(
        secret.encode(), manifest.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, v1)
```

### Response Requirements

Your endpoint must return **HTTP 200 or 201** within **22 seconds**. If it does not:
- Mercado Pago retries every 15 minutes for the first three attempts.
- After the third attempt, retry intervals increase (exact schedule not documented).

### Testing Webhooks

In the dashboard: after saving the configuration, click **Simulate**, choose the URL, event type, and a test data ID, then click **Send Test**.

*Sources: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/notifications, https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks, https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/ipn*

---

## 4. Sandbox Testing

### Test Credentials

Test credentials are obtained from the developer dashboard for each application. Test Access Tokens start with `APP_USR-`. Use them in exactly the same way as production tokens — the base URL `api.mercadopago.com` is the same; the environment is determined by the credential type.

**Important note from the documentation:** "There is no support for test credentials. Use test users with production credentials for sandbox and production credentials for production." This means you should create dedicated **test user accounts** (seller + buyer) and use their credentials — not just any test token.

### Creating Test Accounts

Test accounts are created through the developer dashboard (UI-based, not via API):

1. Go to **Your Integrations** → select application → **Test accounts**.
2. Click **+ Create test account**.
3. Choose account type: **Seller**, **Buyer**, or **Integrator**.
4. The system generates a username, password, and 6-digit verification code.

Use the test seller's Access Token when calling the API and the test buyer's data (email, CPF) in the payer fields.

### Test Cards

Use these cards in the sandbox. **No real charges are made.**

| Type | Brand | Number | CVV | Expiry |
|---|---|---|---|---|
| Credit | Mastercard | 5480 8328 0103 3311 | 123 | 11/30 |
| Credit | Visa | 4235 6477 2802 5682 | 123 | 11/30 |
| Credit | American Express | 3753 651535 56885 | 1234 | 11/30 |
| Debit | Elo | 5067 7667 8388 8311 | 123 | 11/30 |

### Payment Scenario Simulation

The outcome is controlled by the **cardholder name** field at checkout (put the code as the first name):

| Code | Result | Test CPF |
|---|---|---|
| `APRO` | Approved payment | 12345678909 |
| `OTHE` | General error (declined) | 12345678909 |
| `CONT` | Pending (awaiting authorization) | — |
| `CALL` | Declined — authorization required | — |
| `FUND` | Declined — insufficient funds | — |
| `SECU` | Declined — invalid security code | — |
| `EXPI` | Declined — card expired | — |
| `FORM` | Form error | — |

Additional codes: `CARD`, `INST`, `DUPL`, `LOCK`, `CTNA`, `ATTE`, `BLAC`, `UNSU`, `TEST`.

### Testing PIX in Sandbox

Set `payer.first_name` to `"APRO"` when creating a PIX order. The sandbox will return `status: "action_required"` / `status_detail: "waiting_transfer"` with a valid (fake) QR code. The payment then automatically transitions to approved.

### Testing Boleto in Sandbox

Send a valid boleto request. The sandbox returns a `ticket_url` and `barcode_content`. Payment is simulated — boleto payments in sandbox auto-approve without requiring a real payment.

### Verifying Test Results

```bash
GET https://api.mercadopago.com/v1/orders/{order_id}
Authorization: Bearer {{TEST_ACCESS_TOKEN}}
```

*Sources: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/integration-test/cards, https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/integration-test/pix, https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/resources/test-cards, https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/resources/credentials*

---

## 5. Idempotency

### Header Name

```
X-Idempotency-Key: <value>
```

### When to Use

The `X-Idempotency-Key` header must be sent on every **payment creation request** (`POST /v1/orders`). It is also required for other state-changing operations (captures, refunds).

### Key Format

Use a **UUID v4** or any sufficiently random unique string per request. Example:

```python
import uuid
idempotency_key = str(uuid.uuid4())
```

### Behavior

- If you send the same `X-Idempotency-Key` twice and the first request is still being processed, the second request returns **HTTP 423** (resource locked).
- If you send the same key for an already-completed request, **HTTP 409** is returned.
- If there is a 409/423 error related to idempotency, **generate a new unique key** and retry — do not reuse the conflicting key.

### Rate Limiting

If you exceed request quotas, the API returns **HTTP 429**. Observe the `Retry-After` header and use exponential backoff before retrying.

*Sources: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/integration-errors (idempotency errors section), card/PIX/boleto integration pages*

---

## 6. Error Handling

### HTTP Status Codes

| Code | Category | Meaning |
|---|---|---|
| 200 / 201 | Success | Request processed |
| 400 | Bad Request | Validation error, missing required fields, wrong types, malformed JSON |
| 401 | Unauthorized | Invalid or missing Access Token |
| 402 | Payment Error | Processing error (the payment itself failed) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Business logic conflict (e.g. already-refunded order, idempotency key reuse) |
| 423 | Locked | Resource locked — idempotency key in-flight; retry with same key after short wait |
| 429 | Rate Limited | Too many requests; check `Retry-After` header |
| 500 | Server Error | Mercado Pago internal error; retry with new idempotency key |

### Error Object Structure

The API returns errors with these fields:

```json
{
  "status": 400,
  "code": "required_properties",
  "description": "Field 'payer.email' is required"
}
```

Error codes (examples):

| Code | Meaning |
|---|---|
| `json_syntax_error` | Malformed JSON body |
| `required_properties` | Missing mandatory field |
| `property_type` | Field value has wrong type |
| Idempotency-related | Duplicate key or locked resource |

### Payment Status Values (Orders API)

Order-level `status`:

| Status | Meaning |
|---|---|
| `created` | Order created, not yet processed |
| `processing` | In progress |
| `action_required` | Awaiting buyer action (PIX payment, boleto payment, 3DS challenge) |
| `processed` | Completed successfully |
| `failed` | Payment failed |
| `canceled` | Canceled, will not complete |
| `expired` | Exceeded time limit |
| `refunded` | Fully refunded |
| `charged_back` | Chargeback in progress or settled |

Transaction-level `status_detail` values:

| status | status_detail | Meaning |
|---|---|---|
| `processed` | `accredited` | Payment approved and credited |
| `processed` | `partially_refunded` | Partial refund was applied |
| `processing` | `in_process` | Being processed |
| `processing` | `pending_review_manual` | Manual fraud review in progress |
| `processing` | `in_review` | Automated risk analysis |
| `action_required` | `waiting_payment` | Boleto issued, waiting for payment |
| `action_required` | `waiting_transfer` | PIX QR generated, waiting for transfer |
| `action_required` | `waiting_capture` | Authorized but not yet captured |
| `action_required` | `pending_challenge` | 3DS challenge sent to buyer (40 min window) |
| `failed` | `bad_filled_card_data` | Card data entered incorrectly |
| `failed` | `insufficient_amount` | Insufficient funds |
| `failed` | `required_call_for_authorize` | Bank requires phone authorization |
| `failed` | `card_disabled` | Card inactive or blocked |
| `failed` | `cc_rejected_duplicated_payment` | Duplicate transaction detected |
| `failed` | `invalid_installments` | Installment plan not supported by card |
| `failed` | `max_attempts_exceeded` | Too many failed attempts |
| `failed` | `high_risk` | Fraud risk detected (e.g. two identical consecutive payments) |
| `failed` | `rejected_by_issuer` | Card issuer declined |
| `failed` | `cc_rejected_other_reason` | Bank declined, unspecified reason |
| `expired` | `expired` | Transaction timed out |
| `canceled` | `canceled` | Explicitly canceled |
| `charged_back` | `in_process` | Chargeback under review |
| `charged_back` | `settled` | Amount refunded to buyer |
| `charged_back` | `reimbursed` | Amount credited back to seller |

*Sources: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/integration-errors, https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/status/transaction-status, https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/status/order-status, https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/improve-payment-approval/reasons-for-rejection*

---

## 7. Brazil-Specific Requirements

### CPF / CNPJ

- **Boleto**: CPF is **mandatory** in `payer.identification.type = "CPF"` and `payer.identification.number`.
- **PIX**: CPF is **required** (`payer.identification`) to process PIX payments.
- **Card**: CPF is not strictly mandated in the payment request itself, but is required for the sandbox `APRO` scenario (`CPF: 12345678909`) and is recommended for fraud scoring.
- CNPJ can be used for corporate buyers (`identification.type = "CNPJ"`).

### Payer Fields

For **boleto** the full payer block is required:

```json
"payer": {
  "email": "...",
  "first_name": "...",
  "last_name": "...",
  "identification": { "type": "CPF", "number": "99999999999" },
  "address": {
    "street_name": "...",
    "street_number": "...",    // "N/A" if none
    "zip_code": "...",         // 8 digits, no hyphen e.g. "06233903"
    "neighborhood": "...",
    "state": "SP",             // 2-character state code
    "city": "..."
  }
}
```

For **PIX** the identification block is required; address is optional.
For **card** payments only `payer.email` is required, but including identification and address improves approval rates.

### PIX Keys

The merchant (seller) must have Pix keys registered in their Mercado Pago account before offering PIX as a payment method. The Pix key type (CPF, CNPJ, email, phone, random key) is managed in the seller's Mercado Pago account settings — it is not specified per payment request.

### PIX Expiration

Set via `expiration_time` in ISO 8601 duration format:
- Default: 24 hours (`PT24H`)
- Minimum: 30 minutes (`PT30M`)
- Maximum: 30 days (`P30D`)

### Boleto Due Date

Set via `expiration_time` in ISO 8601 duration format:
- Default: **3 business days** (`P3D`)
- Range: 1–30 days after creation

### Installments (Parcelas)

Set `installments` inside `payment_method`:

```json
"payment_method": {
  "id": "visa",
  "type": "credit_card",
  "token": "...",
  "installments": 3
}
```

- `installments: 1` = full payment in one charge.
- Values > 1 split the total into monthly installments.
- Whether installments are interest-free depends on the seller's configuration in the Mercado Pago panel.
- The MercadoPago.js SDK automatically fetches available installment options for a given card and amount via the Public Key — use this to display installment choices to the buyer before creating the order.
- Not all card brands support all installment counts; the API returns `status_detail: "invalid_installments"` if the requested count is not supported.

### Device Fingerprint (Fraud Scoring)

Include a device fingerprint to improve approval rates:

1. Load the security script on the checkout page:
   ```html
   <script src="https://www.mercadopago.com/v2/security.js" view="checkout"></script>
   ```
2. The script exposes a device ID. Send it in the payment request header:
   ```
   X-meli-session-id: <device_id>
   ```
3. Alternatively, include buyer information, shipping details, and product details in the order body — more data = better fraud scoring.

### Recommendation: Consecutive Identical Payments

The `high_risk` rejection code can trigger when two consecutive payments are made with the same items or very similar parameters. Implement a short delay or a confirmation step before allowing retries to avoid this.

*Sources: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-integration/pix, https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-integration/boleto, https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/improve-payment-approval/recommendations, https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/improve-payment-approval/reasons-for-rejection*

---

## Appendix: Unverified / Unclear Items

The following items could not be fully verified from the pages fetched. They should be confirmed against the Mercado Pago API reference or SDK source before implementation:

1. **Legacy `/v1/payments` request schema**: The documentation has shifted entirely toward the Orders API (`/v1/orders`). The exact field names for the legacy endpoint (e.g. `transaction_amount` vs `total_amount`, `point_of_interaction` for PIX QR code, `barcode.content` for boleto) could not be confirmed from a live reference page (multiple `/reference/payments/_payments/post` URLs returned 404). If the backend will use the legacy endpoint, confirm the schema via the Mercado Pago Python SDK source or the reference page at https://www.mercadopago.com.br/developers/en/reference.

2. **Idempotency key for reads vs writes**: It was confirmed that `X-Idempotency-Key` is required for order creation. Whether it is also expected on GET requests (reads) was not explicitly stated in the documentation pages fetched.

3. **Notification URL per payment**: The documentation mentions `notification_url` as a field in the payment/order body for per-request webhook configuration. The exact field placement within `/v1/orders` body was not shown in the fetched examples.

4. **Payer CPF for card payments in production**: The docs confirm CPF is required for boleto and PIX. For card payments it was described as optional but beneficial for fraud scoring. This should be verified for compliance — some acquirer configurations may require it.

5. **Python/FastAPI SDK**: Mercado Pago provides an official Python SDK (`mercadopago` on PyPI). The fetched docs did not show Python SDK examples for the Orders API — only the raw HTTP interface was documented. Verify SDK support for Orders API vs legacy Payments API before choosing the integration approach.

6. **IPN retry schedule after 3 attempts**: The docs state "after the third attempt, the interval will be extended" but do not specify to what interval. Assume exponential backoff; design your idempotency handling accordingly.
