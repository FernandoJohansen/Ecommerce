import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.api.v1 import (
    audit,
    auth,
    avaliacoes,
    cart,
    categories,
    frete,
    orders,
    payments,
    products,
    users,
)
from app.core.bodylimit import BodySizeLimitMiddleware
from app.core.config import (
    ALLOWED_ORIGINS,
    ENABLE_API_DOCS,
    MERCADO_PAGO_ENABLED,
    MERCADO_PAGO_WEBHOOK_SECRET,
    WEBHOOK_REQUIRE_SIGNATURE,
)
from app.core.database import supabase
from app.core.ratelimit import limiter, rate_limit_handler
from app.core.securityheaders import SecurityHeadersMiddleware
from app.services import melhorenvio_client, mercadopago_client
from app.services.email_service import close_client as close_email_client
from app.services.expiracao_service import expirar_pedidos_nao_pagos
from app.services.payment_service import sincronizar_pagamentos_pendentes

logger = logging.getLogger(__name__)

EXPIRACAO_INTERVALO_SEGUNDOS = 900
SINCRONIZACAO_INTERVALO_SEGUNDOS = 3600
ANONIMIZACAO_INTERVALO_SEGUNDOS = 86400


async def _expirar_pedidos_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(expirar_pedidos_nao_pagos)
        except Exception:
            logger.exception("Falha na varredura de pedidos expirados")
        await asyncio.sleep(EXPIRACAO_INTERVALO_SEGUNDOS)


async def _sincronizar_pagamentos_loop() -> None:
    """Fallback poll: reconcile pending payments that may have missed webhooks."""
    await asyncio.sleep(300)  # initial delay to let the app warm up
    while True:
        try:
            await asyncio.to_thread(sincronizar_pagamentos_pendentes)
        except Exception:
            logger.exception("Falha na sincronização de pagamentos pendentes")
        await asyncio.sleep(SINCRONIZACAO_INTERVALO_SEGUNDOS)


async def _anonimizar_dados_loop() -> None:
    """LGPD: anonymize personal data in orders older than 5 years."""
    await asyncio.sleep(600)
    while True:
        try:
            await asyncio.to_thread(_anonimizar_pedidos_antigos)
        except Exception:
            logger.exception("Falha na anonimização de dados LGPD")
        await asyncio.sleep(ANONIMIZACAO_INTERVALO_SEGUNDOS)


_PAGAMENTO_CAMPOS_PII = ("email_pagador", "ip_origem")


def _anonimizar_pedidos_antigos() -> None:
    from datetime import datetime, timedelta, timezone

    from app.core.database import supabase
    from app.core.lgpd import CAMPOS_ANONIMIZAR_PEDIDOS

    agora = datetime.now(timezone.utc)
    cutoff = (agora - timedelta(days=5 * 365)).isoformat()
    campos = {**CAMPOS_ANONIMIZAR_PEDIDOS, "anonymized_at": agora.isoformat()}
    result = (
        supabase.table("pedidos")
        .update(campos)
        .lt("created_at", cutoff)
        .is_("anonymized_at", "null")
        .execute()
    )
    ids_anonimizados = [r["id"] for r in (result.data or [])]
    count = len(ids_anonimizados)
    if count:
        logger.info("LGPD: anonimizados %d pedido(s) com mais de 5 anos", count)

    # Remove PII de pagamentos.detalhes (email_pagador, ip_origem) vinculados
    # aos pedidos anonimizados. Feito entry-by-entry para só tocar nos campos
    # identificadores, preservando os dados técnicos do pagamento.
    if ids_anonimizados:
        pags = (
            supabase.table("pagamentos")
            .select("id, detalhes")
            .in_("pedido_id", ids_anonimizados)
            .execute()
        )
        for pag in (pags.data or []):
            detalhes = dict(pag.get("detalhes") or {})
            if any(k in detalhes for k in _PAGAMENTO_CAMPOS_PII):
                for k in _PAGAMENTO_CAMPOS_PII:
                    detalhes.pop(k, None)
                supabase.table("pagamentos").update({"detalhes": detalhes}).eq("id", pag["id"]).execute()

        # audit_log.detalhes guarda nome_cliente nos registros de exclusão de
        # pedidos — nulos os detalhes inteiros (são dados internos de operação).
        supabase.table("audit_log").update({"detalhes": None}).in_(
            "recurso_id", ids_anonimizados
        ).eq("acao", "pedido.excluir").execute()


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
    psp_ativo = MERCADO_PAGO_ENABLED
    tasks = []
    if psp_ativo:
        tasks.append(asyncio.create_task(_expirar_pedidos_loop()))
        tasks.append(asyncio.create_task(_sincronizar_pagamentos_loop()))
    tasks.append(asyncio.create_task(_anonimizar_dados_loop()))
    yield
    for task in tasks:
        task.cancel()
    mercadopago_client.close_client()
    melhorenvio_client.close_client()
    close_email_client()


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


@app.exception_handler(Exception)
async def _supabase_api_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Catch supabase-py APIError (PostgREST errors) so malformed UUIDs and
    # other DB-boundary failures return a structured 503 instead of an unlabelled 500.
    if type(exc).__name__ == "APIError":
        logger.warning("Supabase APIError on %s %s: %s", request.method, request.url.path, exc)
        return JSONResponse(status_code=503, content={"detail": "Serviço temporariamente indisponível"})
    raise exc

# add_middleware empilha de dentro para fora: a última chamada fica na camada
# mais externa. Ordem desejada: SecurityHeaders > CORS > BodySizeLimit.
# CORS mais externo que BodySizeLimit garante que o 413 chegue com CORS headers.
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Payment-Token"],
)
app.add_middleware(SecurityHeadersMiddleware)

api_router = APIRouter(prefix="/api")
api_router.include_router(products.router)
api_router.include_router(avaliacoes.router)
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
async def health():
    return {"status": "ok"}


@app.get("/health/db")
@limiter.limit("30/minute")
def health_db(request: Request):
    try:
        supabase.table("aromas").select("id").limit(1).execute()
    except Exception:
        logger.warning("health/db falhou", exc_info=True)
        return JSONResponse(status_code=503, content={"status": "error"})
    return {"status": "ok"}
