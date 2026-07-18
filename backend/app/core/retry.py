"""Retry de chamadas HTTP a serviços externos (PSPs e frete).

Reexecuta a requisição em falha transitória: erro de transporte (conexão,
timeout) ou resposta 502/503/504. Erros 4xx nunca são repetidos — são
definitivos e cada cliente já os traduz para o usuário.

Só usar em operações idempotentes. Hoje todas as chamadas externas são:
cobrança PIX é PUT keyed por txid, pagamento no Mercado Pago leva
X-Idempotency-Key e cotação de frete não tem efeito colateral.
"""

import time
from collections.abc import Callable

import httpx

_ESPERAS_SEGUNDOS = (0.5, 1.0)
_STATUS_TRANSITORIOS = {502, 503, 504}


def com_retry(enviar: Callable[[], httpx.Response]) -> httpx.Response:
    """Executa `enviar` até 3 vezes; devolve a primeira resposta não
    transitória ou propaga o erro da última tentativa."""
    for espera in _ESPERAS_SEGUNDOS:
        try:
            resp = enviar()
        except httpx.TransportError:
            time.sleep(espera)
            continue
        if resp.status_code in _STATUS_TRANSITORIOS:
            time.sleep(espera)
            continue
        return resp
    return enviar()
