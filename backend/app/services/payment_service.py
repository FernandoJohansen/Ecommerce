import hashlib
import logging
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import segno
from fastapi import HTTPException

from app.core.config import (
    MERCADO_PAGO_ENABLED,
    MERCADO_PAGO_MAX_PARCELAS,
    MERCADO_PAGO_WEBHOOK_URL,
    PIX_BENEFICIARIO,
    PIX_KEY,
    PIX_WEBHOOK_URL,
    SICREDI_ENABLED,
)
from app.core.payment_token import token_pagamento_valido
from app.core.roles import ROLE_STAFF, role_at_least
from app.dependencies.auth import resolve_role
from app.repositories.order_repository import get_pedido_by_id, update_pedido
from app.repositories.payment_repository import (
    count_pagamentos_recusados_ip,
    get_pagamento_by_mp_id,
    get_pagamento_by_txid,
    get_pagamentos_by_pedido,
    get_pagamentos_by_pedido_metodo,
    get_pagamentos_pendentes_antigos,
    insert_pagamento,
    update_pagamento,
    update_pagamento_by_id,
)
from app.repositories.webhook_repository import webhook_evento_novo
from app.schemas.payment import PagamentoBoletoCreate, PagamentoCartaoCreate
from app.services import mercadopago_client, sicredi_client

logger = logging.getLogger(__name__)

# Prazo de validade da cobrança PIX (calendario.expiracao, em segundos)
EXPIRACAO_SEGUNDOS = 86400

# Vencimento do boleto (Mercado Pago exige data com offset; boleto compensa
# em 1-3 dias úteis depois de pago)
BOLETO_DIAS_VENCIMENTO = 3
FUSO_BR = timezone(timedelta(hours=-3))

# Mensagens pt-BR para os status_detail de recusa do Mercado Pago
MENSAGENS_RECUSA = {
    "cc_rejected_bad_filled_card_number": "Confira os dados do cartão e tente novamente.",
    "cc_rejected_bad_filled_date": "Confira os dados do cartão e tente novamente.",
    "cc_rejected_bad_filled_security_code": "Confira os dados do cartão e tente novamente.",
    "cc_rejected_bad_filled_other": "Confira os dados do cartão e tente novamente.",
    "cc_rejected_insufficient_amount": "Saldo/limite insuficiente.",
    "cc_rejected_call_for_authorize": "Autorize o pagamento junto ao emissor do cartão.",
    "cc_rejected_card_disabled": "Cartão inativo. Fale com o emissor.",
    "cc_rejected_high_risk": "Pagamento recusado por segurança. Tente outro método.",
    "cc_rejected_blacklist": "Pagamento recusado por segurança. Tente outro método.",
    "cc_rejected_max_attempts": "Muitas tentativas. Aguarde alguns minutos.",
}
MENSAGEM_RECUSA_PADRAO = "Pagamento recusado. Tente outro cartão ou método."


_VELOCITY_LIMIT = 5
_VELOCITY_JANELA_SEGUNDOS = 3600


def _idempotency_key(pedido_id: str, metodo: str) -> str:
    """Deterministic key stable for a 5-minute window; retries in that window
    reuse the same key so MercadoPago deduplicates instead of double-charging."""
    window = int(time.time()) // 300
    raw = f"{pedido_id}:{metodo}:{window}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _checar_velocity(ip_origem: str, pedido_id: str) -> None:
    count = count_pagamentos_recusados_ip(ip_origem, _VELOCITY_JANELA_SEGUNDOS)
    if count >= _VELOCITY_LIMIT:
        logger.warning(
            "Velocity check: %d rejected payments from IP %s in last hour (pedido %s)",
            count, ip_origem, pedido_id,
        )
        raise HTTPException(
            status_code=429,
            detail="Muitas tentativas recusadas. Aguarde antes de tentar novamente.",
        )


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


def exigir_acesso_pedido(
    pedido_id: str, user, token_pagamento: str | None, detail: str = "Pedido não encontrado"
) -> None:
    """Autorização a nível de objeto dos endpoints de pagamento: saber o UUID
    do pedido não basta (ele vaza por Referer/logs/histórico). Libera o dono
    logado, staff/admin ou quem apresenta o token de pagamento devolvido na
    criação do pedido. A recusa é 404 igual à de pedido inexistente, para não
    confirmar que o UUID existe."""
    if token_pagamento and token_pagamento_valido(token_pagamento, pedido_id):
        return
    if user is not None:
        pedido = get_pedido_by_id(pedido_id)
        if pedido and pedido.get("user_id") == user.id:
            return
        if role_at_least(resolve_role(user.id, user.email), ROLE_STAFF):
            return
    raise HTTPException(status_code=404, detail=detail)


def _validar_pedido_para_pagamento(pedido_id: str) -> dict:
    pedido = get_pedido_by_id(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if pedido["status"] == "pago":
        raise HTTPException(status_code=409, detail="Este pedido já está pago")
    if pedido["status"] == "cancelado":
        raise HTTPException(status_code=409, detail="Este pedido foi cancelado")
    if pedido["total_centavos"] <= 0:
        raise HTTPException(status_code=422, detail="Pedido sem valor a pagar")
    return pedido


def criar_cobranca_pix(pedido_id: str, user, token_pagamento: str | None) -> dict:
    # Antes de validar: os 409/422 de status revelariam dados do pedido
    exigir_acesso_pedido(pedido_id, user, token_pagamento)
    pedido = _validar_pedido_para_pagamento(pedido_id)

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
    logger.info(
        "payment.initiated method=pix pedido_id=%s txid=%s valor_centavos=%d",
        pedido_id, txid, pedido["total_centavos"],
    )
    return _resposta(row)


def _marcar_pedido_pago(pedido_id: str) -> None:
    pedido = get_pedido_by_id(pedido_id)
    if pedido and pedido["status"] in ("novo", "em_andamento"):
        update_pedido(pedido_id, {"status": "pago"})
        logger.info("order.paid pedido_id=%s", pedido_id)
        from app.services import email_service
        email_service.enviar_pagamento_confirmado(pedido)


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
        _marcar_pedido_pago(row["pedido_id"])
    return atualizado


def consultar_pagamento(txid: str, user, token_pagamento: str | None) -> dict:
    row = get_pagamento_by_txid(txid)
    if not row:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    exigir_acesso_pedido(
        row["pedido_id"], user, token_pagamento, detail="Pagamento não encontrado"
    )
    if row["status"] == "ATIVA":
        try:
            cob = sicredi_client.consultar_cob(txid)
        except HTTPException:
            # PSP fora do ar não deve quebrar o polling; devolve o estado local
            return _resposta(row)
        row = _aplicar_status_cob(row, cob)
    return _resposta(row)


def processar_webhook_pix(payload: dict, event_id: str | None = None) -> dict:
    """Notificação de PIX recebido. O corpo do POST não é confiável por si só:
    para cada txid notificado, o status é reconferido direto no Sicredi antes
    de marcar qualquer coisa como paga."""
    if event_id:
        if not webhook_evento_novo(event_id, "sicredi"):
            logger.info("webhook.duplicate provider=sicredi event_id=%s", event_id)
            return {"processados": 0}
        logger.info("webhook.received provider=sicredi event_id=%s", event_id)

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


# ── Mercado Pago (cartão de crédito + boleto) ────────────────────────────────


def listar_metodos() -> dict:
    return {
        "pix": SICREDI_ENABLED,
        "cartao": MERCADO_PAGO_ENABLED,
        "boleto": MERCADO_PAGO_ENABLED,
        "max_parcelas": MERCADO_PAGO_MAX_PARCELAS,
    }


def resumo_pedido_para_pagamento(pedido_id: str, user, token_pagamento: str | None) -> dict:
    """Dados mínimos do pedido para a tela de pagamento (inclui convidados):
    o Brick de cartão precisa do valor antes de existir pagamento."""
    exigir_acesso_pedido(pedido_id, user, token_pagamento)
    pedido = get_pedido_by_id(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return {
        "pedido_id": pedido["id"],
        "total_centavos": pedido["total_centavos"],
        "status": pedido["status"],
        "tem_documento": bool(pedido.get("cpf_cnpj")),
    }


def _situacao(row: dict) -> str:
    """Normaliza o status nativo do PSP (Bacen ou MP) para o frontend."""
    status = row["status"]
    if row.get("metodo", "pix") == "pix":
        if status == "ATIVA":
            return "pendente"
        if status == "CONCLUIDA":
            return "aprovado"
        return "cancelado"  # REMOVIDA_*
    if status in ("pending", "in_process", "authorized"):
        return "pendente"
    if status == "approved":
        return "aprovado"
    if status == "rejected":
        return "recusado"
    if status in ("refunded", "charged_back"):
        return "estornado"
    return "cancelado"


def _resposta_mp(row: dict) -> dict:
    detalhes = row.get("detalhes") or {}
    situacao = _situacao(row)
    status_detail = detalhes.get("status_detail")
    return {
        "id": row["mp_payment_id"],
        "pedido_id": row["pedido_id"],
        "metodo": row["metodo"],
        "status": row["status"],
        "situacao": situacao,
        "valor_centavos": row["valor_centavos"],
        "status_detail": status_detail,
        "mensagem_recusa": (
            MENSAGENS_RECUSA.get(status_detail or "", MENSAGEM_RECUSA_PADRAO)
            if situacao == "recusado"
            else None
        ),
        "parcelas": detalhes.get("parcelas"),
        "boleto_url": detalhes.get("boleto_url"),
        "boleto_linha_digitavel": detalhes.get("boleto_linha_digitavel"),
        "boleto_vencimento": detalhes.get("boleto_vencimento"),
    }


def _aplicar_status_mp(row: dict, mp: dict) -> dict:
    """Sincroniza a linha local com o pagamento no Mercado Pago.
    Refunds/chargebacks also flip the order to `reembolsado`."""
    status = mp.get("status")
    if not status or status == row["status"]:
        return row

    detalhes = {**(row.get("detalhes") or {}), "status_detail": mp.get("status_detail")}
    data: dict = {"status": status, "detalhes": detalhes}
    if status == "approved":
        data["pago_em"] = datetime.now(timezone.utc).isoformat()
    atualizado = update_pagamento_by_id(row["id"], data) or {**row, **data}

    if status == "approved":
        _marcar_pedido_pago(row["pedido_id"])
    elif status in ("refunded", "charged_back"):
        pedido = get_pedido_by_id(row["pedido_id"])
        if pedido and pedido["status"] not in ("reembolsado", "cancelado"):
            update_pedido(row["pedido_id"], {"status": "reembolsado"})
            logger.info(
                "order.refunded pedido_id=%s mp_payment_id=%s status=%s",
                row["pedido_id"], row.get("mp_payment_id"), status,
            )
    return atualizado


def _pedido_ja_aprovado(pedido_id: str) -> bool:
    # Cobre a janela entre o approved no PSP e a atualização do pedido
    return any(_situacao(p) == "aprovado" for p in get_pagamentos_by_pedido(pedido_id))


def _identificacao_mp(pedido: dict) -> dict:
    # CPF (11 dígitos) ou CNPJ (14) — o tipo vai junto na identification do MP
    documento = pedido["cpf_cnpj"]
    return {"type": "CNPJ" if len(documento) == 14 else "CPF", "number": documento}


def criar_pagamento_cartao(
    dados: PagamentoCartaoCreate, user, token_pagamento: str | None, ip_origem: str = ""
) -> dict:
    """Cada submit do Brick é uma tentativa nova (token novo, pagamento novo no
    MP) — recusas ficam no histórico e nunca bloqueiam nova tentativa."""
    exigir_acesso_pedido(dados.pedido_id, user, token_pagamento)
    mercadopago_client.exigir_mercado_pago()
    pedido = _validar_pedido_para_pagamento(dados.pedido_id)
    if _pedido_ja_aprovado(dados.pedido_id):
        raise HTTPException(status_code=409, detail="Este pedido já está pago")
    if not pedido.get("cpf_cnpj"):
        raise HTTPException(
            status_code=422,
            detail="Pedido sem CPF/CNPJ cadastrado; finalize pelo PIX ou refaça o pedido.",
        )
    if ip_origem:
        _checar_velocity(ip_origem, dados.pedido_id)

    # Stable within a 5-minute window so network-timeout retries reuse the same
    # key instead of generating a new one and double-charging.
    idempotency_key = _idempotency_key(dados.pedido_id, "cartao")

    payload = {
        # Valor sempre do servidor; o amount exibido no Brick é ignorado
        "transaction_amount": round(pedido["total_centavos"] / 100, 2),
        "token": dados.token,
        "installments": min(max(dados.installments, 1), MERCADO_PAGO_MAX_PARCELAS),
        "payment_method_id": dados.payment_method_id,
        "payer": {
            "email": dados.payer_email,
            "identification": _identificacao_mp(pedido),
        },
        "external_reference": dados.pedido_id,
        "description": "Pedido Carolina Viapiana",
    }
    if dados.issuer_id:
        payload["issuer_id"] = dados.issuer_id
    if MERCADO_PAGO_WEBHOOK_URL:
        payload["notification_url"] = MERCADO_PAGO_WEBHOOK_URL

    logger.info(
        "payment.initiated method=cartao pedido_id=%s valor_centavos=%d",
        dados.pedido_id, pedido["total_centavos"],
    )
    mp = mercadopago_client.criar_pagamento(payload, idempotency_key=idempotency_key)

    row = insert_pagamento(
        {
            "pedido_id": dados.pedido_id,
            "metodo": "cartao",
            "mp_payment_id": str(mp["id"]),
            "valor_centavos": pedido["total_centavos"],
            "status": mp.get("status", "pending"),
            "detalhes": {
                "status_detail": mp.get("status_detail"),
                "parcelas": mp.get("installments"),
                "bandeira": mp.get("payment_method_id"),
                "email_pagador": dados.payer_email,
                "ip_origem": ip_origem,
            },
        }
    )
    if not row:
        raise HTTPException(status_code=500, detail="Falha ao registrar pagamento")
    if row["status"] == "approved":
        row = {**row, "pago_em": datetime.now(timezone.utc).isoformat()}
        update_pagamento_by_id(row["id"], {"pago_em": row["pago_em"]})
        _marcar_pedido_pago(dados.pedido_id)
        logger.info("payment.succeeded method=cartao pedido_id=%s", dados.pedido_id)
    elif row["status"] == "rejected":
        logger.warning(
            "payment.failed method=cartao pedido_id=%s status_detail=%s",
            dados.pedido_id, (row.get("detalhes") or {}).get("status_detail"),
        )
    return _resposta_mp(row)


def _boleto_vigente(row: dict) -> bool:
    if row["status"] != "pending":
        return False
    vencimento = (row.get("detalhes") or {}).get("boleto_vencimento")
    if not vencimento:
        return False
    try:
        return datetime.now(timezone.utc) < datetime.fromisoformat(vencimento)
    except ValueError:
        return False


def criar_pagamento_boleto(
    dados: PagamentoBoletoCreate, user, token_pagamento: str | None, ip_origem: str = ""
) -> dict:
    exigir_acesso_pedido(dados.pedido_id, user, token_pagamento)
    mercadopago_client.exigir_mercado_pago()
    pedido = _validar_pedido_para_pagamento(dados.pedido_id)
    if _pedido_ja_aprovado(dados.pedido_id):
        raise HTTPException(status_code=409, detail="Este pedido já está pago")
    if not pedido.get("cpf_cnpj"):
        raise HTTPException(
            status_code=422,
            detail="Pedido sem CPF/CNPJ cadastrado; finalize pelo PIX ou refaça o pedido.",
        )

    # Reaproveita boleto pendente dentro do vencimento (reload da página não
    # gera boleto novo, igual à cobrança PIX)
    for existente in get_pagamentos_by_pedido_metodo(dados.pedido_id, "boleto"):
        if _boleto_vigente(existente):
            return _resposta_mp(existente)

    if ip_origem:
        _checar_velocity(ip_origem, dados.pedido_id)

    partes_nome = (pedido.get("nome_cliente") or "").split()
    primeiro_nome = partes_nome[0] if partes_nome else ""
    sobrenome = " ".join(partes_nome[1:]) or primeiro_nome
    vencimento = datetime.now(timezone.utc) + timedelta(days=BOLETO_DIAS_VENCIMENTO)

    payload = {
        "transaction_amount": round(pedido["total_centavos"] / 100, 2),
        "payment_method_id": "bolbradesco",
        "date_of_expiration": vencimento.astimezone(FUSO_BR).strftime(
            "%Y-%m-%dT%H:%M:%S.000-03:00"
        ),
        "payer": {
            "email": dados.email,
            "first_name": primeiro_nome,
            "last_name": sobrenome,
            "identification": _identificacao_mp(pedido),
            "address": {
                "zip_code": (pedido.get("cep") or "").replace("-", ""),
                "street_name": pedido.get("rua"),
                "street_number": pedido.get("numero"),
                "neighborhood": pedido.get("bairro"),
                "city": pedido.get("cidade"),
                "federal_unit": pedido.get("estado"),
            },
        },
        "external_reference": dados.pedido_id,
        "description": "Pedido Carolina Viapiana",
    }
    if MERCADO_PAGO_WEBHOOK_URL:
        payload["notification_url"] = MERCADO_PAGO_WEBHOOK_URL

    # Stable within a 5-minute window so network-timeout retries reuse the same
    # key instead of generating a new one and double-charging.
    idempotency_key = _idempotency_key(dados.pedido_id, "boleto")

    logger.info(
        "payment.initiated method=boleto pedido_id=%s valor_centavos=%d",
        dados.pedido_id, pedido["total_centavos"],
    )
    mp = mercadopago_client.criar_pagamento(payload, idempotency_key=idempotency_key)

    transacao = mp.get("transaction_details") or {}
    codigo_barras = mp.get("barcode") or {}
    row = insert_pagamento(
        {
            "pedido_id": dados.pedido_id,
            "metodo": "boleto",
            "mp_payment_id": str(mp["id"]),
            "valor_centavos": pedido["total_centavos"],
            "status": mp.get("status", "pending"),
            "detalhes": {
                "status_detail": mp.get("status_detail"),
                "boleto_url": transacao.get("external_resource_url"),
                "boleto_linha_digitavel": codigo_barras.get("content"),
                "boleto_vencimento": vencimento.isoformat(),
                "email_pagador": dados.email,
                "ip_origem": ip_origem,
            },
        }
    )
    if not row:
        raise HTTPException(status_code=500, detail="Falha ao registrar pagamento")
    logger.info("payment.initiated method=boleto pedido_id=%s mp_payment_id=%s", dados.pedido_id, row.get("mp_payment_id"))
    return _resposta_mp(row)


def consultar_pagamento_mp(mp_payment_id: str, user, token_pagamento: str | None) -> dict:
    row = get_pagamento_by_mp_id(mp_payment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    exigir_acesso_pedido(
        row["pedido_id"], user, token_pagamento, detail="Pagamento não encontrado"
    )
    if _situacao(row) == "pendente":
        try:
            mp = mercadopago_client.consultar_pagamento(mp_payment_id)
        except HTTPException:
            # PSP fora do ar não deve quebrar o polling; devolve o estado local
            return _resposta_mp(row)
        row = _aplicar_status_mp(row, mp)
    return _resposta_mp(row)


def _pagamento_ainda_pagavel(row: dict) -> bool:
    metodo = row.get("metodo", "pix")
    if metodo == "pix":
        return _cobranca_vigente(row)
    if metodo == "boleto":
        return _boleto_vigente(row)
    # Cartão pending/in_process pode aprovar depois (análise manual do MP)
    return _situacao(row) == "pendente"


def bloqueio_para_expiracao(pedido_id: str) -> str | None:
    """O que impede um pedido 'novo' antigo de expirar: 'aprovado' quando algum
    pagamento foi confirmado (o pedido deve virar 'pago', não 'cancelado');
    'pendente' quando ainda existe pagamento pagável (boleto no vencimento,
    cartão em análise, cobrança PIX vigente). None libera o cancelamento."""
    pagamentos = get_pagamentos_by_pedido(pedido_id)
    if any(_situacao(p) == "aprovado" for p in pagamentos):
        return "aprovado"
    if any(_pagamento_ainda_pagavel(p) for p in pagamentos):
        return "pendente"
    return None


def processar_webhook_mercadopago(payment_id: str, event_id: str | None = None) -> dict:
    """Notificação do Mercado Pago. O corpo/query nunca é confiado por si só:
    o status é reconferido direto no MP antes de marcar qualquer coisa como paga."""
    if event_id:
        if not webhook_evento_novo(event_id, "mercadopago"):
            logger.info("webhook.duplicate provider=mercadopago event_id=%s", event_id)
            return {"processados": 0}
        logger.info("webhook.received provider=mercadopago event_id=%s payment_id=%s", event_id, payment_id)

    row = get_pagamento_by_mp_id(payment_id)
    if not row or _situacao(row) != "pendente":
        return {"processados": 0}
    try:
        mp = mercadopago_client.consultar_pagamento(payment_id)
    except HTTPException:
        return {"processados": 0}
    atualizado = _aplicar_status_mp(row, mp)
    situacao = _situacao(atualizado)
    if situacao == "aprovado":
        logger.info("payment.succeeded method=%s pedido_id=%s mp_payment_id=%s", row.get("metodo"), row["pedido_id"], payment_id)
    elif situacao == "recusado":
        logger.warning("payment.failed method=%s pedido_id=%s mp_payment_id=%s", row.get("metodo"), row["pedido_id"], payment_id)
    return {"processados": 1}


def sincronizar_pagamentos_pendentes() -> int:
    """Fallback poll: reconcile pending PIX and MP payments that may have missed
    their webhook. Called from the background loop in main.py."""
    sincronizados = 0

    for row in get_pagamentos_pendentes_antigos("pix", minutos=5):
        txid = row.get("txid")
        if not txid:
            continue
        try:
            cob = sicredi_client.consultar_cob(txid)
            _aplicar_status_cob(row, cob)
            sincronizados += 1
        except HTTPException:
            pass

    for metodo in ("cartao", "boleto"):
        for row in get_pagamentos_pendentes_antigos(metodo, minutos=10):
            mp_id = row.get("mp_payment_id")
            if not mp_id:
                continue
            try:
                mp = mercadopago_client.consultar_pagamento(mp_id)
                _aplicar_status_mp(row, mp)
                sincronizados += 1
            except HTTPException:
                pass

    if sincronizados:
        logger.info("Fallback poll sincronizou %d pagamento(s) pendente(s)", sincronizados)
    return sincronizados
