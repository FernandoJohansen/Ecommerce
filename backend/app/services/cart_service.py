import logging

from fastapi import HTTPException

from app.repositories.cart_repository import (
    clear_items,
    delete_item,
    find_matching_item,
    get_items,
    insert_item,
    update_item,
)
from app.schemas.cart import CartCheckoutRequest, CartItemCreate, CartItemUpdate
from app.services.order_service import criar_pedido
from app.services.product_service import mapa_produtos, preco_unitario

logger = logging.getLogger(__name__)


def list_cart(user_id: str) -> list[dict]:
    produtos = mapa_produtos()
    itens = []
    for item in get_items(user_id):
        try:
            preco = preco_unitario(produtos, item["produto_nome"], item["tamanho"], item["refil"])
        except HTTPException:
            # Produto saiu do catálogo ou ficou sem preço: mantém o item
            # visível no carrinho, sem valor.
            preco = None
        itens.append(
            {
                **item,
                "preco_unitario_centavos": preco,
                "subtotal_centavos": preco * item["quantidade"] if preco is not None else None,
            }
        )
    return itens


def add_to_cart(user_id: str, item: CartItemCreate) -> dict:
    data = item.model_dump()
    existing = find_matching_item(user_id, data)
    if existing:
        return update_item(
            existing["id"],
            user_id,
            {"quantidade": min(existing["quantidade"] + item.quantidade, 99)},
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


def checkout_cart(user, dados: CartCheckoutRequest) -> dict:
    items = get_items(user.id)
    if not items:
        raise HTTPException(status_code=400, detail="Carrinho vazio")

    pedido = criar_pedido(
        itens=[
            {
                "produto_nome": item["produto_nome"],
                "tamanho": item["tamanho"],
                "aroma": item["aroma"],
                "refil": item["refil"],
                "quantidade": item["quantidade"],
            }
            for item in items
        ],
        nome_cliente=dados.nome_cliente,
        telefone=dados.telefone,
        cpf_cnpj=dados.cpf_cnpj,
        endereco=dados.endereco.model_dump(),
        observacoes=dados.observacoes,
        user_id=user.id,
        frete_servico_id=dados.frete.servico_id if dados.frete else None,
    )
    try:
        clear_items(user.id)
    except Exception:
        # O pedido já foi criado e o estoque baixado; falhar aqui devolveria
        # erro ao cliente e induziria um pedido duplicado no retry.
        logger.warning(
            "Pedido %s criado, mas falhou ao limpar o carrinho do usuário %s",
            pedido["id"],
            user.id,
            exc_info=True,
        )
    return pedido
