from fastapi import APIRouter, Request

from app.core.ratelimit import limiter
from app.schemas.frete import CotacaoFreteRequest, CotacaoFreteResponse
from app.services.frete_service import cotar_frete

router = APIRouter(prefix="/frete", tags=["frete"])


# Público e repassado ao Melhor Envio — limite por IP protege a cota do token
@router.post("/cotacao", response_model=CotacaoFreteResponse)
@limiter.limit("20/minute")
def post_cotacao(request: Request, body: CotacaoFreteRequest):
    return cotar_frete(body.cep, [item.model_dump() for item in body.itens])
