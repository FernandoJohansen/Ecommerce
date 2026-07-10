# Carolina Viapiana — E-commerce

E-commerce for **Carolina Viapiana**, an artisanal aroma/diffuser brand from Ponta Grossa-PR, Brazil. Storefront in Brazilian Portuguese with product catalog, cart, and WhatsApp/PIX ordering.

## Structure

```
├── frontend/   # TanStack Start (SSR React) → Cloudflare Workers
├── backend/    # FastAPI + Supabase (PostgreSQL, Auth, Storage)
└── docker-compose.yml
```

## Requirements

- [Bun](https://bun.sh) (frontend)
- [uv](https://docs.astral.sh/uv/) + Python 3.14 (backend)
- Docker (optional, for the containerized stack)

## Setup

1. Create the Supabase project and run `backend/schema.sql` in the SQL Editor.
2. Copy the env examples and fill them in:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

## Development

**Frontend** (http://localhost:8080):

```bash
cd frontend
bun install
bun dev
```

**Backend** (http://localhost:8000, docs at `/docs`):

```bash
cd backend
uv venv --python 3.14
uv pip install -r requiriments.txt
uv run uvicorn app.main:app --reload
```

In dev, Vite proxies `/api/*` to the backend, so leave `VITE_API_URL` empty.

**Or run everything with Docker:**

```bash
docker compose up --build
```

## Quality

```bash
cd frontend
bun lint      # ESLint
bun format    # Prettier
```

CI (`.github/workflows/ci.yml`) runs lint + build for the frontend and a compile/import check + Docker build for the backend on every push and PR.

## Deployment

- **Frontend:** Cloudflare Workers via `bunx wrangler deploy` (config in `frontend/wrangler.jsonc`), or the manual `Deploy Frontend` GitHub Action (requires the `CLOUDFLARE_API_TOKEN` repo secret).
- **Backend:** Docker image (`backend/Dockerfile`), deployable to Railway/Render. Set the env vars from `backend/.env.example`.
