from fastapi import HTTPException

from app.repositories.cart_repository import (
    clear_items,
    delete_item,
    find_matching_item,
    get_items,
    insert_item,
    update_item,
)
from app.repositories.order_repository import insert_pedido
from app.schemas.cart import CartItemCreate, CartItemUpdate
from app.services.product_service import baixar_estoque, repor_estoque


def list_cart(user_id: str) -> list[dict]:
    return get_items(user_id)


def add_to_cart(user_id: str, item: CartItemCreate) -> dict:
    data = item.model_dump()
    existing = find_matching_item(user_id, data)
    if existing:
        return update_item(
            existing["id"], user_id, {"quantidade": existing["quantidade"] + item.quantidade}
        )
    result = insert_item({**data, "user_id": user_id})
    if not result:
        raise HTTPException(status_code=500, detail="Falha ao adicionar ao carrinho")
    return result


def update_cart_item(user_id: str, item_id: str, item: CartItemUpdate) -> dict:
    result = update_item(item_id, user_id, item.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return result


def remove_cart_item(user_id: str, item_id: str) -> dict:
    result = delete_item(item_id, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return result


def clear_cart(user_id: str) -> dict:
    return {"removed": clear_items(user_id)}


def checkout_cart(user, observacoes: str | None = None) -> list[dict]:
    items = get_items(user.id)
    if not items:
        raise HTTPException(status_code=400, detail="Carrinho vazio")
    metadata = user.user_metadata or {}
    nome_cliente = metadata.get("name") or user.email

    # Reserve stock for the whole cart before creating any pedido; if one
    # product falls short, put back what was already taken and abort.
    por_produto: dict[str, int] = {}
    for item in items:
        por_produto[item["produto_nome"]] = (
            por_produto.get(item["produto_nome"], 0) + item["quantidade"]
        )
    baixados: list[tuple[str, int]] = []
    try:
        for produto_nome, quantidade in por_produto.items():
            baixar_estoque(produto_nome, quantidade)
            baixados.append((produto_nome, quantidade))
    except HTTPException:
        for produto_nome, quantidade in baixados:
            repor_estoque(produto_nome, quantidade)
        raise

    pedidos = []
    for item in items:
        pedido = insert_pedido(
            {
                "produto_nome": item["produto_nome"],
                "tamanho": item["tamanho"],
                "aroma": item["aroma"],
                "refil": item["refil"],
                "quantidade": item["quantidade"],
                "nome_cliente": nome_cliente,
                "observacoes": observacoes,
            }
        )
        if not pedido:
            raise HTTPException(status_code=500, detail="Falha ao registrar pedido")
        pedidos.append(pedido)
    clear_items(user.id)
    return pedidos
