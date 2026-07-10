from fastapi import HTTPException

from app.repositories.product_repository import (
    adjust_estoque,
    get_all_aromas,
    get_all_produtos,
    update_produto_estoque,
)


def list_produtos() -> list[dict]:
    return get_all_produtos()


def list_aromas() -> list[dict]:
    return get_all_aromas()


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
