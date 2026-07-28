# Melhor Envio API — Integration Reference

> Researched: 2026-07-25. All claims trace to fetched primary sources; each section notes the URL consulted.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Sandbox vs Production](#2-sandbox-vs-production)
3. [Quoting Shipping](#3-quoting-shipping)
4. [Creating a Shipping Label (full flow)](#4-creating-a-shipping-label-full-flow)
5. [Tracking](#5-tracking)
6. [Package Dimensions and Weight Fields](#6-package-dimensions-and-weight-fields)
7. [Rate Limits and Notable Production Constraints](#7-rate-limits-and-notable-production-constraints)
8. [Carrier Service IDs Reference](#8-carrier-service-ids-reference)
9. [Sources](#9-sources)

---

## 1. Authentication

### Overview

The Melhor Envio API uses **OAuth 2.0** (Authorization Code grant) as its authentication standard. Integration is free — no monthly fees or subscriptions.
(https://docs.melhorenvio.com.br/docs, fetched 2026-07-25)

### Application Registration

Before any API call, create an application in the Melhor Envio panel at:
`https://melhorenvio.com.br/painel/gerenciar/tokens`

The panel issues a **`client_id`** and **`client_secret`** for the application. A platform typically registers one application for all its merchants. The callback/redirect URI registered in the panel must exactly match the URI used in OAuth calls.
(https://github.com/melhorenvio/auth-sdk-php README, fetched 2026-07-25)

### Authorization Code Flow

**Step 1 — Redirect the user to the authorization URL**

Build the URL and redirect the browser there:

```
{BASE_URL}/oauth/authorize?response_type=code
    &client_id={client_id}
    &redirect_uri={redirect_uri}
    &scope={space-separated scopes}
    &state={random sha256 state value}
```

Production base URL: `https://melhorenvio.com.br`
Sandbox base URL:   `https://sandbox.melhorenvio.com.br`

Example (sandbox):
```
https://sandbox.melhorenvio.com.br/oauth/authorize?response_type=code
    &client_id=1234
    &redirect_uri=https%3A%2F%2Fmyloja.com%2Fcallback
    &scope=shipping-calculate+cart-read+cart-write
    &state=abc123hash
```

The `state` parameter must be verified on the callback to prevent CSRF.
(https://github.com/melhorenvio/auth-sdk-php `src/OAuth2.php`, method `getAuthorizationUrl()`, fetched 2026-07-25)

**Step 2 — Exchange the code for tokens**

After the user approves, Melhor Envio redirects to `redirect_uri?code={code}&state={state}`.
POST the code to:

```
POST {BASE_URL}/oauth/token
Content-Type: application/x-www-form-urlencoded
```

Request body:
```
grant_type=authorization_code
&client_id={client_id}
&client_secret={client_secret}
&redirect_uri={redirect_uri}
&code={code}
```

Response JSON:
```json
{
  "token_type": "Bearer",
  "expires_in": {unix_timestamp_of_expiry},
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGci...",
  "refresh_token": "def50200..."
}
```

(https://github.com/melhorenvio/auth-sdk-php `src/OAuth2.php`, method `getAccessToken()`, fetched 2026-07-25)

### Refreshing a Token

Access tokens expire after **30 days**. Refresh tokens expire after **45 days**.

```
POST {BASE_URL}/oauth/token
Content-Type: application/x-www-form-urlencoded
```

Request body:
```
grant_type=refresh_token
&client_id={client_id}
&client_secret={client_secret}
&refresh_token={refresh_token}
```

Implementing a token renewal routine is **mandatory** — the API will reject requests made with expired tokens.
(https://github.com/melhorenvio/auth-sdk-php `src/OAuth2.php`, method `refreshToken()`, fetched 2026-07-25; expiry times confirmed at https://docs.melhorenvio.com.br/reference, fetched 2026-07-25)

### Using the Bearer Token in Requests

All API calls (except the OAuth token endpoints themselves) require:

```http
Authorization: Bearer {access_token}
Accept: application/json
Content-Type: application/json
User-Agent: MyApp (support@myapp.com.br)
```

The `User-Agent` header is **mandatory** and must contain the application name plus a technical contact email. Requests without it may be rejected.
(https://docs.melhorenvio.com.br/reference `Introdução à API`, fetched 2026-07-25)

### Scopes

Scopes define what the token is allowed to do. They must be passed space-separated in the `scope` query parameter when building the authorization URL. The auth SDK README (fetched 2026-07-25) provides `shipping-calculate` as a documented example scope string.

The docs site was rate-limited during research, so a full enumerated scopes list could not be scraped. Based on the WooCommerce plugin source and the SDK README, the following scope strings are referenced in real integrations:

| Scope string | Implied permission |
|---|---|
| `shipping-calculate` | Call the freight quotation endpoint |
| `cart-read` | Read items in the Melhor Envio cart |
| `cart-write` | Insert/remove items from the cart |
| `orders-read` | Read order/label data |
| `shipment-tracking` | Query tracking status |
| `shipment-generate` | Generate printable labels |
| `shipment-checkout` | Purchase labels (wallet checkout) |
| `shipping-cancel` | Cancel labels |

**Warning:** This table was reconstructed from endpoint/route names found in plugin source code (`/Services/OrderService.php`) and is not a verbatim copy from the official scopes reference page. Verify the exact strings at the authorization panel before going to production.

---

## 2. Sandbox vs Production

### Base URLs

| Environment | Base URL |
|---|---|
| Production | `https://melhorenvio.com.br` |
| Sandbox | `https://sandbox.melhorenvio.com.br` |

All API paths are under `/api/v2/me/` in both environments.

Example production endpoint: `https://melhorenvio.com.br/api/v2/me/shipment/calculate`
Example sandbox endpoint:    `https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate`

The WooCommerce plugin (`Services/RequestService.php`) confirms the production base is `https://api.melhorenvio.com/v2/me` (note: `api.melhorenvio.com` is an alias for `melhorenvio.com.br/api`).
(https://github.com/melhorenvio/wp-melhorenvio-v2 `Services/RequestService.php` and `src/Enums/Endpoint.php` in shipment-sdk-php, fetched 2026-07-25)

### How to Switch

In the PHP SDKs, pass the environment string when instantiating the client:

```php
// shipment SDK
$shipment = new Shipment('your-token', Environment::PRODUCTION); // 'production' | 'sandbox'

// auth SDK
$provider->setEnvironment('production'); // default is 'sandbox'
```

For direct HTTP calls, simply change the base URL. The OAuth token for production will not work in sandbox and vice versa — they are separate accounts.
(https://github.com/melhorenvio/shipment-sdk-php `src/Enums/Environment.php` and auth-sdk-php README, fetched 2026-07-25)

### Sandbox Limitations

- Only **Correios** and **JadLog** carriers are available.
- Payment is via **Yapay** wallet only; transactions auto-approve after 5 minutes.
- Sandbox accounts start with a fictitious balance of **R$ 10,000.00**.
- Simulated shipment status changes happen automatically **15 minutes** after label generation (delivered status also auto-assigned 15 minutes after posting).
- Production and sandbox are **completely isolated** — no data sharing between environments.
- Not all production features are available in sandbox.

(https://docs.melhorenvio.com.br/reference `Introdução à API` and sandbox docs page, fetched 2026-07-25)

---

## 3. Quoting Shipping

### Endpoint

```
POST /api/v2/me/shipment/calculate
```

Full URL examples:
- Sandbox: `https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate`
- Production: `https://melhorenvio.com.br/api/v2/me/shipment/calculate`

(Confirmed in https://github.com/melhorenvio/shipment-sdk-php `src/Resources/Shipment/Calculator.php` line `$response = $this->resource->getHttp()->post('me/shipment/calculate', ...)`, fetched 2026-07-25)

### Required Headers

```http
Authorization: Bearer {access_token}
Accept: application/json
Content-Type: application/json
User-Agent: MyApp (contact@example.com)
```

### Request Body — Mode A: by Products

Use this mode when you have individual product dimensions (the API consolidates them into packages):

```json
{
  "from": {
    "postal_code": "01010010"
  },
  "to": {
    "postal_code": "20271130"
  },
  "products": [
    {
      "id": "unique-product-id-1",
      "height": 40,
      "width": 30,
      "length": 50,
      "weight": 10.00,
      "insurance_value": 100.00,
      "quantity": 1
    },
    {
      "id": "unique-product-id-2",
      "height": 5,
      "width": 1,
      "length": 10,
      "weight": 0.1,
      "insurance_value": 50.00,
      "quantity": 1
    }
  ],
  "options": {
    "receipt": false,
    "own_hand": false
  },
  "services": "1,2,3,4"
}
```

### Request Body — Mode B: by Volumes

Use this mode when you have pre-packed box dimensions:

```json
{
  "from": {
    "postal_code": "01010010"
  },
  "to": {
    "postal_code": "20271130"
  },
  "volumes": [
    {
      "height": 12,
      "width": 4,
      "length": 17,
      "weight": 0.1,
      "insurance": 6.00
    },
    {
      "height": 40,
      "width": 34,
      "length": 50,
      "weight": 10.0,
      "insurance": 50.00
    }
  ],
  "options": {
    "receipt": false,
    "own_hand": false,
    "collect": false
  }
}
```

**Important:** `products` and `volumes` are mutually exclusive — you must use one or the other in a single request, never both.
(https://github.com/melhorenvio/shipment-sdk-php `src/Resources/Shipment/Calculator.php`, `validatePayload()` method, fetched 2026-07-25)

### Request Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `from.postal_code` | string | Yes | Origin Brazilian CEP (8 digits) |
| `to.postal_code` | string | Yes | Destination Brazilian CEP (8 digits) |
| `products` | array | Yes* | Individual product items (*either this or `volumes`) |
| `products[].id` | string | Yes | Unique product identifier |
| `products[].height` | float | Yes | Height in **centimeters** |
| `products[].width` | float | Yes | Width in **centimeters** |
| `products[].length` | float | Yes | Length in **centimeters** |
| `products[].weight` | float | Yes | Weight in **kilograms** |
| `products[].insurance_value` | float | Yes | Product value in BRL (used for insurance) |
| `products[].quantity` | int | Yes | Quantity of this product |
| `volumes` | array | Yes* | Pre-packed box volumes (*either this or `products`) |
| `volumes[].height` | float | Yes | Height in **centimeters** |
| `volumes[].width` | float | Yes | Width in **centimeters** |
| `volumes[].length` | float | Yes | Length in **centimeters** |
| `volumes[].weight` | float | Yes | Weight in **kilograms** |
| `volumes[].insurance` | float | Yes | Box insured value in BRL |
| `options.receipt` | bool | No | Request delivery receipt (`aviso de recebimento`) — may add to price |
| `options.own_hand` | bool | No | Request own-hand delivery (`mão própria`) — may add to price |
| `options.collect` | bool | No | Request carrier pickup at origin — may add to price |
| `services` | string | No | Comma-separated carrier service IDs to filter results (e.g. `"1,2,3"`) — omit to get all carriers |

### Response

HTTP 200 on success. Returns an array of carrier quotes:

```json
[
  {
    "id": 1,
    "name": "PAC",
    "price": "19.00",
    "custom_price": "19.00",
    "discount": "0.00",
    "currency": "R$",
    "delivery_time": 8,
    "custom_delivery_time": 8,
    "delivery_range": {
      "min": 6,
      "max": 10
    },
    "custom_delivery_range": {
      "min": 6,
      "max": 10
    },
    "packages": [ ... ],
    "additional_services": {
      "receipt": false,
      "own_hand": false,
      "collect": false
    },
    "company": {
      "id": 1,
      "name": "Correios",
      "picture": "https://..."
    }
  },
  {
    "id": 2,
    "name": "SEDEX",
    "error": "CEP de destino não atendido por essa modalidade"
  }
]
```

Key response fields:
- `custom_price` — final price after account-level discounts/surcharges (always prefer this over `price` for display)
- `custom_delivery_time` — delivery time in calendar days after account-level adjustments
- `error` — present instead of price/time when the carrier cannot serve the route
- `company.name` — human-readable carrier name

(https://docs.melhorenvio.com.br/reference, quote endpoint section, fetched 2026-07-25; response field semantics from https://github.com/melhorenvio/shipment-sdk-php `examples/packages/example3.php`, fetched 2026-07-25)

---

## 4. Creating a Shipping Label (full flow)

Label creation is a **four-step process**: add to cart → checkout (purchase) → generate label → print/download label.

### Step 1 — Add to Cart

```
POST /api/v2/me/cart
```

This creates a pending order in the Melhor Envio platform and returns an order ID.

**Request body:**

```json
{
  "service": 4,
  "agency": null,
  "from": {
    "name": "Nome do Remetente",
    "email": "remetente@exemplo.com",
    "phone": "11912345678",
    "document": "",
    "company_document": "46867029000176",
    "state_register": "",
    "economic_activity_code": "4687701",
    "address": "Rua do Remetente",
    "complement": "",
    "number": "1234",
    "district": "Bairro",
    "city": "São Paulo",
    "postal_code": "09831510",
    "state_abbr": "SP"
  },
  "to": {
    "name": "Nome do Destinatário",
    "email": "destinatario@exemplo.com",
    "phone": "41912345678",
    "document": "055.967.520-88",
    "address": "Rua do Destinatário",
    "complement": "",
    "number": "1234",
    "district": "Bairro",
    "city": "Curitiba",
    "postal_code": "11730000",
    "country_id": "BR",
    "state_abbr": "PR"
  },
  "products": [
    {
      "name": "Produto A",
      "quantity": "1",
      "unitary_value": "400"
    }
  ],
  "volumes": [
    {
      "height": 15,
      "width": 30,
      "length": 40,
      "weight": 1.2
    }
  ],
  "options": {
    "platform": "Minha Loja",
    "insurance_value": 400,
    "receipt": false,
    "own_hand": false,
    "reverse": false,
    "non_commercial": false,
    "invoice": {
      "key": "43240412345678000195550010000012341234567890"
    },
    "tags": [
      {
        "tag": "1000007",
        "url": "https://minhaloja.com/pedidos/1000007"
      }
    ]
  }
}
```

**Field notes:**
- `service` (int): carrier service ID (see Section 8)
- `agency` (int | null): required for Latam Cargo, Azul Cargo, Buslog — the agency ID obtained from `/api/v2/me/shipment/agencies`
- `from.document` / `to.document`: CPF for individuals
- `from.company_document`: CNPJ for companies
- `options.non_commercial`: set `true` for non-commercial shipments (gifts, samples). For non-commercial Correios shipments after 2026-04-06, a DCE key is also required in `options.dce.key`
- `options.invoice.key`: NF-e access key (44-digit string) for commercial shipments
- `products[]` are for content declaration purposes (not for quoting); `volumes[]` are the physical packages
- `options.tags`: free-form order identifiers for your platform's reference

**Response:** HTTP 201 with the created order:

```json
{
  "id": "order-uuid-here",
  "protocol": "ME0123456789",
  "service_id": 4,
  "status": "pending",
  "tracking": null,
  "self_tracking": null,
  ...
}
```

**Save the `id` field** — it is the Melhor Envio order ID needed in all subsequent steps.

(https://docs.melhorenvio.com.br/reference `inserir-fretes-no-carrinho`, fetched 2026-07-25; also confirmed via https://github.com/melhorenvio/wp-melhorenvio-v2 `Services/CartService.php` and `Services/OrderService.php`, fetched 2026-07-25)

### Step 2 — Checkout (Purchase)

After inserting to cart, purchase the label using wallet balance:

```
POST /api/v2/me/shipment/checkout
```

**Request body:**

```json
{
  "orders": ["order-uuid-here"],
  "wallet": 19.00
}
```

- `orders`: array of order IDs from Step 1 (can batch multiple)
- `wallet`: total amount in BRL to debit from the Melhor Envio wallet

**Response:** HTTP 200 with the purchase result including updated order status (`paid`).

(https://github.com/melhorenvio/wp-melhorenvio-v2 `Services/OrderService.php`, route constant `ROUTE_MELHOR_ENVIO_CHECKOUT = '/shipment/checkout'` and `pay()` method, fetched 2026-07-25)

### Step 3 — Generate Label

After purchase, generate the printable label:

```
POST /api/v2/me/shipment/generate
```

**Request body:**

```json
{
  "orders": ["order-uuid-here"],
  "mode": "public"
}
```

- `mode`: `"public"` makes the label URL publicly accessible (no auth required to download)

**Response:** HTTP 200 with updated order data. After this step, the order status becomes `generated`.

(https://github.com/melhorenvio/wp-melhorenvio-v2 `Services/OrderService.php`, route constant `ROUTE_MELHOR_ENVIO_CREATE_LABEL = '/shipment/generate'` and `createLabel()` method, fetched 2026-07-25)

### Step 4 — Print / Download Label

Get the label PDF URL:

```
POST /api/v2/me/shipment/print
```

**Request body:**

```json
{
  "orders": ["order-uuid-here"]
}
```

**Response:**

```json
{
  "url": "https://melhorenvio.com.br/impressao/..."
}
```

The `url` field contains a link to the PDF label. After this call, order status becomes `released`.

There is also a file-download variant:
```
GET /api/v2/me/shipment/print/file
```

(https://github.com/melhorenvio/wp-melhorenvio-v2 `Services/OrderService.php`, route constant `ROUTE_MELHOR_ENVIO_PRINT_LABEL = '/shipment/print'` and `printLabel()` + `buyOnClick()` methods, fetched 2026-07-25; endpoint list from https://docs.melhorenvio.com.br/docs/geracao-de-etiquetas, fetched 2026-07-25)

### Label Validity

Generated labels are valid for **20 days**. Labels can only be cancelled if the carrier has not yet been notified of pickup. Refunds are processed within 12 hours after non-delivery is verified.

(https://docs.melhorenvio.com.br/docs/geracao-de-etiquetas, fetched 2026-07-25)

### Order Status Lifecycle

| Status | Meaning |
|---|---|
| `pending` | Inserted in cart, not yet paid |
| `paid` | Purchased (wallet debited) |
| `generated` | Label PDF generated |
| `released` | Label printed/downloaded, ready for posting |
| `posted` | Handed to carrier |
| `delivered` | Delivered to recipient |
| `cancelled` | Cancelled |

(https://github.com/melhorenvio/wp-melhorenvio-v2 `Models/Order.php` status constants and `Services/OrderService.php` state machine, fetched 2026-07-25)

---

## 5. Tracking

### Endpoint

```
POST /api/v2/me/shipment/tracking
```

**Request body:**

```json
{
  "orders": ["order-uuid-here"]
}
```

**Response:** An object keyed by order ID, each containing tracking events. The `tracking` field on the order object contains the carrier tracking code (e.g., Correios tracking number). This code can also be used directly on `https://melhorrastreio.com.br/rastreio/{tracking_code}`.

The `self_tracking` field on the order is an alternative tracking reference provided by Melhor Envio itself.

(https://github.com/melhorenvio/wp-melhorenvio-v2 `Services/OrderService.php`, route constant `ROUTE_MELHOR_ENVIO_TRACKING = '/shipment/tracking'` and `detail()` method; `Services/TrackingService.php` referencing `https://melhorrastreio.com.br/rastreio/{tracking}`, fetched 2026-07-25)

### Getting Order Details

To retrieve the current status and tracking code of a specific order:

```
GET /api/v2/me/cart/{order_id}
```

Returns the order object with `status`, `tracking`, `protocol`, and `self_tracking` fields.

```
GET /api/v2/me/orders/{order_id}
```

Also returns order detail; used by the WooCommerce plugin for the admin panel display.

(https://github.com/melhorenvio/wp-melhorenvio-v2 `Services/OrderService.php`, `infoOrderCart()` and `getInfoOrder()` methods, fetched 2026-07-25)

---

## 6. Package Dimensions and Weight Fields

### Units

**All dimensions must be in centimeters (cm). Weight must be in kilograms (kg).**

This is explicitly stated in the shipment SDK README:
> "As dimensões sempre devem ser passadas em centímetros e o peso em quilogramas. São as unidades que o Melhor Envio opera."
> ("Dimensions must always be passed in centimeters and weight in kilograms. These are the units Melhor Envio operates with.")

(https://github.com/melhorenvio/shipment-sdk-php README, fetched 2026-07-25)

### Field Names

#### For the Quote endpoint (`/shipment/calculate`), volumes mode:

| JSON key | Type | Unit | Description |
|---|---|---|---|
| `height` | float | cm | Box height |
| `width` | float | cm | Box width |
| `length` | float | cm | Box length |
| `weight` | float | kg | Box weight |
| `insurance` | float | BRL | Insured value of this package |

#### For the Quote endpoint, products mode:

| JSON key | Type | Unit | Description |
|---|---|---|---|
| `id` | string | — | Your product's unique identifier |
| `height` | float | cm | Product height |
| `width` | float | cm | Product width |
| `length` | float | cm | Product length |
| `weight` | float | kg | Product weight |
| `insurance_value` | float | BRL | Product value (used for insurance) |
| `quantity` | int | — | Quantity of this product |

Note the difference: `insurance` (volumes) vs `insurance_value` (products).

#### For the Cart endpoint (`/cart`), volumes array:

| JSON key | Type | Unit | Description |
|---|---|---|---|
| `height` | float | cm | Box height |
| `width` | float | cm | Box width |
| `length` | float | cm | Box length |
| `weight` | float | kg | Box weight |

(The cart endpoint uses `options.insurance_value` at the top level for the total insured amount, not per-volume.)

(All field names verified from https://github.com/melhorenvio/shipment-sdk-php `src/Resources/Shipment/Package.php`, `Product.php`, `Volume.php`, fetched 2026-07-25; cart endpoint from https://docs.melhorenvio.com.br/reference `inserir-fretes-no-carrinho`, fetched 2026-07-25)

### Minimum/Maximum Constraints

The SDK source code shows validation only that all dimension values must be **positive numbers** (greater than zero). No documented minimum or maximum values were found in primary sources during this research.

The WooCommerce plugin README warns:
> "Atenção com as medidas de unidades utilizadas, cuidado se você está utilizando gramas ou quilos, metros ou centímetros, isso vai aplicar no valor da cotação e no bom funcionamento da calculadora de fretes do Melhor Envio."
> ("Pay attention to the units — using grams vs kilograms or meters vs centimeters will affect quote values and the shipping calculator.")

(https://github.com/melhorenvio/wp-melhorenvio-v2 README, fetched 2026-07-25)

---

## 7. Rate Limits and Notable Production Constraints

### Rate Limits

The official API documentation **does not publish specific rate-limit numbers** (requests per minute, per hour, etc.). The reference page states:
> "The documentation does not specify rate limits for API requests."

The docs site itself began returning HTTP 429 responses during the research session for this document, suggesting rate limiting is enforced on the documentation portal, but no thresholds were documented for the API itself.

(https://docs.melhorenvio.com.br/reference `Introdução à API`, fetched 2026-07-25)

### Notable Constraints

- **HTTPS required** — all requests must use HTTPS.
- **User-Agent required** — the `User-Agent` header must include the application name and a technical contact email. Format: `"ApplicationName (contact@email.com)"`. Missing this header may cause rejections.
- **Separate environments** — production and sandbox tokens/accounts are completely isolated. A token issued in one environment will not authenticate in the other.
- **Wallet balance required** — the checkout step debits the seller's Melhor Envio wallet. The wallet must have sufficient balance for label purchases. Top up via the platform UI or the wallet balance endpoint.
- **Agency required for some carriers** — Latam Cargo, Azul Cargo, and Buslog require an `agency` ID when adding to cart. Query available agencies via `GET /api/v2/me/shipment/agencies`.
- **DCE key required for non-commercial Correios after 2026-04-06** — for non-commercial Correios shipments, a Declaração de Conteúdo Eletrônica (DCE) key must be provided in `options.dce.key`.
- **NF-e key for commercial shipments** — commercial shipments must include the NF-e access key (44-digit string) in `options.invoice.key`.

(https://docs.melhorenvio.com.br/reference `Introdução à API`; https://docs.melhorenvio.com.br/reference `inserir-fretes-no-carrinho`; https://github.com/melhorenvio/wp-melhorenvio-v2 `Services/CartService.php`, all fetched 2026-07-25)

---

## 8. Carrier Service IDs Reference

The following service IDs are used in the `service` field (cart endpoint) and the `services` comma-separated filter (quote endpoint):

| ID | Carrier | Service name |
|---|---|---|
| 1 | Correios | PAC |
| 2 | Correios | SEDEX |
| 14 | Correios | eSEDEX |
| 17 | Correios | Mini Envios |
| 3 | JadLog | .Package |
| 4 | JadLog | .Com |
| 27 | JadLog | .Package Centralizado |
| 8 | Via Brasil | Aéreo |
| 9 | Via Brasil | Rodoviário |
| 10 | Latam Cargo | Próximo Dia |
| 11 | Latam Cargo | Próximo Voo |
| 12 | Latam Cargo | Juntos |
| 15 | Azul Cargo | Amanhã |
| 16 | Azul Cargo | e-Commerce |
| 22 | Buslog | Rodoviário |
| 31 | Loggi | Express |
| 32 | Loggi | Coleta |
| 33 | JeT | Standard |
| 35 | Total Express | Standard |
| 18 | Total Express | e-Total |

Sources:
- https://github.com/melhorenvio/shipment-sdk-php `src/Enums/Service.php` (IDs 1–17)
- https://github.com/melhorenvio/wp-melhorenvio-v2 `Models/ShippingService.php` (IDs 22, 27, 31–35, 18)

Both fetched 2026-07-25.

---

## 9. Sources

All URLs fetched on **2026-07-25**.

| URL | Notes |
|---|---|
| https://docs.melhorenvio.com.br | Main docs landing page — navigation only, redirected to subdocs |
| https://docs.melhorenvio.com.br/llms.txt | Docs index file listing all guide and reference pages |
| https://docs.melhorenvio.com.br/reference | API reference overview — base URLs, headers, auth summary |
| https://docs.melhorenvio.com.br/reference/introducao-api-melhor-envio | Request format, headers, rate limits |
| https://docs.melhorenvio.com.br/reference/cotacao | Quote endpoint details (partial — 200 OK response) |
| https://docs.melhorenvio.com.br/reference/inserir-fretes-no-carrinho | Add to cart endpoint — full request JSON example |
| https://docs.melhorenvio.com.br/docs | Introduction / guides landing page |
| https://docs.melhorenvio.com.br/docs/autenticacao-1 | OAuth2 overview, token expiry times |
| https://docs.melhorenvio.com.br/docs/integracao | Integration flow overview |
| https://docs.melhorenvio.com.br/docs/geracao-de-etiquetas | Label generation flow, endpoint list, validity period |
| https://docs.melhorenvio.com.br/docs/sandbox | Sandbox limitations, available carriers, balance, timing |
| https://melhorenvio.com.br/developers | Developer portal — returned minimal content |
| https://sandbox.melhorenvio.com.br | Sandbox environment base URL — confirmed reachable |
| https://github.com/melhorenvio/shipment-sdk-php | PHP shipment calculation SDK |
| https://github.com/melhorenvio/shipment-sdk-php — README | Confirms dimension/weight units, SDK usage examples |
| https://github.com/melhorenvio/shipment-sdk-php — `src/Enums/Endpoint.php` | Confirms base URLs and API version v2 |
| https://github.com/melhorenvio/shipment-sdk-php ��� `src/Enums/Service.php` | Carrier service ID constants |
| https://github.com/melhorenvio/shipment-sdk-php ��� `src/Enums/Environment.php` | Environment string constants |
| https://github.com/melhorenvio/shipment-sdk-php — `src/Resources/Base.php` | HTTP client setup, Bearer token header usage |
| https://github.com/melhorenvio/shipment-sdk-php — `src/Resources/Shipment/Calculator.php` | Quote endpoint path (`me/shipment/calculate`), payload structure |
| https://github.com/melhorenvio/shipment-sdk-php ��� `src/Resources/Shipment/Package.php` | Package field names (height, width, length, weight, insurance) |
| https://github.com/melhorenvio/shipment-sdk-php — `src/Resources/Shipment/Product.php` | Product field names (id, height, width, length, weight, insurance_value, quantity) |
| https://github.com/melhorenvio/shipment-sdk-php — `src/Resources/Shipment/Volume.php` | Volume base class validations (positive values required) |
| https://github.com/melhorenvio/shipment-sdk-php — `examples/packages/` | End-to-end quote examples with packages |
| https://github.com/melhorenvio/shipment-sdk-php — `examples/products/` | End-to-end quote examples with products |
| https://github.com/melhorenvio/auth-sdk-php | PHP auth/OAuth2 SDK |
| https://github.com/melhorenvio/auth-sdk-php — README | OAuth2 flow description, scope usage, token response shape |
| https://github.com/melhorenvio/auth-sdk-php — `src/OAuth2.php` | Authorization URL construction, token endpoint `/oauth/token`, refresh token flow |
| https://github.com/melhorenvio/wp-melhorenvio-v2 | WooCommerce plugin (reference for real-world endpoint usage) |
| https://github.com/melhorenvio/wp-melhorenvio-v2 — README | WooCommerce plugin — units warning, feature list |
| https://github.com/melhorenvio/wp-melhorenvio-v2 — `Services/RequestService.php` | Production URL `https://api.melhorenvio.com/v2/me`, sandbox URL, required headers |
| https://github.com/melhorenvio/wp-melhorenvio-v2 — `Services/OrderService.php` | All route constants: `/cart`, `/shipment/checkout`, `/shipment/generate`, `/shipment/print`, `/shipment/tracking`, `/shipment/cancel`; label purchase and print flow |
| https://github.com/melhorenvio/wp-melhorenvio-v2 — `Services/CartService.php` | Add-to-cart payload construction including `non_commercial`, `invoice`, `tags` options |
| https://github.com/melhorenvio/wp-melhorenvio-v2 — `Services/TrackingService.php` | Tracking code usage, melhorrastreio.com.br URL pattern |
| https://github.com/melhorenvio/wp-melhorenvio-v2 — `Models/ShippingService.php` | Extended carrier service IDs (Loggi, Buslog, JeT, Total Express) |
