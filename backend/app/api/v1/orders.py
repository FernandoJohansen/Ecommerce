from fastapi import APIRouter, Depends, Request, Response

from app.core.payment_token import gerar_token_pagamento
from app.core.ratelimit import limiter
from app.dependencies.auth import get_current_user, get_optional_user, get_staff_user
from app.schemas.order import PedidoCreate, PedidoResponse, PedidoUpdate
from app.services.audit_service import registrar_auditoria
from app.services.order_service import (
    create_pedido,
    get_pedido_do_usuario,
    get_pedido_rastreio,
    list_pedidos,
    list_pedidos_do_usuario,
    remove_pedido,
    update_pedido_status,
)

router = APIRouter()


# Endpoint público (compra de convidado) que reserva estoque — limite por IP
# contra criação de pedidos em massa
@router.post("/pedidos", response_model=PedidoResponse, status_code=201)
@limiter.limit("5/minute;30/hour")
def post_pedido(request: Request, pedido: PedidoCreate, user=Depends(get_optional_user)):
    criado = create_pedido(pedido, user_id=user.id if user else None)
    # Credencial dos endpoints de pagamento — convidado não tem outra forma
    # de provar que o pedido é dele (o UUID sozinho não dá acesso)
    return {**criado, "token_pagamento": gerar_token_pagamento(criado["id"])}


@router.get("/pedidos")
def get_pedidos(_user=Depends(get_staff_user)):
    return list_pedidos()


@router.get("/pedidos/rastreio/{pedido_id}", response_model=PedidoResponse)
def get_pedido_rastreio_endpoint(
    pedido_id: str, request: Request, response: Response, user=Depends(get_optional_user)
):
    """Rastreio público: acessível pelo dono logado, staff ou titular do
    token de pagamento devolvido na criação do pedido (convidado)."""
    response.headers["Cache-Control"] = "no-store"
    token = request.headers.get("x-payment-token")
    return get_pedido_rastreio(pedido_id, user, token)


@router.get("/pedidos/meus", response_model=list[PedidoResponse])
def get_meus_pedidos(response: Response, user=Depends(get_current_user)):
    """Pedidos do cliente logado (pedidos de convidado não têm user_id)."""
    response.headers["Cache-Control"] = "no-store"
    return list_pedidos_do_usuario(user.id)


@router.get("/pedidos/meus/{pedido_id}", response_model=PedidoResponse)
def get_meu_pedido(pedido_id: str, response: Response, user=Depends(get_current_user)):
    """Um pedido do cliente logado (página de acompanhamento /rastreio)."""
    response.headers["Cache-Control"] = "no-store"
    return get_pedido_do_usuario(pedido_id, user.id)


@router.patch("/pedidos/{pedido_id}")
def patch_pedido(pedido_id: str, pedido: PedidoUpdate, user=Depends(get_staff_user)):
    result = update_pedido_status(pedido_id, pedido)
    registrar_auditoria(
        user, "pedido.atualizar", "pedido", pedido_id, pedido.model_dump(exclude_unset=True)
    )
    return result


@router.delete("/pedidos/{pedido_id}")
def del_pedido(pedido_id: str, user=Depends(get_staff_user)):
    result = remove_pedido(pedido_id)
    registrar_auditoria(
        user,
        "pedido.excluir",
        "pedido",
        pedido_id,
        {
            "nome_cliente": result.get("nome_cliente"),
            "total_centavos": result.get("total_centavos"),
            "status": result.get("status"),
        },
    )
    return result
