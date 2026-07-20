"""Detecção do tipo real de imagem pelos magic bytes.

O Content-Type do upload é controlado pelo cliente e não prova nada; os
buckets de avatar/produto são públicos, então só entra arquivo cujo conteúdo
é de fato JPEG, PNG ou WebP. O tipo detectado também substitui o header na
hora de salvar no storage.
"""

from fastapi import HTTPException, UploadFile, status

_CHUNK = 64 * 1024


async def ler_upload_limitado(file: UploadFile, limite_bytes: int) -> bytes:
    """Lê o upload em blocos e aborta assim que passar do limite, sem nunca
    carregar o corpo inteiro na memória. `await file.read()` puro leria vários
    GB antes de qualquer checagem de tamanho (DoS de memória)."""
    buffer = bytearray()
    while chunk := await file.read(_CHUNK):
        buffer.extend(chunk)
        if len(buffer) > limite_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Imagem muito grande. O limite é {limite_bytes // (1024 * 1024)}MB.",
            )
    return bytes(buffer)


def tipo_imagem_real(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None
