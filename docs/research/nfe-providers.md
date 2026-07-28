# NFe API Providers: Focus NFe vs eNotas (Nota Gateway)

Research for integrating an NFe issuance API into a FastAPI backend for a small Brazilian physical-product e-commerce (~50–200 NFes/month).

> **Note on eNotas naming:** eNotas Gateway has been rebranded as **Nota Gateway** (`notagateway.com.br`). The `docs.enotasgw.com.br` domain now redirects there. Throughout this document "eNotas/Nota Gateway" refers to the same product. The separate `enotas.com.br` product (Emissor) is a no-code auto-emission tool aimed at infoproducers/Hotmart integrations and is **not** an API-first offering suitable for this integration — it is briefly noted in the Pricing section but is otherwise out of scope.

---

## Focus NFe

[focusnfe.com.br](https://focusnfe.com.br/) · Documentation: [doc.focusnfe.com.br](https://doc.focusnfe.com.br/)

### 1. Authentication

Focus NFe uses **HTTP Basic Authentication** (RFC 7617). The token is passed as the username; the password is always an empty string.

```
Authorization: Basic base64("TOKEN_HERE:")
```

```python
import requests, json

r = requests.post(
    "https://homologacao.focusnfe.com.br/v2/nfe",
    params={"ref": "MY_ORDER_123"},
    data=json.dumps(payload),
    auth=("TOKEN_HERE", ""),
)
```

There are two token types ([source](https://forum.focusnfe.com.br/t/autenticacao-e-utilizacao-dos-tokens-da-api-revenda-e-emissao/66)):

- **Revenda (reseller) token** — for managing companies via the reseller API; production only.
- **Revendido / emissão tokens** — per-company tokens that come in *pairs* (one for homologação, one for production); used for actual document issuance.

For a direct-customer integration (not reselling) you work only with the emissão tokens, obtained from the company registration panel.

### 2. Issuing an NFe

**Endpoint:** `POST https://api.focusnfe.com.br/v2/nfe` (production)  
**Endpoint:** `POST https://homologacao.focusnfe.com.br/v2/nfe` (homologação)  
**Query param:** `ref` (string, required) — your unique order reference  
[source](https://doc.focusnfe.com.br/reference/emitir_nfe) · [Python example](https://focusnfe.com.br/exemplos-de-codigos/python/)

Processing is **asynchronous** by default (SEFAZ round-trip). A synchronous mode is available depending on state/account configuration.

#### Emitente fields (top-level)

| Field | Type | Notes |
|---|---|---|
| `cnpj_emitente` | string | Required (or `cpf_emitente`) |
| `nome_emitente` | string | Legal name |
| `nome_fantasia_emitente` | string | Trade name (optional) |
| `logradouro_emitente` | string | |
| `numero_emitente` | string | |
| `bairro_emitente` | string | |
| `municipio_emitente` | string | |
| `uf_emitente` | string | |
| `cep_emitente` | string | |
| `telefone_emitente` | string | |
| `inscricao_estadual_emitente` | string | |
| `regime_tributario_emitente` | integer | 1=SN, 2=SN excesso, 3=Normal |

#### Destinatário fields (top-level)

| Field | Type | Notes |
|---|---|---|
| `nome_destinatario` | string | Required |
| `cpf_destinatario` | string | Required (or `cnpj_destinatario`) |
| `logradouro_destinatario` | string | |
| `numero_destinatario` | string | |
| `bairro_destinatario` | string | |
| `municipio_destinatario` | string | |
| `uf_destinatario` | string | |
| `cep_destinatario` | string | |
| `indicador_inscricao_estadual_destinatario` | integer | 1=contribuinte, 2=isento, 9=não contribuinte |

#### Document-level fields

| Field | Type | Notes |
|---|---|---|
| `natureza_operacao` | string | e.g. "Venda de mercadoria" |
| `data_emissao` | datetime | ISO 8601 |
| `tipo_documento` | integer | 0=entrada, 1=saída |
| `finalidade_emissao` | integer | 1=normal, 2=complementar, 3=ajuste, 4=devolução |
| `consumidor_final` | integer | 0 or 1 |
| `presenca_comprador` | integer | 0–9 |
| `local_destino` | integer | 1=interna, 2=interestadual, 3=exterior |
| `modalidade_frete` | integer | 0=emitente, 1=destinatário, 9=sem frete |
| `valor_produtos` | float | |
| `valor_total` | float | |
| `forma_pagamento` | integer | 0=à vista, 1=a prazo, 2=outros |

#### `items` array (per item)

| Field | Type | Notes |
|---|---|---|
| `numero_item` | integer | Sequential from 1 |
| `codigo_produto` | string | |
| `descricao` | string | |
| `cfop` | string | 4-digit CFOP |
| `unidade_comercial` | string | e.g. "UN" |
| `quantidade_comercial` | number | |
| `valor_unitario_comercial` | number | |
| `valor_bruto` | number | |
| `codigo_ncm` | string | 8-digit NCM |
| `icms_origem` | integer | 0–7 |
| `icms_situacao_tributaria` | string | e.g. "400", "102" |
| `icms_aliquota` | number | When applicable |
| `icms_base_calculo` | number | |
| `icms_valor` | number | |
| `pis_situacao_tributaria` | string | e.g. "07" |
| `pis_base_calculo` | number | |
| `pis_aliquota_porcentual` | number | |
| `pis_valor` | number | |
| `cofins_situacao_tributaria` | string | |
| `cofins_base_calculo` | number | |
| `cofins_aliquota_porcentual` | number | |
| `cofins_valor` | number | |
| `ipi_situacao_tributaria` | string | When IPI applies |
| `ipi_base_calculo` | number | |
| `ipi_aliquota` | number | |
| `ipi_valor` | number | |

Full field reference: [campos.focusnfe.com.br/nfe/NotaFiscalXML.html](https://campos.focusnfe.com.br/nfe/NotaFiscalXML.html)

### 3. Sandbox / Homologação

[source](https://doc.focusnfe.com.br/reference/ambiente)

- **Homologação base URL:** `https://homologacao.focusnfe.com.br/v2/`
- **Production base URL:** `https://api.focusnfe.com.br/v2/`
- Authentication is **identical** in both environments; only the base URL differs.
- Documents issued in homologação carry **no fiscal or tax validity**.
- Emission tokens come in pairs (one per environment) — you use the homologação token with the homologação URL.
- 30-day free trial is available, which effectively serves as an extended sandbox period.

### 4. Webhooks

**Endpoint to create:** `POST https://api.focusnfe.com.br/v2/hooks`  
[source](https://doc.focusnfe.com.br/reference/criar_webhook)

#### Supported NFe events

| Event value | Meaning |
|---|---|
| `nfe` | NFe authorized |
| `nfe_recebida` | NFe received (inbound document) |
| `nfe_recebida_falha_consulta` | Inbound NFe failed to be queried |

Additional events for other document types: `nfce`, `nfse`, `nfse_nacional`, `cte`, `mdfe`, `nfcom`, `dce`, `inutilizacao`.

#### Registration payload

```json
{
  "event": "nfe",
  "url": "https://your-api.com/hooks/nfe",
  "cnpj": "00000000000000",
  "authorization": "Bearer my-secret-token",
  "authorization_header": "Authorization"
}
```

- `authorization` and `authorization_header` are optional but recommended — Focus NFe will include them in every POST to your endpoint.
- **Retry schedule:** on non-2xx response — 1 min, 30 min, 1 h, 3 h, 24 h (5 attempts total).
- Notification is delivered as a JSON POST containing the document data.

### 5. Pricing

[source](https://focusnfe.com.br/precos/)

| Plan | Monthly | Included docs | Overage |
|---|---|---|---|
| Solo | R$89.90 | 100 | R$0.10/doc |
| Start | R$113.90 | 100 per CNPJ (up to 3 CNPJs) | R$0.10/doc |
| Growth | R$548.00 | 4,000 | R$0.12/doc |
| Enterprise | Custom | 50,000+ | Custom |
| Retail | R$59.90 | 500 NFCe + 100 NFe | R$0.05/NFCe, R$0.15/NFe |
| Retail+ | R$629.90 | 9,000 NFCe + 1,000 NFe | Custom |

- **30-day free trial** on all plans; no setup fee; no minimum contract term; cancel anytime.
- Covers: NFe, NFSe, NFCe, CTe, MDFe, NFCom, DCe.
- For ~50–200 NFes/month, the **Solo plan at R$89.90/month** (100 included + R$0.10 each extra) is the entry point. 200 docs/month = R$89.90 + R$10.00 = ~R$100/month.

### 6. Ease of Integration

- **No official Python SDK** exists as a pip package, but Focus NFe provides ready-to-use [Python code examples](https://focusnfe.com.br/exemplos-de-codigos/python/) using the `requests` library — exactly what a FastAPI backend would use.
- Community SDKs exist for PHP, Ruby (unofficial), and there is an APEX integration package on GitHub.
- **Postman collection** available: [postman.com/focusnfe](https://www.postman.com/focusnfe/focus-nfe/documentation/906jrtc/focus-nfe).
- Documentation is comprehensive, well-structured, and has a Markdown/OpenAPI export at `https://doc.focusnfe.com.br/llms.txt` (useful for AI-assisted development).
- Field naming follows a flat snake_case pattern with consistent `_emitente` / `_destinatario` suffixes, making it easy to map to a Pydantic schema.
- Active community forum at [forum.focusnfe.com.br](https://forum.focusnfe.com.br/).

---

## eNotas / Nota Gateway

[notagateway.com.br](https://notagateway.com.br/) (formerly eNotas Gateway at enotas.com.br/product-gateway)  
Documentation: [docs.notagateway.com.br](https://docs.notagateway.com.br/) (redirected from docs.enotasgw.com.br)

> **Important:** There are two distinct eNotas products:
> - **eNotas Emissor** (`enotas.com.br`) — a no-code auto-issuance platform for infoproducers/Hotmart; this is **not** what you'd integrate into a custom backend.
> - **eNotas Gateway / Nota Gateway** — the REST API for developers. This section covers the Gateway product only.

### 1. Authentication

The API uses **API Key authentication via HTTP Basic Auth** — the API key is sent as the username with no password, identical in structure to Focus NFe.

```
Authorization: Basic base64("API_KEY_HERE:")
```

[source](https://docs.notagateway.com.br/reference/autenticação)

The API key is obtained from the Nota Gateway Dashboard. It should be stored in environment variables, never hardcoded.

### 2. Issuing an NFe (v2 API)

**Endpoint:** `POST https://api.notagateway.com.br/v2/empresas/{empresaId}/nf-e`  
[source](https://docs.notagateway.com.br/v2/reference/emitir-nota-fiscal-nfe)

The `empresaId` is the UUID of the registered issuing company in the Nota Gateway dashboard. Note that the emitente is configured at the company level in the dashboard, not per-request — the request body contains the recipient and items only.

#### Core fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Your external ID (idempotency key) |
| `ambienteEmissao` | string | `"Homologacao"` or `"Producao"` |
| `naturezaOperacao` | string | e.g. "Venda de mercadoria" |
| `tipoOperacao` | string | |
| `finalidade` | string | |
| `consumidorFinal` | boolean | |
| `enviarPorEmail` | boolean | |

#### `cliente` object (destinatário)

| Field | Type | Notes |
|---|---|---|
| `tipoPessoa` | string | |
| `nome` | string | |
| `cpfCnpj` | string | |
| `email` | string | |
| `telefone` | string | |
| `indicadorContribuinteICMS` | string | |
| `endereco.uf` | string | |
| `endereco.cidade` | string | |
| `endereco.logradouro` | string | |
| `endereco.numero` | string | |
| `endereco.bairro` | string | |
| `endereco.cep` | string | |

#### `itens` array (per item)

| Field | Type | Notes |
|---|---|---|
| `cfop` | string | |
| `codigo` | string | |
| `descricao` | string | |
| `ncm` | string | 8-digit NCM |
| `quantidade` | number | |
| `unidadeMedida` | string | |
| `valorUnitario` | number | |
| `frete` | number | |
| `impostos.icms.situacaoTributaria` | string | |
| `impostos.icms.origem` | string | |
| `impostos.icms.aliquota` | number | |
| `impostos.icms.baseCalculo` | number | |
| `impostos.pis.situacaoTributaria` | string | |
| `impostos.cofins.situacaoTributaria` | string | |
| `impostos.ipi.situacaoTributaria` | string | (when applicable) |
| `impostos.ibsCbs.classificacaoTributaria` | string | Tax reform field (2026+) |

Note: The `ibsCbs` field relates to the Brazilian Tax Reform (Reforma Tributária) implementation beginning 2026.

#### Additional sections

| Section | Notes |
|---|---|
| `pedido` | Payment method, buyer presence indicator |
| `transporte` | Shipping carrier, vehicle, volumes |
| `informacoesAdicionais` | Free-text additional info |

### 3. Sandbox / Homologação

The environment is controlled **per-request** via the `ambienteEmissao` field in the JSON body (not via a different base URL):

```json
{
  "ambienteEmissao": "Homologacao"
}
```

[source: eNotasGW PHP client v2 README](https://github.com/eNotasGW/php-client-v2)

A dedicated "Como emitir nota fiscal em ambiente de homologação" guide is documented at `docs.notagateway.com.br`. This is a significant difference from Focus NFe: the same endpoint URL and same API key are used for both environments; the mode is specified in the payload.

### 4. Webhooks

Webhooks are configured through the **Nota Gateway Dashboard** (UI-based, not via API endpoint).  
[source](https://docs.notagateway.com.br/v2/docs/webhook)

Configuration parameters:
- **URL** — your endpoint that receives POST notifications
- **Content-Type** — JSON or XML
- **Token** — optional security credential

The token is sent in each notification request header as:
```
x-token: YourTokenHere
```

#### Supported NFe events

| Status | Meaning |
|---|---|
| `Autorizada` | Authorized by SEFAZ |
| `Negada` | Rejected by SEFAZ |
| `Cancelada` | Cancellation approved |
| `CancelamentoNegado` | Cancellation rejected |

#### Webhook payload (NFe)

```json
{
  "tipo": "NF-e",
  "empresaId": "string",
  "nfeId": "string",
  "nfeStatus": "Autorizada",
  "nfeMotivoStatus": null,
  "nfeLinkDanfe": "https://...",
  "nfeLinkXml": "https://...",
  "nfeNumero": "string",
  "nfeSerie": "string",
  "nfeChaveAcesso": "string",
  "nfeDataEmissao": "2026-07-25T00:00:00Z",
  "nfeDataAutorizacao": "2026-07-25T00:00:00Z",
  "nfeNumeroProtocolo": "string",
  "nfeDigestValue": "string"
}
```

`nfeMotivoStatus` is only non-null for `Negada` and `CancelamentoNegado` statuses.

**Retry mechanism:** Up to 15 attempts over approximately 4 hours at progressive intervals, until HTTP 200 is received.

### 5. Pricing

eNotas/Nota Gateway does not publish API pricing publicly on their website. The following is sourced from third-party review platforms:

| Plan | Monthly | Included invoices | Overage |
|---|---|---|---|
| Básico | R$137 | ~60 | R$0.77/doc |
| Plus | R$257 | 500 | R$0.57/doc |
| Profissional | R$347 | 1,500 | R$0.37/doc |
| Business | Custom | 18,000+/year | Custom |

[source: Capterra](https://www.capterra.com/p/197099/eNotas/)

- No public free tier; no self-serve trial visible.
- Annual plans reportedly offer a 25% discount.
- Some third-party sources cite a minimum 6-month contract requirement (for the Nota Gateway API product specifically), though this could not be confirmed from official sources.
- The separate **eNotas Emissor** product (for Hotmart/no-code users) has plans at R$137–R$347/month targeting infoproducers, which overlap in price but serve a different use case.

### 6. Ease of Integration

- **No official Python SDK.** Official clients exist for PHP (`github.com/eNotasGW/php-client` for NFS-e v1 and `github.com/eNotasGW/php-client-v2` for NFe/NFCe v2). Community libraries exist for Ruby and Node.js.
- The **v1 API** covers NFS-e (service invoices); the **v2 API** covers NFe and NFCe (product and consumer invoices). For an e-commerce selling physical products, you use v2.
- Documentation has been migrated from `docs.enotasgw.com.br` to `docs.notagateway.com.br` following the rebrand — old URLs redirect, but this is a friction point.
- JSON field names use camelCase (`cpfCnpj`, `valorUnitario`, `situacaoTributaria`), requiring a different Pydantic schema style than Focus NFe's snake_case.
- Webhook registration is dashboard-only (no API endpoint to register hooks programmatically), which is less automation-friendly.
- Company (emitente) configuration is done once in the dashboard, not per-request — simpler for single-issuer setups but less flexible for multi-tenant scenarios.

---

## Comparison Table

| Dimension | Focus NFe | eNotas / Nota Gateway |
|---|---|---|
| **Auth method** | HTTP Basic Auth — token as username, empty password | HTTP Basic Auth — API key as username, empty password |
| **NFe endpoint** | `POST /v2/nfe` (env determined by base URL) | `POST /v2/empresas/{id}/nf-e` (env set via `ambienteEmissao` in body) |
| **Emitente in request?** | Yes — all emitente fields in every request body | No — emitente configured once in dashboard; only `empresaId` in URL |
| **Field naming convention** | Flat snake_case with `_emitente`/`_destinatario` suffixes | Nested objects, camelCase |
| **Sandbox approach** | Separate base URL (`homologacao.focusnfe.com.br`) + separate token | Same URL/key; `"ambienteEmissao": "Homologacao"` in body |
| **Webhook registration** | Via API (`POST /v2/hooks`) | Dashboard UI only |
| **Webhook auth header** | Custom header name + value (configurable) | Fixed `x-token` header |
| **Webhook retry** | 5 attempts over ~24 hours | 15 attempts over ~4 hours |
| **NFe status events** | `nfe` (authorized); rejection/cancellation inferred | `Autorizada`, `Negada`, `Cancelada`, `CancelamentoNegado` (explicit) |
| **Pricing entry point** | R$89.90/month (100 docs, +R$0.10 each) | ~R$137/month (~60 docs, +R$0.77 each) |
| **Free trial** | 30 days, all plans | Not publicly available |
| **Minimum contract** | None | Reportedly 6 months for Gateway API |
| **Official Python SDK** | No (but official Python examples with `requests`) | No |
| **Official SDKs** | PHP, C#, Ruby (community) | PHP v1 + PHP v2 (official), Ruby/Node (community) |
| **Python examples** | Yes — official page on focusnfe.com.br | No |
| **Documentation quality** | High — structured Mintlify site, OpenAPI spec, LLM-friendly index, active forum | Moderate — rebranding created URL churn; v1 vs v2 split adds confusion |
| **Tax reform (2026) support** | Not yet confirmed in public docs | `ibsCbs.classificacaoTributaria` field already in v2 schema |
| **Processing model** | Async by default, sync optional | Not specified in available docs |
| **Postman collection** | Yes — public | Not found |
| **Community/forum** | Active forum | Developer portal (knowledge base) |

---

## Recommendation

**Recommended provider: Focus NFe**

For a small artisanal e-commerce (~50–200 NFes/month, single CNPJ, selling physical products direct to consumers), Focus NFe is the better fit for the following reasons:

### Cost

At ~100–200 NFes/month, Focus NFe's **Solo plan** costs R$89.90–R$100/month. eNotas/Nota Gateway's entry plan is R$137/month with a significantly higher per-document overage rate (R$0.77 vs R$0.10). Over a full year, the cost difference is approximately R$570–R$700 in Focus NFe's favour — material for a small artisanal brand.

### Python/FastAPI integration effort

Focus NFe publishes official Python code examples that use `requests` — the exact pattern you'd replicate inside a FastAPI route or background task. The flat snake_case field names map cleanly to Pydantic models. There is no equivalent Python guidance from Nota Gateway.

### Sandbox onboarding

Focus NFe's 30-day free trial + separate homologação URL is the standard developer-friendly approach. You can register, get tokens, and issue test NFes without a sales conversation. Nota Gateway does not advertise a comparable self-serve trial.

### Webhook flexibility

Focus NFe's webhook registration is **via API**, meaning you can provision hooks programmatically (useful for CI/CD or multi-environment setups). The configurable auth header allows you to send a secret token or Bearer token to your FastAPI endpoint. Nota Gateway's dashboard-only webhook setup is less infrastructure-friendly.

### Documentation

Focus NFe's documentation is well-structured, actively maintained, and has a public Postman collection and an OpenAPI/Markdown index. The forum provides real-world troubleshooting examples. Nota Gateway's docs have undergone a rebrand migration and the v1/v2 split creates friction when searching for NFe (product) specifics.

### When to reconsider

Nota Gateway may be worth revisiting if:
- You need to issue both NFe (product) and NFSe (service) from the same integration — Nota Gateway's single API covers both document families cleanly.
- You require the tax reform (`ibsCbs`) fields ahead of the mandatory 2026 deadline and Focus NFe has not yet released them.
- Volume grows significantly (>4,000 docs/month) and Nota Gateway negotiates better per-document pricing at that scale.

---

## Integration Sketch (Focus NFe + FastAPI)

```python
# backend/app/services/nfe_service.py
import httpx, os

FOCUS_TOKEN = os.environ["FOCUS_NFE_TOKEN"]
FOCUS_BASE = os.environ.get(
    "FOCUS_NFE_BASE_URL", "https://homologacao.focusnfe.com.br/v2"
)

async def emitir_nfe(ref: str, payload: dict) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{FOCUS_BASE}/nfe",
            params={"ref": ref},
            json=payload,
            auth=(FOCUS_TOKEN, ""),
            timeout=30,
        )
        r.raise_for_status()
        return r.json()
```

Webhook handler in FastAPI (verify optional auth header):

```python
# backend/app/api/v1/webhooks.py
from fastapi import APIRouter, Request, Header, HTTPException
import os

router = APIRouter()
WEBHOOK_SECRET = os.environ["FOCUS_WEBHOOK_SECRET"]

@router.post("/hooks/nfe")
async def handle_nfe_webhook(
    request: Request,
    authorization: str = Header(None),
):
    if authorization != f"Bearer {WEBHOOK_SECRET}":
        raise HTTPException(status_code=401)
    data = await request.json()
    status = data.get("status")   # e.g. "autorizada"
    ref = data.get("ref")
    # update order record based on ref + status
    return {"ok": True}
```

---

*Research conducted 2026-07-25. Sources: [Focus NFe docs](https://doc.focusnfe.com.br/), [Focus NFe pricing](https://focusnfe.com.br/precos/), [Focus NFe Python examples](https://focusnfe.com.br/exemplos-de-codigos/python/), [Focus NFe forum — token auth](https://forum.focusnfe.com.br/t/autenticacao-e-utilizacao-dos-tokens-da-api-revenda-e-emissao/66), [Nota Gateway docs](https://docs.notagateway.com.br/), [Nota Gateway NFe v2 endpoint](https://docs.notagateway.com.br/v2/reference/emitir-nota-fiscal-nfe), [Nota Gateway webhooks](https://docs.notagateway.com.br/v2/docs/webhook), [eNotasGW PHP client v2](https://github.com/eNotasGW/php-client-v2), [eNotas pricing — Capterra](https://www.capterra.com/p/197099/eNotas/), [Notaas.com.br comparison](https://www.notaas.com.br/blog/post/comparativo-5-apis-para-emissao-de-nfe-nfse-e-nfce-2025).*
