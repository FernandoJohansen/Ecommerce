"""Cliente da API Pix do Sicredi (padrão Bacen).

Todas as chamadas usam mTLS (certificado emitido no Portal do Desenvolvedor
Sicredi + chave APLICACAO.KEY) e um token OAuth2 client_credentials obtido em
POST /oauth/token. O token vale ~60min e deve ser reaproveitado — o Sicredi
pode bloquear IPs que pedem token em excesso.
"""

import threading
import time

import httpx
from fastapi import HTTPException

from app.core.config import (
    SICREDI_BASE_URL,
    SICREDI_CA_PATH,
    SICREDI_CERT_PATH,
    SICREDI_CLIENT_ID,
    SICREDI_CLIENT_SECRET,
    SICREDI_ENABLED,
    SICREDI_KEY_PATH,
)
from app.core.retry import com_retry

SCOPES = "cob.read cob.write pix.read webhook.read webhook.write"

_lock = threading.Lock()
_token: str | None = None
_token_expira_em: float = 0.0


def exigir_sicredi() -> None:
    if not SICREDI_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Pagamento PIX indisponível no momento. Finalize pelo WhatsApp.",
        )


def _client() -> httpx.Client:
    return httpx.Client(
        base_url=SICREDI_BASE_URL,
        cert=(SICREDI_CERT_PATH, SICREDI_KEY_PATH),
        verify=SICREDI_CA_PATH or True,
        timeout=20.0,
    )


def _obter_token(client: httpx.Client) -> str:
    global _token, _token_expira_em
    with _lock:
        if _token and time.monotonic() < _token_expira_em:
            return _token
        resp = com_retry(
            lambda: client.post(
                "/oauth/token",
                auth=(SICREDI_CLIENT_ID, SICREDI_CLIENT_SECRET),
                data={"grant_type": "client_credentials", "scope": SCOPES},
            )
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502, detail="Falha na autenticação com o PSP de pagamento"
            )
        body = resp.json()
        _token = body["access_token"]
        # renova 60s antes de expirar
        _token_expira_em = time.monotonic() + int(body.get("expires_in", 3600)) - 60
        return _token


def _invalidar_token() -> None:
    global _token
    with _lock:
        _token = None


def _requisicao(metodo: str, caminho: str, json: dict | None = None) -> dict:
    exigir_sicredi()
    try:
        with _client() as client:
            token = _obter_token(client)
            resp = com_retry(
                lambda: client.request(
                    metodo, caminho, json=json, headers={"Authorization": f"Bearer {token}"}
                )
            )
            if resp.status_code == 401:
                # token revogado antes do prazo: renova uma vez e repete
                _invalidar_token()
                token = _obter_token(client)
                resp = com_retry(
                    lambda: client.request(
                        metodo, caminho, json=json, headers={"Authorization": f"Bearer {token}"}
                    )
                )
    except HTTPException:
        raise
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="PSP de pagamento inacessível")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Cobrança não encontrada no PSP")
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="Erro do PSP de pagamento")
    return resp.json()


def criar_cob(txid: str, valor_centavos: int, chave: str, descricao: str, expiracao: int) -> dict:
    """Cria uma cobrança imediata (PUT /api/v2/cob/{txid}); retorna o payload
    do Bacen, incluindo pixCopiaECola."""
    return _requisicao(
        "PUT",
        f"/api/v2/cob/{txid}",
        json={
            "calendario": {"expiracao": expiracao},
            "valor": {"original": f"{valor_centavos / 100:.2f}"},
            "chave": chave,
            "solicitacaoPagador": descricao,
        },
    )


def consultar_cob(txid: str) -> dict:
    return _requisicao("GET", f"/api/v2/cob/{txid}")


def configurar_webhook(chave: str, webhook_url: str) -> None:
    # 200/201/204 contam como sucesso; _requisicao já converte erros em 502.
    # PUT /webhook/{chave} pode retornar corpo vazio — tratado abaixo.
    exigir_sicredi()
    try:
        with _client() as client:
            token = _obter_token(client)
            resp = com_retry(
                lambda: client.put(
                    f"/api/v2/webhook/{chave}",
                    json={"webhookUrl": webhook_url},
                    headers={"Authorization": f"Bearer {token}"},
                )
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="PSP de pagamento inacessível")
    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail="Falha ao registrar webhook no PSP")


def consultar_webhook(chave: str) -> dict:
    return _requisicao("GET", f"/api/v2/webhook/{chave}")
