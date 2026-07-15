from fastapi import APIRouter

from app.schemas.frete import CotacaoFreteRequest, CotacaoFreteResponse
from app.services.frete_service import cotar_frete

router = APIRouter(prefix="/frete", tags=["frete"])


@router.post("/cotacao", response_model=CotacaoFreteResponse)
def post_cotacao(body: CotacaoFreteRequest):
    return cotar_frete(body.cep, [item.model_dump() for item in body.itens])
