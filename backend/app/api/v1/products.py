from fastapi import APIRouter, Depends, File, UploadFile

from app.dependencies.auth import get_staff_user
from app.schemas.product import (
    EstoqueUpdate,
    ImagemRemove,
    ImagensReorder,
    ProdutoCreate,
    ProdutoUpdate,
)
from app.services.product_service import (
    adicionar_imagem,
    atualizar_produto,
    criar_produto,
    list_aromas,
    list_produtos,
    list_produtos_admin,
    remover_imagem,
    reordenar_imagens,
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


@router.post("/produtos/{produto_id}/imagens", status_code=201)
async def post_imagem(
    produto_id: str, file: UploadFile = File(...), _user=Depends(get_staff_user)
):
    content = await file.read()
    return adicionar_imagem(produto_id, content, file.content_type)


@router.put("/produtos/{produto_id}/imagens")
def put_imagens(produto_id: str, body: ImagensReorder, _user=Depends(get_staff_user)):
    return reordenar_imagens(produto_id, body.imagens)


@router.delete("/produtos/{produto_id}/imagens")
def delete_imagem(produto_id: str, body: ImagemRemove, _user=Depends(get_staff_user)):
    return remover_imagem(produto_id, body.url)


@router.get("/aromas")
def get_aromas():
    return list_aromas()
