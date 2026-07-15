import hashlib
import hmac

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.config import MERCADO_PAGO_WEBHOOK_SECRET
from app.dependencies.auth import get_staff_user
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


@router.get("/metodos", response_model=MetodosResponse)
def get_metodos():
    return listar_metodos()


# Só total/status/tem_cpf — a tela de pagamento (inclusive de convidado)
# precisa do valor antes de criar o pagamento
@router.get("/resumo/{pedido_id}", response_model=ResumoPedidoPagamento)
def get_resumo(pedido_id: str):
    return resumo_pedido_para_pagamento(pedido_id)


@router.get("/pix", response_model=PixResponse)
def get_pix():
    return get_pix_info()


@router.post("/pix", response_model=CobrancaPixResponse, status_code=201)
def post_cobranca_pix(body: CobrancaPixCreate):
    return criar_cobranca_pix(body.pedido_id)


@router.get("/pix/{txid}", response_model=CobrancaPixResponse)
def get_cobranca_pix(txid: str):
    return consultar_pagamento(txid)


@router.post("/cartao", response_model=PagamentoMpResponse, status_code=201)
def post_pagamento_cartao(body: PagamentoCartaoCreate):
    return criar_pagamento_cartao(body)


@router.post("/boleto", response_model=PagamentoMpResponse, status_code=201)
def post_pagamento_boleto(body: PagamentoBoletoCreate):
    return criar_pagamento_boleto(body)


@router.get("/mp/{mp_payment_id}", response_model=PagamentoMpResponse)
def get_pagamento_mp(mp_payment_id: str):
    return consultar_pagamento_mp(mp_payment_id)


# O Sicredi envia as notificações em {webhookUrl}/pix; o webhookUrl registrado
# aponta para .../api/pagamento/webhook. O corpo não é confiável por si só —
# o serviço reconfere cada txid direto no Sicredi antes de confirmar.
@router.post("/webhook/pix")
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


# Notificação do Mercado Pago (cartão/boleto). Mesmo com assinatura válida o
# conteúdo não é confiado: o serviço reconfere o pagamento direto no MP antes
# de confirmar qualquer coisa.
@router.post("/webhook/mercadopago")
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

    if tipo != "payment" or not data_id:
        return {"processados": 0}
    return processar_webhook_mercadopago(str(data_id))


@router.put("/webhook")
def put_webhook(_user=Depends(get_staff_user)):
    return registrar_webhook()


@router.get("/webhook")
def get_webhook(_user=Depends(get_staff_user)):
    return consultar_webhook()
