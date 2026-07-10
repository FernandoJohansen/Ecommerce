from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.schemas.cart import (
    CartCheckoutRequest,
    CartItemCreate,
    CartItemResponse,
    CartItemUpdate,
)
from app.schemas.order import PedidoResponse
from app.services.cart_service import (
    add_to_cart,
    checkout_cart,
    clear_cart,
    list_cart,
    remove_cart_item,
    update_cart_item,
)

router = APIRouter(prefix="/carrinho", tags=["carrinho"])


@router.get("", response_model=list[CartItemResponse])
def get_cart(user=Depends(get_current_user)):
    return list_cart(user.id)


@router.post("", response_model=CartItemResponse, status_code=201)
def post_cart_item(item: CartItemCreate, user=Depends(get_current_user)):
    return add_to_cart(user.id, item)


@router.patch("/{item_id}", response_model=CartItemResponse)
def patch_cart_item(item_id: str, item: CartItemUpdate, user=Depends(get_current_user)):
    return update_cart_item(user.id, item_id, item)


@router.delete("/{item_id}")
def delete_cart_item(item_id: str, user=Depends(get_current_user)):
    return remove_cart_item(user.id, item_id)


@router.delete("")
def delete_cart(user=Depends(get_current_user)):
    return clear_cart(user.id)


@router.post("/finalizar", response_model=PedidoResponse, status_code=201)
def finalize_cart(body: CartCheckoutRequest, user=Depends(get_current_user)):
    return checkout_cart(user, body)
