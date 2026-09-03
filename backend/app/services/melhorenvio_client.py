"""Cliente da API do Melhor Envio (cálculo de frete).

Autenticação por Bearer token estático (token gerado no painel do Melhor
Envio). A API exige um User-Agent com e-mail de contato técnico. Produção em
melhorenvio.com.br; sandbox em sandbox.melhorenvio.com.br.
"""

import threading

import httpx
from fastapi import HTTPException

from app.core.config import (
    MELHOR_ENVIO_BASE_URL,
    MELHOR_ENVIO_CONTATO,
    MELHOR_ENVIO_ENABLED,
    MELHOR_ENVIO_TOKEN,
)
from app.core.retry import com_retry

_http_client: httpx.Client | None = None
_client_lock = threading.Lock()


def exigir_melhor_envio() -> None:
    if not MELHOR_ENVIO_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Cálculo de frete indisponível no momento.",
        )


def _get_client() -> httpx.Client:
    global _http_client
    if _http_client is None:
        with _client_lock:
            if _http_client is None:
                _http_client = httpx.Client(
                    base_url=MELHOR_ENVIO_BASE_URL,
                    headers={
                        "Authorization": f"Bearer {MELHOR_ENVIO_TOKEN}",
                        "Accept": "application/json",
                        "User-Agent": f"Carolina Viapiana ({MELHOR_ENVIO_CONTATO or 'sem contato'})",
                    },
                    timeout=20.0,
                )
    return _http_client


def close_client() -> None:
    global _http_client
    if _http_client is not None:
        _http_client.close()
        _http_client = None


def calcular_frete(
    cep_origem: str,
    cep_destino: str,
    pacote: dict,
    valor_segurado_reais: float,
) -> list[dict]:
    """Cota o envio de um pacote (POST /api/v2/me/shipment/calculate) e
    retorna a lista de serviços disponíveis (PAC, SEDEX, Jadlog…). Serviços
    que a API devolve com "error" (ex.: fora da área de cobertura) são
    filtrados aqui."""
    exigir_melhor_envio()
    payload = {
        "from": {"postal_code": cep_origem},
        "to": {"postal_code": cep_destino},
        "package": pacote,
        "options": {
            "insurance_value": valor_segurado_reais,
            "receipt": False,
            "own_hand": False,
        },
    }
    try:
        resp = com_retry(
            lambda: _get_client().post(
                "/api/v2/me/shipment/calculate",
                json=payload,
            )
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Serviço de frete inacessível")

    if resp.status_code == 422:
        # CEP inexistente/mal formado é o caso acionável pelo usuário
        raise HTTPException(status_code=422, detail="CEP de entrega inválido para o frete")
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="Erro do serviço de frete")

    servicos = resp.json()
    if not isinstance(servicos, list):
        raise HTTPException(status_code=502, detail="Erro do serviço de frete")
    return [s for s in servicos if not s.get("error")]
