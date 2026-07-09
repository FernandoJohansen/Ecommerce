from fastapi import APIRouter

from app.schemas.payment import PixResponse
from app.services.payment_service import get_pix_info

router = APIRouter(prefix="/pagamento", tags=["pagamento"])


@router.get("/pix", response_model=PixResponse)
def get_pix():
    return get_pix_info()
