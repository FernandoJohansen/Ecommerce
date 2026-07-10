from fastapi import APIRouter, Depends

from app.dependencies.auth import get_staff_user
from app.schemas.product import EstoqueUpdate
from app.services.product_service import list_aromas, list_produtos, set_estoque

router = APIRouter()


@router.get("/produtos")
def get_produtos():
    return list_produtos()


@router.patch("/produtos/{produto_id}/estoque")
def patch_estoque(produto_id: str, body: EstoqueUpdate, _user=Depends(get_staff_user)):
    return set_estoque(produto_id, body.estoque)


@router.get("/aromas")
def get_aromas():
    return list_aromas()
