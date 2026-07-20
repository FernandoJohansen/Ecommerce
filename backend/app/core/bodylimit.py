"""Limite global de tamanho do corpo da requisição (anti-abuso).

uvicorn/Starlette não impõem limite: sem isso, um POST de gigabytes é lido
para a memória antes de a validação Pydantic rejeitar. Este middleware corta
em duas camadas: recusa cedo pelo Content-Length declarado e, para corpos
chunked (sem Content-Length), conta os bytes recebidos e aborta ao estourar.

Endpoints JSON nunca chegam perto de 1MB; os únicos uploads legítimos são as
imagens de produto (5MB) e o avatar (2MB), ambos multipart — esses caminhos
ganham um teto maior, com folga para o overhead do multipart.
"""

import json

from starlette.types import ASGIApp, Message, Receive, Scope, Send

JSON_MAX_BYTES = 1 * 1024 * 1024
UPLOAD_MAX_BYTES = 8 * 1024 * 1024
_UPLOAD_SUFFIXES = ("/imagens", "/me/avatar")


class _CorpoMuitoGrande(Exception):
    pass


def _resposta_413(limite_bytes: int) -> tuple[Message, Message]:
    corpo = json.dumps(
        {"detail": f"Requisição muito grande. O limite é {limite_bytes // (1024 * 1024)}MB."}
    ).encode()
    return (
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(corpo)).encode()),
            ],
        },
        {"type": "http.response.body", "body": corpo},
    )


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "")
        limite = UPLOAD_MAX_BYTES if path.endswith(_UPLOAD_SUFFIXES) else JSON_MAX_BYTES

        for nome, valor in scope.get("headers", []):
            if nome == b"content-length":
                try:
                    declarado = int(valor)
                except ValueError:
                    break
                if declarado > limite:
                    inicio, corpo = _resposta_413(limite)
                    await send(inicio)
                    await send(corpo)
                    return
                break

        # Content-Length ausente ou mentiroso (transfer chunked): conta o que
        # realmente chega e aborta antes de o corpo crescer sem limite.
        recebido = 0
        resposta_iniciada = False

        async def receive_limitado() -> Message:
            nonlocal recebido
            mensagem = await receive()
            if mensagem["type"] == "http.request":
                recebido += len(mensagem.get("body", b""))
                if recebido > limite:
                    raise _CorpoMuitoGrande
            return mensagem

        async def send_rastreado(mensagem: Message) -> None:
            nonlocal resposta_iniciada
            if mensagem["type"] == "http.response.start":
                resposta_iniciada = True
            await send(mensagem)

        try:
            await self.app(scope, receive_limitado, send_rastreado)
        except _CorpoMuitoGrande:
            if not resposta_iniciada:
                inicio, corpo = _resposta_413(limite)
                await send(inicio)
                await send(corpo)
