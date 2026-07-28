# NF-e Strategy: Decision Guide for Carolina Viapiana

```
date:   2026-07-27
status: final
scope:  fiscal document emission strategy — provider landscape, MEI constraints,
        SEFAZ-PR direct integration, and provider recommendation
```

> **Scope note.** This document is a strategic overview and decision guide. It does not duplicate the deep API integration details (auth flows, field schemas, Python code, webhook payloads) already captured in [nfe-providers.md](./nfe-providers.md). Read that file alongside this one.

---

## Background: The MEI Constraint — Read This First

Before evaluating any provider, the fiscal regime of the issuing company determines what is even legally possible.

**MEI (Microempreendedor Individual) cannot emit NF-e for product sales in Paraná.**

Eight states restrict or prohibit MEI from issuing standard NF-e (model 55) for merchandise: Bahia, Minas Gerais, Pará, **Paraná**, Rio de Janeiro, Rio Grande do Sul, Santa Catarina, and Espírito Santo. The restriction stems from the DAS-based fiscal exemption inherent to the MEI regime — the state interprets that a taxpayer with blanket ICMS exemption cannot simultaneously be an authorized NF-e emitter. [Source: Soften Sistemas — MEI não pode emitir NF-e](https://blog.softensistemas.com.br/post/mei-nao-pode-emitir-nfe)

### What MEI in Paraná can do instead

- **NFA-e (Nota Fiscal Avulsa Eletrônica)** — issued directly through the SEFAZ-PR portal; no digital certificate required for the MEI. Designed for one-off, exceptional operations (e.g., a single B2B sale). It is explicitly **not intended for continuous, high-volume e-commerce emission**. [Source: SEFAZ-PR — NFA-e para MEI](https://atendimento.fazenda.pr.gov.br/sacsefa/portal/assuntosReferente/21)
- **NFS-e (service invoice)** — only valid if the MEI's CNAE covers services, not product sales.

### The structural solution: migrate to ME (Microempresa)

A ME (Microempresa) under Simples Nacional — with active state registration (inscrição estadual) and an ICP-Brasil digital certificate (e-CNPJ A1 or A3) — can emit standard NF-e for product sales in Paraná with no restrictions. The ME billing ceiling is R$360,000/year (vs. R$81,000 for MEI), which is appropriate for a growing e-commerce. [Source: Secretaria da Fazenda-PR — Microempresas Simples Nacional](https://www.fazenda.pr.gov.br/Pagina/Microempresas-Simples-Nacional)

**Practical implication for this project:** NF-e integration should be built targeting ME status. If Carolina Viapiana is currently MEI, the fiscal integration is a blocker until the CNPJ is migrated — but the code can be developed and tested in homologação in the meantime.

---

## Direct SEFAZ-PR Integration

### What it is

Issuing NF-e directly against SEFAZ-PR SOAP webservices, without a third-party API in between. The software signs the XML with the company's digital certificate and transmits it to the state's endpoints.

### Certificate requirements

- **ICP-Brasil digital certificate**, model A1 (software) or A3 (hardware token / smartcard), scoped to the issuing CNPJ.
- The certificate signs each NF-e XML document before transmission. It must be renewed periodically (A1: annual; A3: up to 3 years).
- Credentialing at SEFAZ-PR is **free** and is done via the state revenue portal (UPD → Autorização de Uso). The issuing software's system code must be registered and confirmed by the software provider. [Source: Soften Sistemas — Credenciamento NF-e Paraná](https://blog.softensistemas.com.br/post/credenciamento-emissor-nfe-parana)

### NF-e v4.00 webservice endpoints for Paraná

The base domain is `nfe.sefa.pr.gov.br`. All endpoints use SOAP; append `?wsdl` to retrieve the WSDL. [Source: SPED-PR — Endereços v4.00](https://sped.fazenda.pr.gov.br/NFe/Pagina/Enderecos-dos-ambientes-de-homologacao-e-producao-Versao-400)

| Service | Production | Homologação |
|---|---|---|
| Autorização | `https://nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4` | `https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeAutorizacao4` |
| Ret. Autorização | `https://nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4` | `https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRetAutorizacao4` |
| Consulta Protocolo | `https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4` | `https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4` |
| Recepção Evento | `https://nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4` | `https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeRecepcaoEvento4` |
| Status Serviço | `https://nfe.sefa.pr.gov.br/nfe/NFeStatusServico4` | `https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeStatusServico4` |
| Consulta Cadastro | `https://nfe.sefa.pr.gov.br/nfe/CadConsultaCadastro4` | `https://homologacao.nfe.sefa.pr.gov.br/nfe/CadConsultaCadastro4` |

### Why direct integration is not recommended here

| Factor | Impact |
|---|---|
| XML layout complexity | NF-e XML schema (NT 2024.001 and onward) is a 600+ field SOAP document. Generating it correctly for all edge cases (ICMS CST, PIS/COFINS comb., IPI, freight, tax reform IBS/CBS from 2026) requires a dedicated fiscal library. |
| DANFE rendering | The PDF receipt (DANFE) must be generated separately; no SEFAZ service renders it. |
| Certificate management | Rotation, storage (HSM or encrypted file), revocation handling — all become application concerns. |
| Contingency mode | When SEFAZ is offline, NF-e must be issued in contingency (EPEC or offline mode) and later transmitted — complex state machine. |
| Tax table maintenance | NCM, CFOP, ICMS CST, CEST tables change; the application must stay current. |
| Zero cost advantage | SEFAZ endpoints are free but the engineering cost of a correct, production-grade implementation is measured in weeks to months. At 50–200 NFes/month, the economics strongly favour a managed API. |

Direct integration makes sense for ISVs building fiscal software for resale, not for a single-brand e-commerce at this volume.

---

## Provider Landscape

### 1. Focus NFe

Full deep-dive: [nfe-providers.md § Focus NFe](./nfe-providers.md#focus-nfe)

- Entry plan: **R$89.90/month** (100 docs, +R$0.10 each) ([source](https://focusnfe.com.br/precos/))
- NF types: NF-e, NFCe, NFS-e, CTe, MDFe, NFCom, DCe
- Python: official examples with `requests`; community pip package `admdocbr/focusnfe` (type-safe Pydantic models, install via `uv add focusnfe`); no official SDK
- Sandbox: separate homologação URL + 30-day free trial; authentication is identical — only token and base URL differ
- SLA: urgent issues 2h response / 8h resolution; high 4h / 2 days; medium 1 day / 5 days; support hours Mon–Fri 08:30–18:30 ([source](https://focusnfe.com.br/sla-acordo-de-nivel-de-servico/))
- Differentiator: lowest entry price, Python examples, API webhook registration, active community forum, no minimum contract

### 2. eNotas / Nota Gateway

Full deep-dive: [nfe-providers.md § eNotas / Nota Gateway](./nfe-providers.md#enotas--nota-gateway)

- Entry plan: **~R$137/month** (~60 docs, +R$0.77 each); reportedly 6-month minimum contract
- NF types: NF-e, NFCe, NFS-e (v2 API covers products)
- Python: no official SDK, no official examples
- Sandbox: same endpoint; controlled via `ambienteEmissao` field in body; no public free trial
- Differentiator: dashboard-managed emitente setup; already has `ibsCbs` (tax reform) fields in v2 schema

### 3. Nuvem Fiscal

**Status: DISCONTINUED — service ends 31 July 2026.**

Nuvem Fiscal announced on 22 April 2026 that it will deactivate its service on 31 July 2026, with migration recommended to ACBr-based solutions. [Source: Projeto ACBr community announcement](https://www.projetoacbr.com.br/forum/topic/91922-comunicado-de-desativa%C3%A7%C3%A3o-do-servi%C3%A7o-nuvem-fiscal-22042026/) / [Source: Nuvem Fiscal support](https://suporte.nuvemfiscal.com.br/t/encerramento-do-suporte-nuvemfiscal-e-migracao-para-o-acbr/5347)

**Do not integrate Nuvem Fiscal.** It is included in the comparison table only for completeness.

### 4. NFe.io

[nfe.io](https://nfe.io/) — NF-e pricing page: [nfe.io/precos/emissao-nfe/](https://nfe.io/precos/emissao-nfe/)

NFe.io offers NF-e (product), NFS-e (service), and NFC-e (consumer) via REST API with sandbox, documented developer onboarding, and multi-CNPJ support at no extra cost.

**Pricing (monthly, NF-e product):**

| Plan | Monthly | Included docs |
|---|---|---|
| Inicial | ~R$90/month (annual only — R$1,075/year) | 100/month, 2 CNPJs |
| Base | R$190/month | 250 |
| Crescimento | R$265/month | 500 |
| Escala | R$375/month | 1,000 |
| Enterprise | Custom | Custom |

Semester plans carry a 10% discount; annual plans carry 20%. No public overage rate disclosed. [Source: nfe.io/precos/emissao-nfe/](https://nfe.io/precos/emissao-nfe/)

- NF types: NF-e, NFS-e, NFC-e
- Python: not mentioned; REST API with documentation
- Sandbox: yes — "ambiente de teste totalmente seguro e funcional" documented
- Differentiator: GNRE generation and state registry queries bundled into higher plans; strong onboarding support

**Assessment:** The Inicial annual plan (R$1,075/year ≈ R$89.6/month) matches Focus NFe's Solo pricing but locks in a 12-month commitment and caps at 2 CNPJs. The monthly Base plan at R$190 is more than double Focus NFe's entry for a similar document volume. No stated per-document overage rate — unclear what happens at the plan limit. No Python SDK or examples found.

### 5. PlugNotas (TecnoSpeed)

[plugnotas.com.br](https://plugnotas.com.br/) (redirects to [tecnospeed.com.br/plugdfe/plugnotas/](https://tecnospeed.com.br/plugdfe/plugnotas/)) · [tecnospeed.com.br](https://tecnospeed.com.br/)

PlugNotas is TecnoSpeed's API-first fiscal document issuance product, part of their broader PlugDFe suite. TecnoSpeed is a well-established Brazilian fiscal software company with a large reseller/software-house customer base.

**Pricing:** Not publicly disclosed. Access requires completing a contact form; the sales team responds within 24 business hours. [Source: PlugNotas contact page](https://tecnospeed.com.br/plugdfe/plugnotas/)

- NF types: NF-e, NFC-e, NFS-e, NFCom, MDF-e
- Python: not mentioned; Postman collection available
- Sandbox: yes — "sandbox instantâneo" with a fixed public token, no registration required
- Differentiator: instant sandbox (no sign-up), native Reforma Tributária IBS/CBS calculation, offline NFC-e contingency (NeverStop module), strong reseller/multi-CNPJ architecture

**Assessment:** The no-registration sandbox is genuinely developer-friendly. However, pricing opacity is a friction point for a small brand — there is no self-serve pricing, which suggests this product is oriented toward software houses and ISVs rather than direct single-brand customers. TecnoSpeed's market position is B2B/reseller. Not recommended for direct integration by a small e-commerce.

---

## Compact Comparison Table

| Dimension | Focus NFe | eNotas / Nota Gateway | Nuvem Fiscal | NFe.io | PlugNotas (TecnoSpeed) |
|---|---|---|---|---|---|
| **Status** | Active | Active | **Shutting down 31/07/2026** | Active | Active |
| **Pricing entry** | R$89.90/mo (100 docs) | ~R$137/mo (~60 docs) | N/A | R$190/mo (250 docs) or R$1,075/yr (100/mo) | Undisclosed — contact sales |
| **Per-doc overage** | R$0.10 | ~R$0.77 | N/A | Not disclosed | Not disclosed |
| **Minimum contract** | None | ~6 months (reported) | N/A | Annual plan locks 12 months | Not disclosed |
| **NF types** | NF-e, NFC-e, NFS-e, CTe, MDFe, NFCom, DCe | NF-e, NFC-e, NFS-e | NF-e, NFC-e, NFS-e, CTe, MDF-e, NFCom | NF-e, NFC-e, NFS-e | NF-e, NFC-e, NFS-e, NFCom, MDF-e |
| **Python support** | Official examples (`requests`) | No | No (PHP, C#, Java listed) | No | No |
| **Sandbox** | Yes — separate URL + 30-day free trial | Yes — same URL, body field | Yes (while active) | Yes | Yes — instant, no sign-up |
| **Webhook via API** | Yes | Dashboard-only | Yes | Not confirmed | Yes |
| **Tax reform (IBS/CBS)** | Not yet in public docs | Yes — `ibsCbs` in v2 schema | Unknown | Not confirmed | Yes — native calculator |
| **Notable differentiator** | Lowest price, Python examples, active forum, no lock-in | Tax reform fields ahead of schedule | N/A — shutting down | GNRE/IE queries bundled; strong onboarding | Instant sandbox, offline NFC-e, reseller-grade |

---

## Recommendation for Carolina Viapiana

**Recommended provider: Focus NFe — confirmed.**

The existing analysis in [nfe-providers.md](./nfe-providers.md) concluded Focus NFe is the best fit. Research into the broader landscape reinforces that conclusion.

### Why Focus NFe remains the right choice

**Cost — decisive factor at this scale.** At 50–200 NFes/month, Focus NFe's Solo plan (R$89.90/month + R$0.10 per extra doc) is the cheapest entry point of any actively maintained provider with public self-serve pricing. NFe.io's equivalent monthly plan costs R$190 — more than twice as much. eNotas/Nota Gateway costs ~R$137 with a steeper overage rate and a reported lock-in period. PlugNotas has no public price at all.

**No official Python SDK exists anywhere.** All five providers lack an officially maintained pip package. The closest is Focus NFe's `admdocbr/focusnfe` community library (Pydantic models, 100% test coverage with `requests-mock`, installable via `uv add focusnfe`) and official Python `requests` examples on focusnfe.com.br — no other provider offers equivalent Python guidance.

**No lock-in.** Focus NFe has no minimum contract and allows cancellation at any time. This is important for a brand at an early stage.

**Developer experience.** A 30-day free trial with a dedicated homologação URL and token pair means integration can be fully tested before a card is charged. PlugNotas has a better sandbox story (instant, no sign-up), but their pricing opacity and reseller positioning make them unsuitable as a direct-customer pick.

**Tax reform (IBS/CBS, 2026 Reforma Tributária).** The one area where Focus NFe lags: eNotas/Nota Gateway and PlugNotas already expose `ibsCbs` fields in their schemas. Focus NFe has not yet published these in its public documentation. Given that the full IBS/CBS regime has a gradual rollout through 2026–2033, this is not an immediate blocker — but it is worth monitoring. When Focus NFe publishes Reforma Tributária field support, verify compatibility before the mandatory compliance dates.

### Pre-requisite: fiscal regime

If Carolina Viapiana is currently registered as MEI, NF-e emission in Paraná is blocked until the CNPJ is migrated to ME (Microempresa) with active inscrição estadual and an ICP-Brasil e-CNPJ digital certificate. This is an accountant-side action, not a development task. The integration code can be built and tested in homologação regardless — migration only needs to be in place before going live in production.

### Recommended integration path

1. Confirm or establish ME status with active state registration in Paraná (accountant task).
2. Obtain ICP-Brasil e-CNPJ certificate for the CNPJ (cartório or Serasa/Certisign).
3. Register for Focus NFe free trial; obtain homologação token pair.
4. Implement `nfe_service.py` using `httpx` as sketched in [nfe-providers.md § Integration Sketch](./nfe-providers.md#integration-sketch-focus-nfe--fastapi).
5. Map order → NF-e payload: determine correct NCM for each product (diffusers / aromas / fragrance items typically fall under NCM 3307.xx), CFOP (5102 for intrastate consumer sales), and Simples Nacional ICMS CST (102 if não contribuinte).
6. Register webhook via `POST /v2/hooks` and implement handler in `backend/app/api/v1/webhooks.py`.
7. Test in homologação against SEFAZ-PR homologação endpoints.
8. Switch to production token + base URL for go-live.

---

*Research conducted 2026-07-27. Sources: [Focus NFe pricing](https://focusnfe.com.br/precos/), [NFe.io NF-e pricing](https://nfe.io/precos/emissao-nfe/), [PlugNotas / TecnoSpeed](https://tecnospeed.com.br/plugdfe/plugnotas/), [Nuvem Fiscal shutdown announcement — ACBr community](https://www.projetoacbr.com.br/forum/topic/91922-comunicado-de-desativa%C3%A7%C3%A3o-do-servi%C3%A7o-nuvem-fiscal-22042026/), [Nuvem Fiscal support thread](https://suporte.nuvemfiscal.com.br/t/encerramento-do-suporte-nuvemfiscal-e-migracao-para-o-acbr/5347), [MEI NF-e state restrictions — Soften Sistemas](https://blog.softensistemas.com.br/post/mei-nao-pode-emitir-nfe), [SEFAZ-PR NFA-e for MEI](https://atendimento.fazenda.pr.gov.br/sacsefa/portal/assuntosReferente/21), [SEFAZ-PR NF-e credentialing — Soften Sistemas](https://blog.softensistemas.com.br/post/credenciamento-emissor-nfe-parana), [SPED-PR NF-e v4.00 endpoints](https://sped.fazenda.pr.gov.br/NFe/Pagina/Enderecos-dos-ambientes-de-homologacao-e-producao-Versao-400), [Secretaria da Fazenda-PR — Microempresas Simples Nacional](https://www.fazenda.pr.gov.br/Pagina/Microempresas-Simples-Nacional).*
