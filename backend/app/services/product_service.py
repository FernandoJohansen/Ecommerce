import logging
from uuid import uuid4

from fastapi import HTTPException

from app.core.imagem import tipo_imagem_real
from app.repositories.product_repository import (
    PRODUTO_IMAGENS_BUCKET,
    adjust_estoque,
    get_all_aromas,
    get_all_produtos,
    get_all_produtos_admin,
    get_produto_by_id,
    get_produto_by_nome,
    insert_produto,
    remove_imagem_storage,
    repor_estoque_multiplo,
    reservar_estoque_multiplo,
    update_produto,
    update_produto_estoque,
    upload_imagem_storage,
)
from app.schemas.product import ProdutoCreate, ProdutoUpdate

logger = logging.getLogger(__name__)

IMAGEM_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
IMAGEM_MAX_BYTES = 5 * 1024 * 1024


# Nome do produto que serve de add-on quando um item é pedido "com refil".
REFIL_PRODUTO = "Refil"


def list_produtos() -> list[dict]:
    return get_all_produtos()


def list_aromas() -> list[dict]:
    return get_all_aromas()


def mapa_produtos() -> dict[str, dict]:
    """Produtos ativos indexados por nome, para validação e cálculo de preços."""
    return {p["nome"]: p for p in get_all_produtos()}


def preco_unitario(
    produtos: dict[str, dict], produto_nome: str, tamanho: str, refil: bool = False
) -> int:
    """Preço unitário em centavos de um item, incluindo o refil como add-on."""
    produto = produtos.get(produto_nome)
    if not produto:
        raise HTTPException(status_code=404, detail=f"Produto não encontrado: {produto_nome}")
    if tamanho not in (produto.get("tamanhos") or []):
        raise HTTPException(
            status_code=422, detail=f"Tamanho indisponível para {produto_nome}: {tamanho}"
        )
    preco = (produto.get("precos") or {}).get(tamanho)
    if preco is None:
        raise HTTPException(
            status_code=422, detail=f"Produto sem preço definido no tamanho {tamanho}: {produto_nome}"
        )
    if refil:
        # O add-on é um refil de difusor; não faz sentido sobre produtos que
        # já são refis (inclusive o de sabonete líquido).
        if "refil" in produto_nome.lower():
            raise HTTPException(
                status_code=422, detail=f"Refil não disponível para {produto_nome}"
            )
        preco_refil = (produtos.get(REFIL_PRODUTO, {}).get("precos") or {}).get(tamanho)
        if preco_refil is None:
            raise HTTPException(
                status_code=422, detail=f"Refil indisponível no tamanho {tamanho}"
            )
        preco += preco_refil
    return preco


def list_produtos_admin() -> list[dict]:
    return get_all_produtos_admin()


def _checar_precos_nos_tamanhos(tamanhos: list[str], precos: dict[str, int]) -> None:
    fora = sorted(set(precos) - set(tamanhos))
    if fora:
        raise HTTPException(
            status_code=422,
            detail=f"Preço para tamanho fora da lista de tamanhos: {', '.join(fora)}",
        )


def criar_produto(body: ProdutoCreate) -> dict:
    _checar_precos_nos_tamanhos(body.tamanhos, body.precos)
    if get_produto_by_nome(body.nome):
        raise HTTPException(status_code=409, detail=f"Já existe um produto chamado {body.nome}")
    return insert_produto(body.model_dump())


def atualizar_produto(produto_id: str, body: ProdutoUpdate) -> dict:
    atual = get_produto_by_id(produto_id)
    if not atual:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    campos = body.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(status_code=422, detail="Nenhum campo para atualizar")

    novo_nome = campos.get("nome")
    if novo_nome and novo_nome != atual["nome"] and get_produto_by_nome(novo_nome):
        raise HTTPException(status_code=409, detail=f"Já existe um produto chamado {novo_nome}")

    # Valida o estado final: tamanhos/preços não enviados vêm do produto atual.
    tamanhos = campos.get("tamanhos", atual.get("tamanhos") or [])
    precos = campos.get("precos", atual.get("precos") or {})
    _checar_precos_nos_tamanhos(tamanhos, precos)

    return update_produto(produto_id, campos)


def _produto_ou_404(produto_id: str) -> dict:
    produto = get_produto_by_id(produto_id)
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return produto


def adicionar_imagem(produto_id: str, content: bytes) -> dict:
    produto = _produto_ou_404(produto_id)
    # Valida pelos magic bytes, não pelo Content-Type do cliente; o tipo
    # detectado é o que vai para o storage.
    tipo_real = tipo_imagem_real(content)
    ext = IMAGEM_TYPES.get(tipo_real or "")
    if not ext:
        raise HTTPException(
            status_code=400, detail="Formato inválido. Envie uma imagem JPG, PNG ou WebP."
        )
    if len(content) > IMAGEM_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Imagem muito grande. O limite é 5MB.")

    path = f"{produto_id}/{uuid4().hex}.{ext}"
    try:
        url = upload_imagem_storage(path, content, tipo_real)
    except Exception:
        logger.exception("Upload de imagem falhou para o produto %s", produto_id)
        raise HTTPException(status_code=500, detail="Não foi possível enviar a imagem.")

    imagens = list(produto.get("imagens") or []) + [url]
    return update_produto(produto_id, {"imagens": imagens})


def remover_imagem(produto_id: str, url: str) -> dict:
    produto = _produto_ou_404(produto_id)
    imagens = list(produto.get("imagens") or [])
    if url not in imagens:
        raise HTTPException(status_code=404, detail="Imagem não encontrada neste produto")

    # Remove do storage antes de tirar da lista; se o arquivo já não existir,
    # a lista é atualizada mesmo assim.
    marcador = f"/object/public/{PRODUTO_IMAGENS_BUCKET}/"
    if marcador in url:
        try:
            remove_imagem_storage(url.split(marcador, 1)[1])
        except Exception:
            logger.exception("Remoção no storage falhou para %s", url)

    imagens.remove(url)
    return update_produto(produto_id, {"imagens": imagens})


def reordenar_imagens(produto_id: str, imagens: list[str]) -> dict:
    produto = _produto_ou_404(produto_id)
    atuais = list(produto.get("imagens") or [])
    if sorted(imagens) != sorted(atuais):
        raise HTTPException(
            status_code=422, detail="A nova ordem deve conter exatamente as imagens atuais"
        )
    return update_produto(produto_id, {"imagens": imagens})


def set_estoque(produto_id: str, estoque: int) -> dict:
    result = update_produto_estoque(produto_id, estoque)
    if not result:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return result


def baixar_estoque(produto_nome: str, quantidade: int) -> int:
    return _ajustar_estoque(produto_nome, -quantidade)


def repor_estoque(produto_nome: str, quantidade: int) -> int:
    return _ajustar_estoque(produto_nome, quantidade)


def reservar_estoque_pedido(por_produto: dict[str, int]) -> None:
    """Atomically reserve stock for all items in a single DB transaction."""
    try:
        reservar_estoque_multiplo(por_produto)
    except Exception as exc:
        message = str(exc)
        if "produto_nao_encontrado" in message:
            nome = message.split(":")[-1].strip() if ":" in message else ""
            raise HTTPException(
                status_code=404,
                detail=f"Produto não encontrado: {nome}" if nome else "Produto não encontrado",
            ) from exc
        if "estoque_insuficiente" in message:
            nome = message.split(":")[-1].strip() if ":" in message else ""
            raise HTTPException(
                status_code=409,
                detail=f"Estoque insuficiente para {nome}" if nome else "Estoque insuficiente",
            ) from exc
        raise


def repor_estoque_pedido(por_produto: dict[str, int]) -> None:
    """Atomically restore stock for all items in a single DB transaction."""
    try:
        repor_estoque_multiplo(por_produto)
    except Exception:
        logger.exception("Falha ao repor estoque para %s", list(por_produto.keys()))
        raise


def _ajustar_estoque(produto_nome: str, delta: int) -> int:
    try:
        return adjust_estoque(produto_nome, delta)
    except Exception as exc:
        message = str(exc)
        if "produto_nao_encontrado" in message:
            raise HTTPException(
                status_code=404, detail=f"Produto não encontrado: {produto_nome}"
            ) from exc
        if "estoque_insuficiente" in message:
            raise HTTPException(
                status_code=409, detail=f"Estoque insuficiente para {produto_nome}"
            ) from exc
        raise
