"""Detecção do tipo real de imagem pelos magic bytes.

O Content-Type do upload é controlado pelo cliente e não prova nada; os
buckets de avatar/produto são públicos, então só entra arquivo cujo conteúdo
é de fato JPEG, PNG ou WebP. O tipo detectado também substitui o header na
hora de salvar no storage.
"""


def tipo_imagem_real(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None
