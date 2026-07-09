from fastapi import APIRouter

from app.schemas.category import CategoriaResponse
from app.services.category_service import list_categorias

router = APIRouter()


@router.get("/categorias", response_model=list[CategoriaResponse])
def get_categorias():
    return list_categorias()
