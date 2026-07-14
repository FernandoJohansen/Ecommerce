from fastapi import APIRouter, Depends, Request

from app.dependencies.auth import get_staff_user
from app.schemas.payment import CobrancaPixCreate, CobrancaPixResponse, PixResponse
from app.services.payment_service import (
    consultar_pagamento,
    consultar_webhook,
    criar_cobranca_pix,
    get_pix_info,
    processar_webhook_pix,
    registrar_webhook,
)

router = APIRouter(prefix="/pagamento", tags=["pagamento"])


@router.get("/pix", response_model=PixResponse)
def get_pix():
    return get_pix_info()


@router.post("/pix", response_model=CobrancaPixResponse, status_code=201)
def post_cobranca_pix(body: CobrancaPixCreate):
    return criar_cobranca_pix(body.pedido_id)


@router.get("/pix/{txid}", response_model=CobrancaPixResponse)
def get_cobranca_pix(txid: str):
    return consultar_pagamento(txid)


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


@router.put("/webhook")
def put_webhook(_user=Depends(get_staff_user)):
    return registrar_webhook()


@router.get("/webhook")
def get_webhook(_user=Depends(get_staff_user)):
    return consultar_webhook()
