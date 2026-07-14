from fastapi import HTTPException

from app.repositories.product_repository import (
    adjust_estoque,
    get_all_aromas,
    get_all_produtos,
    get_all_produtos_admin,
    get_produto_by_id,
    get_produto_by_nome,
    insert_produto,
    update_produto,
    update_produto_estoque,
)
from app.schemas.product import ProdutoCreate, ProdutoUpdate


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


def set_estoque(produto_id: str, estoque: int) -> dict:
    result = update_produto_estoque(produto_id, estoque)
    if not result:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return result


def baixar_estoque(produto_nome: str, quantidade: int) -> int:
    return _ajustar_estoque(produto_nome, -quantidade)


def repor_estoque(produto_nome: str, quantidade: int) -> int:
    return _ajustar_estoque(produto_nome, quantidade)


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
