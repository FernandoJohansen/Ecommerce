import hashlib
import hmac
import time

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.config import (
    MERCADO_PAGO_WEBHOOK_SECRET,
    MERCADO_PAGO_WEBHOOK_TOLERANCIA_SEGUNDOS,
    WEBHOOK_REQUIRE_SIGNATURE,
)
from app.core.ratelimit import limiter
from app.dependencies.auth import get_optional_user, get_staff_user
from app.services.audit_service import registrar_auditoria
from app.schemas.payment import (
    CobrancaPixCreate,
    CobrancaPixResponse,
    MetodosResponse,
    PagamentoBoletoCreate,
    PagamentoCartaoCreate,
    PagamentoMpResponse,
    PixResponse,
    ResumoPedidoPagamento,
)
from app.services.payment_service import (
    consultar_pagamento,
    consultar_pagamento_mp,
    consultar_webhook,
    criar_cobranca_pix,
    criar_pagamento_boleto,
    criar_pagamento_cartao,
    get_pix_info,
    listar_metodos,
    processar_webhook_mercadopago,
    processar_webhook_pix,
    registrar_webhook,
    resumo_pedido_para_pagamento,
)

router = APIRouter(prefix="/pagamento", tags=["pagamento"])


def _token_pagamento(request: Request) -> str | None:
    """Token de pagamento devolvido na criação do pedido (fluxo de convidado);
    cliente logado é autorizado pelo Bearer + user_id do pedido."""
    return request.headers.get("x-payment-token")


@router.get("/metodos", response_model=MetodosResponse)
def get_metodos():
    return listar_metodos()


# Só total/status/tem_documento — a tela de pagamento (inclusive de convidado)
# precisa do valor antes de criar o pagamento. Autorização por objeto: dono
# logado, staff ou token de pagamento (X-Payment-Token).
@router.get("/resumo/{pedido_id}", response_model=ResumoPedidoPagamento)
def get_resumo(request: Request, pedido_id: str, user=Depends(get_optional_user)):
    return resumo_pedido_para_pagamento(pedido_id, user, _token_pagamento(request))


@router.get("/pix", response_model=PixResponse)
def get_pix():
    return get_pix_info()


# Criação de pagamento atende convidado (autorizado pelo token de pagamento)
# e é repassada ao PSP — limite por IP contra spam de cobranças. Os GETs de
# polling ficam sem limite (o frontend consulta a cada 5s, legitimamente).
@router.post("/pix", response_model=CobrancaPixResponse, status_code=201)
@limiter.limit("10/minute")
def post_cobranca_pix(request: Request, body: CobrancaPixCreate, user=Depends(get_optional_user)):
    return criar_cobranca_pix(body.pedido_id, user, _token_pagamento(request))


@router.get("/pix/{txid}", response_model=CobrancaPixResponse)
def get_cobranca_pix(request: Request, txid: str, user=Depends(get_optional_user)):
    return consultar_pagamento(txid, user, _token_pagamento(request))


@router.post("/cartao", response_model=PagamentoMpResponse, status_code=201)
@limiter.limit("10/minute")
def post_pagamento_cartao(
    request: Request, body: PagamentoCartaoCreate, user=Depends(get_optional_user)
):
    return criar_pagamento_cartao(body, user, _token_pagamento(request))


@router.post("/boleto", response_model=PagamentoMpResponse, status_code=201)
@limiter.limit("10/minute")
def post_pagamento_boleto(
    request: Request, body: PagamentoBoletoCreate, user=Depends(get_optional_user)
):
    return criar_pagamento_boleto(body, user, _token_pagamento(request))


@router.get("/mp/{mp_payment_id}", response_model=PagamentoMpResponse)
def get_pagamento_mp(request: Request, mp_payment_id: str, user=Depends(get_optional_user)):
    return consultar_pagamento_mp(mp_payment_id, user, _token_pagamento(request))


# O Sicredi envia as notificações em {webhookUrl}/pix; o webhookUrl registrado
# aponta para .../api/pagamento/webhook. O corpo não é confiável por si só —
# o serviço reconfere cada txid direto no Sicredi antes de confirmar.
@router.post("/webhook/pix")
@limiter.limit("60/minute")
async def post_webhook_pix(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    return processar_webhook_pix(payload if isinstance(payload, dict) else {})


def _validar_assinatura_mp(request: Request, data_id: str) -> None:
    """Valida o header x-signature do Mercado Pago (HMAC-SHA256 do manifesto
    id:{data.id};request-id:{x-request-id};ts:{ts}; com a assinatura secreta).
    Seções cujo valor falta são omitidas do manifesto (regra da doc MP)."""
    assinatura = request.headers.get("x-signature", "")
    partes = dict(
        p.strip().split("=", 1) for p in assinatura.split(",") if "=" in p
    )
    ts = partes.get("ts")
    v1 = partes.get("v1")
    if not v1:
        raise HTTPException(status_code=401, detail="Assinatura do webhook ausente")

    manifesto = ""
    if data_id:
        # data.id alfanumérico deve entrar em minúsculas (regra da doc MP)
        manifesto += f"id:{data_id.lower()};"
    request_id = request.headers.get("x-request-id")
    if request_id:
        manifesto += f"request-id:{request_id};"
    if ts:
        manifesto += f"ts:{ts};"

    esperado = hmac.new(
        MERCADO_PAGO_WEBHOOK_SECRET.encode(), manifesto.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(esperado, v1):
        raise HTTPException(status_code=401, detail="Assinatura do webhook inválida")

    # Anti-replay: o ts está dentro do manifesto assinado, então já é confiável
    # aqui. Recusa notificação antiga reenviada (a reconferência no MP evita
    # forjar "pago", mas isto corta amplificação de cota por replay).
    _validar_frescor_ts(ts)


def _validar_frescor_ts(ts: str | None) -> None:
    if MERCADO_PAGO_WEBHOOK_TOLERANCIA_SEGUNDOS <= 0 or not ts:
        return
    try:
        valor = int(ts)
    except ValueError:
        raise HTTPException(status_code=401, detail="Timestamp do webhook inválido")
    # O MP manda o ts em milissegundos; tolera segundos por robustez.
    ts_segundos = valor / 1000 if valor > 10**11 else valor
    if abs(time.time() - ts_segundos) > MERCADO_PAGO_WEBHOOK_TOLERANCIA_SEGUNDOS:
        raise HTTPException(status_code=401, detail="Notificação do webhook expirada")


# Notificação do Mercado Pago (cartão/boleto). Mesmo com assinatura válida o
# conteúdo não é confiado: o serviço reconfere o pagamento direto no MP antes
# de confirmar qualquer coisa.
@router.post("/webhook/mercadopago")
@limiter.limit("60/minute")
async def post_webhook_mercadopago(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}

    tipo = request.query_params.get("type") or payload.get("type")
    data_id = request.query_params.get("data.id") or (payload.get("data") or {}).get("id")

    if MERCADO_PAGO_WEBHOOK_SECRET:
        _validar_assinatura_mp(request, str(data_id or ""))
    elif WEBHOOK_REQUIRE_SIGNATURE:
        # Fail-closed: sem secret configurado, não há como validar a origem —
        # em produção (WEBHOOK_REQUIRE_SIGNATURE=true) a notificação é recusada
        # em vez de aceita sem verificação.
        raise HTTPException(
            status_code=503,
            detail="Webhook sem assinatura configurada.",
        )

    if tipo != "payment" or not data_id:
        return {"processados": 0}
    return processar_webhook_mercadopago(str(data_id))


@router.put("/webhook")
def put_webhook(user=Depends(get_staff_user)):
    result = registrar_webhook()
    registrar_auditoria(user, "pix.webhook.registrar", "webhook", None, result)
    return result


@router.get("/webhook")
def get_webhook(_user=Depends(get_staff_user)):
    return consultar_webhook()
