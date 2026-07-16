from fastapi import APIRouter, Depends, File, UploadFile

from app.dependencies.auth import get_staff_user
from app.services.audit_service import registrar_auditoria
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
def post_produto(body: ProdutoCreate, user=Depends(get_staff_user)):
    result = criar_produto(body)
    registrar_auditoria(user, "produto.criar", "produto", result.get("id"), {"nome": body.nome})
    return result


@router.patch("/produtos/{produto_id}")
def patch_produto(produto_id: str, body: ProdutoUpdate, user=Depends(get_staff_user)):
    result = atualizar_produto(produto_id, body)
    registrar_auditoria(
        user, "produto.atualizar", "produto", produto_id, body.model_dump(exclude_unset=True)
    )
    return result


@router.patch("/produtos/{produto_id}/estoque")
def patch_estoque(produto_id: str, body: EstoqueUpdate, user=Depends(get_staff_user)):
    result = set_estoque(produto_id, body.estoque)
    registrar_auditoria(user, "produto.estoque", "produto", produto_id, {"estoque": body.estoque})
    return result


@router.post("/produtos/{produto_id}/imagens", status_code=201)
async def post_imagem(produto_id: str, file: UploadFile = File(...), user=Depends(get_staff_user)):
    content = await file.read()
    result = adicionar_imagem(produto_id, content)
    imagens = result.get("imagens") or []
    registrar_auditoria(
        user, "produto.imagem.adicionar", "produto", produto_id,
        {"url": imagens[-1] if imagens else None},
    )
    return result


@router.put("/produtos/{produto_id}/imagens")
def put_imagens(produto_id: str, body: ImagensReorder, user=Depends(get_staff_user)):
    result = reordenar_imagens(produto_id, body.imagens)
    registrar_auditoria(
        user, "produto.imagem.reordenar", "produto", produto_id, {"imagens": body.imagens}
    )
    return result


@router.delete("/produtos/{produto_id}/imagens")
def delete_imagem(produto_id: str, body: ImagemRemove, user=Depends(get_staff_user)):
    result = remover_imagem(produto_id, body.url)
    registrar_auditoria(user, "produto.imagem.remover", "produto", produto_id, {"url": body.url})
    return result


@router.get("/aromas")
def get_aromas():
    return list_aromas()
