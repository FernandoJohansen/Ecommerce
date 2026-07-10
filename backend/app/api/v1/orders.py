from fastapi import APIRouter, Depends

from app.dependencies.auth import get_optional_user, get_staff_user
from app.schemas.order import PedidoCreate, PedidoResponse, PedidoUpdate
from app.services.order_service import (
    create_pedido,
    list_pedidos,
    remove_pedido,
    update_pedido_status,
)

router = APIRouter()


@router.post("/pedidos", response_model=PedidoResponse, status_code=201)
def post_pedido(pedido: PedidoCreate, user=Depends(get_optional_user)):
    return create_pedido(pedido, user_id=user.id if user else None)


@router.get("/pedidos")
def get_pedidos(_user=Depends(get_staff_user)):
    return list_pedidos()


@router.patch("/pedidos/{pedido_id}")
def patch_pedido(pedido_id: str, pedido: PedidoUpdate, _user=Depends(get_staff_user)):
    return update_pedido_status(pedido_id, pedido)


@router.delete("/pedidos/{pedido_id}")
def del_pedido(pedido_id: str, _user=Depends(get_staff_user)):
    return remove_pedido(pedido_id)
