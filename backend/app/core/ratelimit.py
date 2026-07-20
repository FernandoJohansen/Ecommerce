"""Rate limiting por IP do cliente (slowapi, contadores em memória).

O IP real é resolvido de forma resistente a spoofing (ver core/config.py):

- RATE_LIMIT_CLIENT_IP_HEADER: header próprio do CDN com só o IP real do
  cliente (Cloudflare: cf-connecting-ip). O CDN remove cópias enviadas pelo
  cliente, então o valor é confiável.
- RATE_LIMIT_TRUSTED_PROXY_HOPS: nº de proxies reversos que só ANEXAM ao
  X-Forwarded-For. O IP do cliente é o que está a N posições do fim da lista;
  qualquer valor injetado pelo cliente fica à esquerda desse e é ignorado.
- Nenhum dos dois configurado: usa o IP da conexão (peer), que o cliente não
  forja. Default seguro — NUNCA confiar no primeiro valor de X-Forwarded-For.

Os contadores vivem na memória do processo — suficiente para o deploy atual de
instância única; com múltiplas instâncias, trocar por storage compartilhado
(redis) ou limitar na borda.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from app.core.config import (
    RATE_LIMIT_CLIENT_IP_HEADER,
    RATE_LIMIT_TRUSTED_PROXY_HOPS,
)

_DESCONHECIDO = "desconhecido"


def _peer_ip(request: Request) -> str:
    return request.client.host if request.client else _DESCONHECIDO


def _client_ip(request: Request) -> str:
    # 1) Header dedicado do CDN (valor único, não forjável pelo cliente).
    if RATE_LIMIT_CLIENT_IP_HEADER:
        valor = request.headers.get(RATE_LIMIT_CLIENT_IP_HEADER, "").strip()
        return valor or _peer_ip(request)

    # 2) X-Forwarded-For com nº fixo de proxies confiáveis: cada proxy anexa o
    # IP de quem o chamou, então o cliente real está a `hops` posições do fim.
    # Ler a partir da direita impede que valores injetados pelo cliente (que
    # ficam à esquerda) sejam escolhidos.
    if RATE_LIMIT_TRUSTED_PROXY_HOPS > 0:
        forwarded = request.headers.get("x-forwarded-for", "")
        ips = [p.strip() for p in forwarded.split(",") if p.strip()]
        indice = len(ips) - RATE_LIMIT_TRUSTED_PROXY_HOPS
        if 0 <= indice < len(ips):
            return ips[indice]
        return _peer_ip(request)

    # 3) Sem proxy configurado: IP da conexão. Não confiar em X-Forwarded-For.
    return _peer_ip(request)


limiter = Limiter(key_func=_client_ip)


# Mesmo formato {"detail": ...} dos erros do FastAPI, que o apiFetch do
# frontend já mostra ao usuário
def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Muitas tentativas. Aguarde um instante e tente novamente."},
    )
