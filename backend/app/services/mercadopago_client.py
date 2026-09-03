"""Cliente da API de pagamentos do Mercado Pago (cartão de crédito + boleto).

Autenticação por Bearer token estático (access token da aplicação) — sem
OAuth nem mTLS. POST /v1/payments exige o header X-Idempotency-Key; sem ele
o MP responde 400.
"""

import httpx
from fastapi import HTTPException

from app.core.config import (
    MERCADO_PAGO_ACCESS_TOKEN,
    MERCADO_PAGO_BASE_URL,
    MERCADO_PAGO_ENABLED,
)
from app.core.retry import com_retry


import threading

_http_client: httpx.Client | None = None
_client_lock = threading.Lock()


def exigir_mercado_pago() -> None:
    if not MERCADO_PAGO_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Este método de pagamento está indisponível no momento.",
        )


def _get_client() -> httpx.Client:
    global _http_client
    if _http_client is None:
        with _client_lock:
            if _http_client is None:
                _http_client = httpx.Client(
                    base_url=MERCADO_PAGO_BASE_URL,
                    headers={"Authorization": f"Bearer {MERCADO_PAGO_ACCESS_TOKEN}"},
                    timeout=20.0,
                )
    return _http_client


def close_client() -> None:
    global _http_client
    if _http_client is not None:
        _http_client.close()
        _http_client = None


def _requisicao(
    metodo: str, caminho: str, json: dict | None = None, idempotency_key: str | None = None
) -> dict:
    exigir_mercado_pago()
    headers = {"X-Idempotency-Key": idempotency_key} if idempotency_key else {}
    try:
        # Retry seguro: criação de pagamento leva X-Idempotency-Key
        resp = com_retry(lambda: _get_client().request(metodo, caminho, json=json, headers=headers))
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="PSP de pagamento inacessível")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado no PSP")
    if resp.status_code == 400:
        # Erros 400 do MP costumam ser acionáveis pelo usuário (ex.: token do
        # cartão expirado — vale ~7 min); repassa a mensagem como 422.
        try:
            mensagem = resp.json().get("message") or "Dados de pagamento inválidos"
        except Exception:
            mensagem = "Dados de pagamento inválidos"
        raise HTTPException(status_code=422, detail=mensagem)
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="Erro do PSP de pagamento")
    return resp.json()


def criar_pagamento(payload: dict, idempotency_key: str) -> dict:
    """Cria um pagamento (POST /v1/payments) — cartão ou boleto, conforme o
    payment_method_id do payload."""
    return _requisicao("POST", "/v1/payments", json=payload, idempotency_key=idempotency_key)


def consultar_pagamento(payment_id: str) -> dict:
    return _requisicao("GET", f"/v1/payments/{payment_id}")
