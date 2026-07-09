from fastapi import HTTPException

from app.repositories.order_repository import (
    delete_pedido,
    get_all_pedidos,
    insert_pedido,
    update_pedido,
)
from app.schemas.order import PedidoCreate, PedidoUpdate


def create_pedido(pedido: PedidoCreate) -> dict:
    result = insert_pedido(pedido.model_dump())
    if not result:
        raise HTTPException(status_code=500, detail="Falha ao salvar pedido")
    return result


def list_pedidos() -> list[dict]:
    return get_all_pedidos()


def update_pedido_status(pedido_id: str, pedido: PedidoUpdate) -> dict:
    result = update_pedido(pedido_id, pedido.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return result


def remove_pedido(pedido_id: str) -> dict:
    result = delete_pedido(pedido_id)
    if not result:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return result
