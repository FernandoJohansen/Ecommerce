from datetime import datetime, timedelta, timezone
from uuid import uuid4

import segno
from fastapi import HTTPException

from app.core.config import PIX_BENEFICIARIO, PIX_KEY, PIX_WEBHOOK_URL
from app.repositories.order_repository import get_pedido_by_id, update_pedido
from app.repositories.payment_repository import (
    get_pagamento_by_txid,
    get_pagamentos_by_pedido,
    insert_pagamento,
    update_pagamento,
)
from app.services import sicredi_client

# Prazo de validade da cobrança PIX (calendario.expiracao, em segundos)
EXPIRACAO_SEGUNDOS = 86400


def get_pix_info() -> dict:
    return {
        "chave": PIX_KEY,
        "beneficiario": PIX_BENEFICIARIO,
        "instrucoes": "Após o pagamento, envie o comprovante pelo WhatsApp.",
    }


def _qrcode_data_uri(brcode: str | None) -> str | None:
    if not brcode:
        return None
    return segno.make(brcode).svg_data_uri(scale=4)


def _resposta(row: dict) -> dict:
    return {
        "txid": row["txid"],
        "pedido_id": row["pedido_id"],
        "status": row["status"],
        "valor_centavos": row["valor_centavos"],
        "brcode": row.get("brcode"),
        "qrcode": _qrcode_data_uri(row.get("brcode")),
    }


def _cobranca_vigente(row: dict) -> bool:
    if row["status"] != "ATIVA":
        return False
    criado_em = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
    return datetime.now(timezone.utc) < criado_em + timedelta(seconds=EXPIRACAO_SEGUNDOS)


def criar_cobranca_pix(pedido_id: str) -> dict:
    pedido = get_pedido_by_id(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if pedido["status"] == "pago":
        raise HTTPException(status_code=409, detail="Este pedido já está pago")
    if pedido["status"] == "cancelado":
        raise HTTPException(status_code=409, detail="Este pedido foi cancelado")
    if pedido["total_centavos"] <= 0:
        raise HTTPException(status_code=422, detail="Pedido sem valor a pagar")

    # Reaproveita a cobrança ativa mais recente dentro do prazo, para o cliente
    # que recarrega a página não gerar uma nova cobrança a cada visita.
    for existente in get_pagamentos_by_pedido(pedido_id):
        if _cobranca_vigente(existente):
            return _resposta(existente)

    # txid do Bacen: 26–35 caracteres alfanuméricos; uuid4().hex tem 32
    txid = uuid4().hex
    cob = sicredi_client.criar_cob(
        txid=txid,
        valor_centavos=pedido["total_centavos"],
        chave=PIX_KEY,
        descricao="Pedido Carolina Viapiana",
        expiracao=EXPIRACAO_SEGUNDOS,
    )
    row = insert_pagamento(
        {
            "pedido_id": pedido_id,
            "txid": txid,
            "valor_centavos": pedido["total_centavos"],
            "status": cob.get("status", "ATIVA"),
            "brcode": cob.get("pixCopiaECola"),
        }
    )
    if not row:
        raise HTTPException(status_code=500, detail="Falha ao registrar pagamento")
    return _resposta(row)


def _aplicar_status_cob(row: dict, cob: dict) -> dict:
    """Sincroniza a linha local com o status da cobrança no Sicredi; quando o
    pagamento é confirmado, marca o pedido como pago."""
    status = cob.get("status")
    if not status or status == row["status"]:
        return row

    data: dict = {"status": status}
    if status == "CONCLUIDA":
        pix_recebidos = cob.get("pix") or []
        data["e2eid"] = pix_recebidos[0].get("endToEndId") if pix_recebidos else None
        data["pago_em"] = datetime.now(timezone.utc).isoformat()
    atualizado = update_pagamento(row["txid"], data) or {**row, **data}

    if status == "CONCLUIDA":
        pedido = get_pedido_by_id(row["pedido_id"])
        if pedido and pedido["status"] in ("novo", "em_andamento"):
            update_pedido(row["pedido_id"], {"status": "pago"})
    return atualizado


def consultar_pagamento(txid: str) -> dict:
    row = get_pagamento_by_txid(txid)
    if not row:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if row["status"] == "ATIVA":
        try:
            cob = sicredi_client.consultar_cob(txid)
        except HTTPException:
            # PSP fora do ar não deve quebrar o polling; devolve o estado local
            return _resposta(row)
        row = _aplicar_status_cob(row, cob)
    return _resposta(row)


def processar_webhook_pix(payload: dict) -> dict:
    """Notificação de PIX recebido. O corpo do POST não é confiável por si só:
    para cada txid notificado, o status é reconferido direto no Sicredi antes
    de marcar qualquer coisa como paga (também torna o webhook idempotente)."""
    processados = 0
    for pix in payload.get("pix") or []:
        txid = pix.get("txid")
        if not txid:
            continue
        row = get_pagamento_by_txid(txid)
        if not row or row["status"] != "ATIVA":
            continue
        try:
            cob = sicredi_client.consultar_cob(txid)
        except HTTPException:
            continue
        _aplicar_status_cob(row, cob)
        processados += 1
    return {"processados": processados}


def registrar_webhook() -> dict:
    if not PIX_WEBHOOK_URL:
        raise HTTPException(status_code=422, detail="PIX_WEBHOOK_URL não configurada")
    sicredi_client.configurar_webhook(PIX_KEY, PIX_WEBHOOK_URL)
    return {"chave": PIX_KEY, "webhookUrl": PIX_WEBHOOK_URL}


def consultar_webhook() -> dict:
    return sicredi_client.consultar_webhook(PIX_KEY)
