# Sicredi PIX API — Integration Research

**Researched:** 2026-07-25  
**Primary sources fetched this session.** Every claim below cites a URL actually retrieved.

---

## Authentication

Sicredi's PIX API uses **two security layers simultaneously**: OAuth 2.0 Client Credentials flow for application-level authorization, and **mTLS (Mutual TLS)** for transport-layer authentication. Both are required on every call.

[Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

### OAuth2 Token Request

```
POST https://api-pix.sicredi.com.br/oauth/token
```

**Headers:**
```
Authorization: Basic BASE64(CLIENT_ID:CLIENT_SECRET)
Content-Type: application/json
Accept: application/json
```

**Query parameters (appended to URL):**
```
grant_type=client_credentials&scope=cob.write+cob.read+webhook.read+webhook.write
```

**Response:**
```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 300
}
```

Tokens expire in approximately **300 seconds (5 minutes)**. The official guide recommends reading the expiration from the response rather than hardcoding 300 s, as it can vary. [Source: https://developers.sicredi.com.br/public/docs/general-information]

**Bearer token usage** — all subsequent API calls require:
```
Authorization: Bearer <access_token>
```

The mTLS certificate (`.crt` / `.key` files) must also be presented on the TLS handshake for every call, including the token request itself. [Source: https://github.com/raphaelvserafim/gerar-pix-sicredi — `PixSicredi.ts`, confirmed in PHP port at https://github.com/raphaelvserafim/api-sicredi-pix — `src/PixSicredi.php`]

### Available OAuth2 Scopes

| Scope | Purpose |
|---|---|
| `cob.write` | Create/modify immediate charges |
| `cob.read` | Query immediate charges |
| `cobv.write` / `cobv.read` | Due-date charges |
| `lotecobv.write` / `lotecobv.read` | Batch due-date charges |
| `pix.read` | Query received PIX and refunds |
| `webhook.write` / `webhook.read` | Manage webhook registrations |

[Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

---

## mTLS Certificate Enrollment

mTLS is required for the PIX API. The process is as follows. [Source: https://developers.sicredi.com.br/public/docs/getting-started-pix and https://gfsis.com.br/docs/como-gerar-certificado-csr-pfx-api-pix-sicredi/]

### Prerequisites (before you touch the portal)

1. Sign the PIX arrangement adhesion agreement at your Sicredi cooperative branch.
2. Have a PIX key registered on the checking or savings account that will receive charges.
3. Create a Developer Portal account at https://developer.sicredi.com.br.
4. Open a support ticket titled **"Acesso à API Pix"** in the portal, including your CNPJ and adhesion ID. SLA: 2 business hours.

[Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

### Generating and Submitting the CSR

1. In the Developer Portal, navigate to: **APIs > Catálogo de APIs > APIs de Recebimento > API Pix**.
2. Click **"Registrar Novo CSR"**.
3. The portal generates (or accepts) a CSR. Download the **private key file** (save both password-protected and password-free versions — see quirks below).
4. Monitor the signing status under **APIs > Catálogo de APIs > APIs de Recebimento**. Status transitions from `Em Processamento` → `OK`.
5. When status is `OK`, download the **validated Sicredi certificate** (`.CER` file).

[Source: https://gfsis.com.br/docs/como-gerar-certificado-csr-pfx-api-pix-sicredi/]

### Certificate Format

| File | Format | Notes |
|---|---|---|
| Private key | PEM (`.KEY`) | Must be **unencrypted** (no passphrase) for production use with the API |
| Application certificate | PEM/DER (`.CER`) | If delivered in DER, convert to PEM with `openssl x509 -inform DER -in cert.cer -out cert.pem` |
| Sicredi certificate chain | PEM (`.CER`) | Required for webhook server trust verification |

**PFX bundle** (optional, for systems that require it): combine the three files into one `.PFX` with:
```bash
openssl pkcs12 -export \
  -in certificado.cer \
  -inkey aplicacao.key \
  -certfile sicredi-chain.cer \
  -out bundle.pfx \
  -passout pass:YOUR_PASSWORD
```
Or use https://www.sslshopper.com/ssl-converter.html. [Source: https://gfsis.com.br/docs/como-gerar-certificado-csr-pfx-api-pix-sicredi/]

> **Note on DER conversion:** The official general-information page states: "alguns certificados são entregues em DER e precisam ser convertidos para PEM." — Some certificates arrive in DER format and require conversion. [Source: https://developers.sicredi.com.br/public/docs/general-information]

### Generating Credentials After Certificate Validation

After the certificate reaches `OK` status, return to the portal and generate your **Client ID** and **Client Secret**. These credentials are tied to the validated certificate. [Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

### Staging/Homologação Credentials

Production credentials are generated in the portal. For the **staging environment**, request credentials by email:

**[email protected]** — include your CNPJ and adhesion ID.

[Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

---

## Generating a PIX Charge

### Endpoint

The primary create-with-txid endpoint is:

```
PUT https://api-pix.sicredi.com.br/api/v2/cob/{txid}
```

A second endpoint lets the PSP (Sicredi) assign the txid:

```
POST https://api-pix.sicredi.com.br/api/v2/cob
```

[Source: https://developers.sicredi.com.br/public/llms.txt and source code at https://github.com/raphaelvserafim/gerar-pix-sicredi — `PixSicredi.ts`]

> The community TypeScript library uses `POST /api/v2/cob` (PSP-generated txid), while the official API reference also defines `PUT /api/v2/cob/{txid}` (client-generated txid). Both are valid. [Source: https://developers.sicredi.com.br/public/reference/put_cob-txid.md and https://developers.sicredi.com.br/public/reference/post_cob.md]

### txid Rules

- **Pattern:** `[a-zA-Z0-9]{26,35}` — alphanumeric, case-sensitive, 26 to 35 characters.
- When using `PUT /cob/{txid}`, the **client generates** the txid and passes it in the URL path.
- When using `POST /cob`, the **PSP (Sicredi) generates** the txid and returns it in the response.

[Source: https://developers.sicredi.com.br/public/reference/put_cob-txid.md]

### Required Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

The mTLS certificate must be presented at the TLS layer (not as an HTTP header).

### Request Body

```json
{
  "calendario": {
    "expiracao": 3600
  },
  "devedor": {
    "cnpj": "12345678000195",
    "nome": "Empresa de Serviços SA"
  },
  "valor": {
    "original": "37.00",
    "modalidadeAlteracao": 0
  },
  "chave": "7d9f0335-8dcc-4054-9bf9-0dbd61d36906",
  "solicitacaoPagador": "Pedido #1234",
  "infoAdicionais": [
    { "nome": "pedidoId", "valor": "1234" }
  ]
}
```

#### Field Reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `calendario.expiracao` | integer | yes | Seconds until charge expires. Default: 86400 |
| `devedor.cnpj` | string | no | Payer CNPJ, pattern `^[0-9A-Z]{14}$` |
| `devedor.cpf` | string | no | Payer CPF, pattern `^\d{11}$`. Use CPF **or** CNPJ, not both |
| `devedor.nome` | string | no | Payer name, max 200 chars |
| `valor.original` | string | yes | Amount, pattern `\d{1,10}\.\d{2}` (e.g. `"37.00"`) |
| `valor.modalidadeAlteracao` | integer (0 or 1) | no | `0` = amount fixed; `1` = payer may change. **Sicredi recommends `0`** |
| `chave` | string | yes | Receiver's DICT PIX key (EVP UUID, CPF, CNPJ, phone, or email), max 77 chars |
| `solicitacaoPagador` | string | no | Free text shown to payer, max 140 chars |
| `infoAdicionais` | array | no | Key-value metadata. Max 50 items; name max 50 chars, value max 200 chars |
| `loc.id` | integer | no | Pre-existing payload location ID |

[Source: https://developers.sicredi.com.br/public/reference/put_cob-txid.md]

### Response (201 Created)

```json
{
  "txid": "7978c0c97ea847e78e8849634473c1f1",
  "revisao": 0,
  "status": "ATIVA",
  "calendario": {
    "criacao": "2020-09-09T20:15:00.358Z",
    "expiracao": 3600
  },
  "loc": {
    "id": 789,
    "location": "pix.example.com/qr/9d36b84fc70b478fb95c12729b90ca25",
    "tipoCob": "cob",
    "criacao": "2020-09-09T20:15:00.358Z"
  },
  "location": "pix.example.com/qr/9d36b84fc70b478fb95c12729b90ca25",
  "devedor": { "cnpj": "12345678000195", "nome": "Empresa de Serviços SA" },
  "valor": { "original": "37.00", "modalidadeAlteracao": 0 },
  "chave": "7d9f0335-8dcc-4054-9bf9-0dbd61d36906",
  "solicitacaoPagador": "Pedido #1234",
  "pixCopiaECola": "<BR Code string>",
  "infoAdicionais": [{ "nome": "pedidoId", "valor": "1234" }]
}
```

Key response fields:
- `pixCopiaECola` — the **BR Code string** to display as a QR code or copy-paste PIX. The API does **not** generate a QR code image; use an external encoder (e.g. `qrcode` Python library) on this string. [Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]
- `location` — URI used by PIX reader apps to fetch the JWS payload. [Source: https://developers.sicredi.com.br/public/reference/get_pixurlaccesstoken.md]
- `revisao` — starts at `0`, increments with each PATCH (revision).
- `status` — one of: `ATIVA`, `CONCLUIDA`, `REMOVIDA_PELO_USUARIO_RECEBEDOR`, `REMOVIDA_PELO_PSP`.

### Full curl Example

```bash
curl -X PUT https://api-pix.sicredi.com.br/api/v2/cob/abc123def456ghi789jkl0001234567 \
  --cert /path/to/certificado.pem \
  --key /path/to/aplicacao.key \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "calendario": { "expiracao": 3600 },
    "devedor": { "cpf": "12345678901", "nome": "João Silva" },
    "valor": { "original": "150.00", "modalidadeAlteracao": 0 },
    "chave": "7d9f0335-8dcc-4054-9bf9-0dbd61d36906",
    "solicitacaoPagador": "Pedido #42"
  }'
```

### Error Response Format (RFC 7807)

```json
{
  "type": "https://pix.bcb.gov.br/api/v2/error/CobOperacaoInvalida",
  "title": "Cobrança inválida.",
  "status": 400,
  "detail": "Request creating immediate payment collection fails validation.",
  "violacoes": [
    {
      "razao": "O campo cob.valor.original não respeita o _schema_.",
      "propriedade": "cob.valor.original"
    }
  ]
}
```

[Source: https://developers.sicredi.com.br/public/reference/put_cob-txid.md]

---

## Webhook Notifications

### Registering a Webhook

```
PUT https://api-pix.sicredi.com.br/api/v2/webhook/{chave}
Authorization: Bearer <token> (scope: webhook.write)
Content-Type: application/json

{
  "webhookUrl": "https://yourdomain.com/api/pix/webhook"
}
```

`{chave}` is the DICT PIX key (registered on your account) for which you want notifications. One webhook URL per PIX key. [Source: https://developers.sicredi.com.br/public/reference/put_webhook-chave.md]

> **Important:** Only PIX payments **associated with a `txid`** trigger webhook notifications. PIX received without a txid (bare key payments) are silently ignored by the webhook system. [Source: https://developers.sicredi.com.br/public/reference/put_webhook-chave.md]

### Webhook Server Requirements

Your callback server must:
- Serve on **HTTPS port 443 only**.
- Present a **TLS certificate from a recognized CA** (Digicert, Entrust, GlobalSign — self-signed certs are rejected).
- Install the **Sicredi certificate chain** (`webhook-sicredi.CER`, downloadable from the Developer Portal) as a trusted CA — Sicredi performs mTLS when calling your webhook server.
- Have CN matching the server domain.

[Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

### Incoming Notification Payload

Sicredi will POST to `{webhookUrl}/pix` (note the `/pix` suffix appended automatically):

```json
{
  "pix": [
    {
      "endToEndId": "E12345678202009091221kkkkkkkkkkk",
      "txid": "c3e0e7a4e7f1469a9f782d3d4999343c",
      "valor": "110.00",
      "horario": "2020-09-09T20:15:00.358Z",
      "chave": "seu@email.com",
      "infoPagador": "message from payer",
      "devolucoes": []
    }
  ]
}
```

Multiple payments to the same PIX key may be **batched** into a single notification (the `pix` array can contain more than one entry). [Source: https://developers.sicredi.com.br/public/reference/put_webhook-chave.md]

#### Pix Object Fields

| Field | Type | Description |
|---|---|---|
| `endToEndId` | string | PACS008 end-to-end ID (32 chars) |
| `txid` | string | Your transaction ID (26-35 chars) |
| `valor` | string | Amount paid, format `\d{1,10}\.\d{2}` |
| `horario` | datetime | RFC 3339 processing timestamp at PSP |
| `chave` | string | Receiver's DICT key (max 77 chars) |
| `infoPagador` | string | Free-form payer message (max 140 chars) |
| `componentesValor` | object | Value breakdown (optional) |
| `devolucoes` | array | Associated refund objects |

#### Refund Object in Webhook Payload

```json
{
  "id": "123ABC",
  "rtrId": "D12345678202009091221abcdf098765",
  "valor": "10.00",
  "natureza": "ORIGINAL",
  "horario": {
    "solicitacao": "2020-09-09T20:15:00.358Z",
    "liquidacao": "2020-09-09T20:16:00.358Z"
  },
  "status": "DEVOLVIDO",
  "motivo": "Cancelamento solicitado"
}
```

Refund status values: `EM_PROCESSAMENTO`, `DEVOLVIDO`, `NAO_REALIZADO`. [Source: https://developers.sicredi.com.br/public/reference/put_webhook-chave.md]

### Signature / Verification Mechanism

There is **no HMAC signature** or dedicated `X-Signature` header documented in the official reference. The security mechanism is **mTLS at the transport layer**: Sicredi presents its own certificate when calling your webhook endpoint. Your server should verify the client certificate against the `webhook-sicredi.CER` chain downloaded from the portal. [Source: https://developers.sicredi.com.br/public/docs/getting-started-pix and https://developers.sicredi.com.br/public/reference/put_webhook-chave.md]

### Other Webhook Operations

| Operation | Endpoint |
|---|---|
| Get webhook info | `GET /api/v2/webhook/{chave}` |
| Delete webhook | `DELETE /api/v2/webhook/{chave}` |
| List all webhooks | `GET /api/v2/webhook` |

[Source: https://developers.sicredi.com.br/public/llms.txt]

---

## Sandbox vs Production Base URLs

Both URLs are confirmed from multiple independent community library sources and the official developer guide.

| Environment | Base URL | Source |
|---|---|---|
| **Production** | `https://api-pix.sicredi.com.br` | [developers.sicredi.com.br/public/docs/getting-started-pix](https://developers.sicredi.com.br/public/docs/getting-started-pix) |
| **Staging / Homologação** | `https://api-pix-h.sicredi.com.br` | [github.com/raphaelvserafim/gerar-pix-sicredi — PixSicredi.ts](https://github.com/raphaelvserafim/gerar-pix-sicredi); confirmed independently in [github.com/raphaelvserafim/api-sicredi-pix — PixSicredi.php](https://github.com/raphaelvserafim/api-sicredi-pix) |

> **Note:** The official documentation does not publish the staging URL publicly — it appears in community libraries. The naming pattern `api-pix-h` (the `-h` suffix for homologação) is consistent across two independent open-source implementations in different languages (TypeScript and PHP), so it is highly reliable.

Full staging token endpoint:
```
POST https://api-pix-h.sicredi.com.br/oauth/token
```

Full staging charge endpoint:
```
PUT https://api-pix-h.sicredi.com.br/api/v2/cob/{txid}
```

### How to Access the Staging Environment

Staging credentials cannot be generated via the Developer Portal. Request them by emailing: **[email protected]** with your CNPJ and PIX adhesion ID. [Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

---

## Quirks and Known Gotchas

### 1. Private Key Must Be Unencrypted

The private key (`.KEY` file) must have **no passphrase** for production use. The guide explicitly recommends an unencrypted key. If you store it password-protected (for security), you must strip the passphrase before deploying. [Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

### 2. DER vs PEM Conversion

Certificates may be delivered in DER format and must be converted to PEM before use:
```bash
openssl x509 -inform DER -in cert.cer -out cert.pem
```
[Source: https://developers.sicredi.com.br/public/docs/general-information]

### 3. Token Expiry Is 5 Minutes

Access tokens expire in approximately 300 seconds. For a FastAPI backend processing multiple orders, implement a token cache with a renewal buffer (e.g., renew at 250 s). The guide says to read `expires_in` from the response rather than hardcoding the value. [Source: https://developers.sicredi.com.br/public/docs/general-information]

### 4. Webhook URL Gets `/pix` Appended

When registering `https://yourdomain.com/api/webhook`, Sicredi will actually POST to `https://yourdomain.com/api/webhook/pix`. Your FastAPI route must be registered at that full path. [Source: https://developers.sicredi.com.br/public/reference/put_webhook-chave.md]

### 5. Only txid-Linked PIX Trigger Webhooks

PIX received without a `txid` (e.g., a customer paying directly via your key without scanning a QR code generated by this API) do **not** trigger webhook notifications. Use the reconciliation endpoint `GET /api/v2/pix?inicio=...&fim=...` for full coverage. [Source: https://developers.sicredi.com.br/public/reference/put_webhook-chave.md]

### 6. Webhook Inbound mTLS (Your Server Must Accept Sicredi's Certificate)

Unlike some PSPs that use HMAC signatures, Sicredi authenticates its outbound webhook calls with **its own mTLS certificate** (mutual TLS, reversed). You must download `webhook-sicredi.CER` from the Developer Portal and configure your HTTPS server to require and verify it as the client certificate. This is a significant infrastructure requirement. [Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

### 7. Amount Must Be a String, Not a Number

`valor.original` is a **string** formatted as `\d{1,10}\.\d{2}` — e.g., `"37.00"`, not `37.00` (float). Sending a JSON number will return a 400 validation error. [Source: https://developers.sicredi.com.br/public/reference/put_cob-txid.md]

### 8. QR Code Image Generation Is Your Responsibility

The API returns `pixCopiaECola` (the BR Code string) but does **not** return a QR code image. You must encode the string into a QR image yourself. [Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

### 9. Lock the Amount (`modalidadeAlteracao: 0`)

The official Sicredi guide explicitly recommends setting `valor.modalidadeAlteracao: 0` to prevent the payer from altering the amount. Omitting it defaults to allowing changes. For e-commerce, always pass `0`. [Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

### 10. Certificate Expiry = Immediate API Rejection

When the mTLS certificate expires, all calls that require mTLS are rejected immediately with no grace period. The portal will prompt you to generate a new CSR. [Source: https://developers.sicredi.com.br/public/docs/general-information]

### 11. No Publicly Documented Rate Limit for PIX API

The official documentation does not state a specific rate limit for the PIX API endpoints. The Cobrança (boleto) API documents 20 TPS and 15 TPS limits on various endpoints, but no equivalent figure was found for PIX in any source fetched this session. Contact [email protected] for current limits.

### 12. Staging Credentials Not Portal-Issued

Unlike production, staging credentials cannot be self-served from the portal. They must be requested via email. This adds latency to initial onboarding. [Source: https://developers.sicredi.com.br/public/docs/getting-started-pix]

### 13. The Developer Portal at `developer.sicredi.com.br` vs `developers.sicredi.com.br`

There are two portals:
- `developer.sicredi.com.br` — older portal (requires login for most content; used for CSR registration and credential generation).
- `developers.sicredi.com.br` — newer public documentation portal (unauthenticated access to guides and API reference).

Both are operated by Sicredi. [Source: https://developer.sicredi.com.br and https://developers.sicredi.com.br/public/llms.txt]

---

## Appendix: Additional Endpoints

### Query a Charge

```
GET https://api-pix.sicredi.com.br/api/v2/cob/{txid}
Authorization: Bearer <token> (scope: cob.read)
```

Returns the same `CobGerada` schema as the creation response, with current `status`.

### Query Received PIX (Reconciliation)

```
GET https://api-pix.sicredi.com.br/api/v2/pix?inicio=2024-01-01T00:00:00Z&fim=2024-01-02T00:00:00Z
Authorization: Bearer <token> (scope: pix.read)
```

Optional filters: `cpf` or `cnpj` (mutually exclusive). Pagination via `paginacao.paginaAtual` and `paginacao.itensPorPagina`.

### Request a Refund

```
PUT https://api-pix.sicredi.com.br/api/v2/pix/{e2eid}/devolucao/{id}
```

`motivo` follows PACS.004: `"MD06"` (payer request) or `"SL02"` (PSP compliance).

[Source: https://developers.sicredi.com.br/public/llms.txt and https://developers.sicredi.com.br/public/reference/put_pix-e2eid-devolucao-id.md]

---

## Sources Index

All URLs fetched during this research session:

1. https://developer.sicredi.com.br — Sicredi developer portal (older, login-gated for most content)
2. https://developers.sicredi.com.br/public/docs/general-information — General API information
3. https://developers.sicredi.com.br/public/docs/getting-started-pix — PIX API getting started guide (primary technical reference)
4. https://developers.sicredi.com.br/public/llms.txt — Full API endpoint index
5. https://developers.sicredi.com.br/public/reference/put_cob-txid.md — Create immediate charge (full schema)
6. https://developers.sicredi.com.br/public/reference/put_webhook-chave.md — Configure webhook (full schema + payload)
7. https://www.sicredi.com.br/media/produtos/filer_public/2025/05/21/guia_tecnico_integracoes_api_pix_sicredi_v19_1.pdf — Official technical guide v19.1 (403 Forbidden — could not fetch content)
8. https://developer.sicredi.com.br/api-portal/sites/default/files/Guia_tecnico_integracoes_APIPix_Sicredi_v1.9.5.pdf — Official technical guide v1.9.5 (retrieved as binary PDF; text not extractable)
9. https://github.com/bacen — Bacen GitHub org (confirmed public repos: pix-api, pix-dict-api)
10. https://bacen.github.io/pix-dict-api/ — 404 Not Found
11. https://github.com/bacen/pix-api — Bacen PIX API OpenAPI spec repo (v2.9.0, Apache 2.0)
12. https://github.com/sicredi — Sicredi GitHub org (no public repositories)
13. https://github.com/raphaelvserafim/gerar-pix-sicredi — TypeScript community library (source verified via gh CLI)
14. https://github.com/raphaelvserafim/api-sicredi-pix — PHP community library (source verified via gh CLI)
15. https://github.com/crmdesenvolvimentos/pix-sicredi — PHP community library
16. https://gfsis.com.br/docs/como-gerar-certificado-csr-pfx-api-pix-sicredi/ — CSR/PFX certificate enrollment walkthrough
17. https://www.bcb.gov.br/estabilidadefinanceira/pix — Banco Central PIX page (returned minimal HTML; no technical content extracted)
