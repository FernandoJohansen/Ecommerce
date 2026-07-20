import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.api.v1 import audit, auth, cart, categories, frete, orders, payments, products, users
from app.core.config import (
    ALLOWED_ORIGINS,
    ENABLE_API_DOCS,
    MERCADO_PAGO_ENABLED,
    MERCADO_PAGO_WEBHOOK_SECRET,
    SICREDI_ENABLED,
    WEBHOOK_REQUIRE_SIGNATURE,
)
from app.core.bodylimit import BodySizeLimitMiddleware
from app.core.ratelimit import limiter, rate_limit_handler
from app.services.expiracao_service import expirar_pedidos_nao_pagos

logger = logging.getLogger(__name__)

EXPIRACAO_INTERVALO_SEGUNDOS = 900


async def _expirar_pedidos_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(expirar_pedidos_nao_pagos)
        except Exception:
            logger.exception("Falha na varredura de pedidos expirados")
        await asyncio.sleep(EXPIRACAO_INTERVALO_SEGUNDOS)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if MERCADO_PAGO_ENABLED and not MERCADO_PAGO_WEBHOOK_SECRET:
        if WEBHOOK_REQUIRE_SIGNATURE:
            logger.warning(
                "MERCADO_PAGO_WEBHOOK_SECRET não configurado e "
                "WEBHOOK_REQUIRE_SIGNATURE=true: o webhook do Mercado Pago vai "
                "RECUSAR (503) todas as notificações até o secret ser definido "
                "no painel de Webhooks do MP."
            )
        else:
            logger.warning(
                "MERCADO_PAGO_WEBHOOK_SECRET não configurado: o webhook do Mercado "
                "Pago aceita chamadas sem assinatura (o status é sempre reconferido "
                "no MP, mas configure o secret no painel de Webhooks e ligue "
                "WEBHOOK_REQUIRE_SIGNATURE=true em produção — ver PENDENCIAS.txt, "
                "Sprint 6b passo 4)."
            )
    # Sem PSP configurado, todo pedido é negociado manualmente pelo WhatsApp e
    # não deve expirar (comportamento de antes do Sprint 6).
    task = (
        asyncio.create_task(_expirar_pedidos_loop())
        if SICREDI_ENABLED or MERCADO_PAGO_ENABLED
        else None
    )
    yield
    if task:
        task.cancel()


# Docs interativas só quando ENABLE_API_DOCS=true (dev). Em produção ficam
# desligadas para não expor a superfície da API sem autenticação.
app = FastAPI(
    title="Carolina Viapiana API",
    lifespan=lifespan,
    docs_url="/docs" if ENABLE_API_DOCS else None,
    redoc_url="/redoc" if ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_API_DOCS else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

# Registrado antes do CORS de propósito: o último add_middleware fica por
# fora, e o 413 precisa sair com os headers de CORS para o navegador ler.
app.add_middleware(BodySizeLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Payment-Token"],
)

api_router = APIRouter(prefix="/api")
api_router.include_router(products.router)
api_router.include_router(orders.router)
api_router.include_router(categories.router)
api_router.include_router(auth.router)
api_router.include_router(cart.router)
api_router.include_router(payments.router)
api_router.include_router(users.router)
api_router.include_router(frete.router)
api_router.include_router(audit.router)

app.include_router(api_router)


@app.get("/")
def health():
    return {"status": "ok"}
