from fastapi import APIRouter, Depends, Request

from app.core.ratelimit import limiter
from app.dependencies.auth import get_current_user, get_staff_user
from app.schemas.avaliacao import (
    AvaliacaoCreate,
    AvaliacaoModeracaoUpdate,
    AvaliacaoPendenteResponse,
    AvaliacaoResponse,
    AvaliacoesListResponse,
)
from app.services.avaliacao_service import criar_avaliacao, listar_avaliacoes, listar_pendentes, moderar

router = APIRouter(tags=["avaliacoes"])


@router.get("/avaliacoes", response_model=AvaliacoesListResponse)
def get_avaliacoes(produto_id: str):
    return listar_avaliacoes(produto_id)


@router.post("/avaliacoes", response_model=AvaliacaoResponse, status_code=201)
@limiter.limit("5/hour")
def post_avaliacao(request: Request, body: AvaliacaoCreate, user=Depends(get_current_user)):
    return criar_avaliacao(body, user)


@router.get("/admin/avaliacoes", response_model=list[AvaliacaoPendenteResponse])
def get_pendentes(_user=Depends(get_staff_user)):
    return listar_pendentes()


@router.patch("/admin/avaliacoes/{avaliacao_id}", response_model=AvaliacaoResponse)
def patch_avaliacao(avaliacao_id: str, body: AvaliacaoModeracaoUpdate, _user=Depends(get_staff_user)):
    return moderar(avaliacao_id, body.aprovado)
