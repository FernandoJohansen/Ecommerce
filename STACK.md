# Stack do Projeto (real, em uso)

Atualizado em 13/07/2026. Este arquivo documenta a stack **efetivamente
usada** no repositório. Onde ela diverge da proposta original do
`Ecommerce.pdf`, a divergência está anotada.

## Frontend (`frontend/`)

| Camada | Tecnologia |
|---|---|
| Framework | TanStack Start (SSR React) |
| Roteamento | TanStack Router (file-based, `src/routes/`) |
| Data fetching | TanStack Query v5 |
| UI | React 19 · TypeScript 5.8 |
| Build | Vite 7 |
| Estilo | Tailwind CSS v4 (tokens `oklch`, paleta preto-e-branco) |
| Componentes | shadcn/ui (Radix UI) em `src/components/ui/` |
| Formulários | react-hook-form + zod |
| Fontes | Cormorant Garamond (títulos) + Inter (corpo) |
| Package manager | bun |
| Deploy | Cloudflare Workers (`wrangler.jsonc`; workflow manual "Deploy Frontend") |

**Divergências do PDF:** o PDF propunha Next.js + Vercel + Zustand.
Na prática usamos TanStack Start + Cloudflare Workers, e o estado do
carrinho vive no servidor (API `/api/carrinho` + TanStack Query), sem
Zustand.

## Backend (`backend/`)

| Camada | Tecnologia |
|---|---|
| Linguagem | Python 3.14 |
| Framework | FastAPI + uvicorn |
| Acesso a dados | supabase-py (REST) com padrão repository/service |
| Validação | Pydantic v2 (models de entidade + schemas de API) |
| Migrações | SQL puro em `backend/migrations/` (aplicadas via psql) |
| Package manager | uv (deps em `requiriments.txt` — nome tem typo, mas é o nome em uso) |
| Deploy | Imagem Docker (`backend/Dockerfile`), alvo Railway/Render |

**Divergências do PDF:** o PDF propunha SQLModel/SQLAlchemy + Alembic.
Na prática o acesso é via cliente REST do Supabase e as migrações são
arquivos SQL versionados no repositório.

## Banco de dados e storage

- **Supabase PostgreSQL** — schema + seed em `backend/schema.sql`;
  produção em sincronia desde 11/07/2026.
- **Supabase Auth** — autenticação (JWT validado no backend).
- **Supabase Storage** — hoje só o bucket `avatars`; bucket de imagens
  de produto ainda pendente (straggler do Sprint 3).

## Infra e tooling

- **Docker Compose** (`docker-compose.yml`) para dev local
  (frontend em :8080, backend em :8000).
- **GitHub Actions** — `ci.yml` (lint/build) e `deploy-frontend.yml`
  (manual; requer secret `CLOUDFLARE_API_TOKEN`).
- **Lint/format:** ESLint + Prettier (frontend).

## Integrações (planejadas, ainda não implementadas)

- **Mercado Pago** — pagamentos PIX, cartão e boleto (implementado; o
  Sicredi PIX foi substituído em 13/09/2026).
- **Melhor Envio** — frete (Sprint 7).
- **eNotas ou Nuvem Fiscal** — emissão de NFe (Sprint 8).
