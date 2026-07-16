"""Expiração de pedidos não pagos (Sprint 10 — hardening).

Pedido 'novo' reserva estoque na criação; sem expiração, pedidos abandonados
(ou criados em massa por abuso) prendem o estoque para sempre. A varredura
cancela pedidos 'novo' mais antigos que PEDIDO_EXPIRA_HORAS e devolve o
estoque. Regras:

- 'em_andamento' (negociação manual pelo WhatsApp) nunca expira — a equipe
  deve mover o pedido para esse status ao assumir o atendimento;
- pedido com pagamento aprovado que não chegou a ser marcado vira 'pago';
- pedido com pagamento ainda pagável (boleto no vencimento, cartão em
  análise, cobrança PIX vigente) espera a próxima varredura.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.core.config import PEDIDO_EXPIRA_HORAS
from app.repositories.order_repository import get_pedidos_novos_antes, update_pedido_se_status
from app.services.order_service import quantidades_por_produto
from app.services.payment_service import bloqueio_para_expiracao
from app.services.product_service import repor_estoque

logger = logging.getLogger(__name__)


def expirar_pedidos_nao_pagos() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=PEDIDO_EXPIRA_HORAS)
    cancelados = 0
    for pedido in get_pedidos_novos_antes(cutoff.isoformat()):
        bloqueio = bloqueio_para_expiracao(pedido["id"])
        if bloqueio == "aprovado":
            update_pedido_se_status(pedido["id"], "novo", {"status": "pago"})
            logger.info("Pedido %s tinha pagamento aprovado; marcado como pago", pedido["id"])
            continue
        if bloqueio == "pendente":
            continue
        # Só devolve estoque se ESTA varredura fez a transição novo→cancelado;
        # se o status mudou no meio (webhook/admin), não mexe em nada.
        if not update_pedido_se_status(pedido["id"], "novo", {"status": "cancelado"}):
            continue
        _devolver_estoque(pedido.get("itens") or [])
        cancelados += 1
    if cancelados:
        logger.info("Pedidos não pagos expirados: %d cancelado(s)", cancelados)
    return cancelados


def _devolver_estoque(itens: list[dict]) -> None:
    for produto_nome, quantidade in quantidades_por_produto(itens).items():
        try:
            repor_estoque(produto_nome, quantidade)
        except HTTPException:
            # Produto removido/renomeado desde o pedido — segue devolvendo os demais
            logger.warning("Não foi possível devolver %d× %r", quantidade, produto_nome)
