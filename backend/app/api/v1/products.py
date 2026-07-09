from fastapi import APIRouter

from app.services.product_service import list_aromas, list_produtos

router = APIRouter()


@router.get("/produtos")
def get_produtos():
    return list_produtos()


@router.get("/aromas")
def get_aromas():
    return list_aromas()
