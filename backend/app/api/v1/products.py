from fastapi import APIRouter, Depends

from app.dependencies.auth import get_staff_user
from app.schemas.product import EstoqueUpdate, ProdutoCreate, ProdutoUpdate
from app.services.product_service import (
    atualizar_produto,
    criar_produto,
    list_aromas,
    list_produtos,
    list_produtos_admin,
    set_estoque,
)

router = APIRouter()


@router.get("/produtos")
def get_produtos():
    return list_produtos()


@router.get("/produtos/admin")
def get_produtos_admin(_user=Depends(get_staff_user)):
    return list_produtos_admin()


@router.post("/produtos", status_code=201)
def post_produto(body: ProdutoCreate, _user=Depends(get_staff_user)):
    return criar_produto(body)


@router.patch("/produtos/{produto_id}")
def patch_produto(produto_id: str, body: ProdutoUpdate, _user=Depends(get_staff_user)):
    return atualizar_produto(produto_id, body)


@router.patch("/produtos/{produto_id}/estoque")
def patch_estoque(produto_id: str, body: EstoqueUpdate, _user=Depends(get_staff_user)):
    return set_estoque(produto_id, body.estoque)


@router.get("/aromas")
def get_aromas():
    return list_aromas()
