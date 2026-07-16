"""Rate limiting por IP do cliente (slowapi, contadores em memória).

Atrás de proxy/CDN (Cloudflare, Render, Railway) o IP real do cliente vem no
primeiro valor de X-Forwarded-For; sem proxy, usa o IP da conexão. Os
contadores vivem na memória do processo — suficiente para o deploy atual de
instância única; com múltiplas instâncias, trocar por storage compartilhado
(redis) ou limitar na borda.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"


limiter = Limiter(key_func=_client_ip)


# Mesmo formato {"detail": ...} dos erros do FastAPI, que o apiFetch do
# frontend já mostra ao usuário
def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Muitas tentativas. Aguarde um instante e tente novamente."},
    )
