from fastapi import HTTPException

from app.core.config import MELHOR_ENVIO_ENABLED
from app.core.lgpd import mascarar_documento
from app.core.payment_token import token_pagamento_valido
from app.core.roles import ROLE_STAFF, role_at_least
from app.dependencies.auth import resolve_role
from app.repositories.order_repository import (
    delete_pedido,
    get_all_pedidos,
    get_pedido_by_id,
    get_pedido_by_user,
    get_pedidos_by_user,
    insert_pedido,
    insert_pedido_itens,
    update_pedido,
    update_pedido_se_status,
)
from app.schemas.order import TRANSICOES_PERMITIDAS, PedidoCreate, PedidoUpdate
from app.services.frete_service import frete_do_pedido
from app.services.product_service import (
    REFIL_PRODUTO,
    list_aromas,
    mapa_produtos,
    preco_unitario,
    repor_estoque_pedido,
    reservar_estoque_pedido,
)


def _com_documento_mascarado(pedido: dict) -> dict:
    """Toda saída de pedido pela API passa por aqui (LGPD): o cpf_cnpj em
    claro fica restrito ao banco e às chamadas ao PSP."""
    if "cpf_cnpj" in pedido:
        return {**pedido, "cpf_cnpj": mascarar_documento(pedido["cpf_cnpj"])}
    return pedido


def create_pedido(pedido: PedidoCreate, user_id: str | None = None) -> dict:
    return criar_pedido(
        itens=[item.model_dump() for item in pedido.itens],
        nome_cliente=pedido.nome_cliente,
        telefone=pedido.telefone,
        cpf_cnpj=pedido.cpf_cnpj,
        email_cliente=pedido.email_cliente,
        endereco=pedido.endereco.model_dump(),
        observacoes=pedido.observacoes,
        user_id=user_id,
        frete_servico_id=pedido.frete.servico_id if pedido.frete else None,
    )


def quantidades_por_produto(itens: list[dict]) -> dict[str, int]:
    """Estoque consumido pelos itens, por produto. Um item "com refil" também
    consome estoque do produto Refil. Usado na reserva (criação do pedido) e
    na devolução (expiração) — os dois lados precisam ser espelhos exatos."""
    por_produto: dict[str, int] = {}
    for item in itens:
        por_produto[item["produto_nome"]] = (
            por_produto.get(item["produto_nome"], 0) + item["quantidade"]
        )
        if item["refil"] and item["produto_nome"] != REFIL_PRODUTO:
            por_produto[REFIL_PRODUTO] = por_produto.get(REFIL_PRODUTO, 0) + item["quantidade"]
    return por_produto


def criar_pedido(
    itens: list[dict],
    nome_cliente: str,
    telefone: str,
    cpf_cnpj: str,
    endereco: dict,
    observacoes: str | None,
    user_id: str | None = None,
    frete_servico_id: int | None = None,
    email_cliente: str | None = None,
) -> dict:
    """Valida itens, calcula preços/total no servidor, reserva estoque e grava
    o pedido (cabeçalho + itens). Usado pelo POST /pedidos e pelo checkout do
    carrinho."""
    produtos = mapa_produtos()
    aromas = {a["nome"] for a in list_aromas()}

    total = 0
    itens_calculados = []
    for item in itens:
        if item["aroma"] not in aromas:
            raise HTTPException(status_code=422, detail=f"Aroma indisponível: {item['aroma']}")
        preco = preco_unitario(produtos, item["produto_nome"], item["tamanho"], item["refil"])
        subtotal = preco * item["quantidade"]
        total += subtotal
        itens_calculados.append(
            {
                "produto_nome": item["produto_nome"],
                "tamanho": item["tamanho"],
                "aroma": item["aroma"],
                "refil": item["refil"],
                "quantidade": item["quantidade"],
                "preco_unitario_centavos": preco,
                "subtotal_centavos": subtotal,
            }
        )

    # Frete: recotado no servidor (falha aqui aborta antes de mexer no
    # estoque). Com a integração desligada, o pedido segue sem frete e a
    # entrega é combinada pelo WhatsApp, como antes do Sprint 7.
    frete_centavos = 0
    frete_servico = None
    frete_prazo_dias = None
    if MELHOR_ENVIO_ENABLED:
        if frete_servico_id is None:
            raise HTTPException(status_code=422, detail="Escolha uma opção de frete")
        opcao = frete_do_pedido(endereco["cep"], itens, frete_servico_id)
        frete_centavos = opcao["valor_centavos"]
        frete_servico = f"{opcao['nome']} — {opcao['transportadora']}"
        frete_prazo_dias = opcao["prazo_dias"]
    total += frete_centavos

    # Atomically reserve stock for all items in a single DB transaction;
    # if any product is short the function raises and no stock is touched.
    por_produto = quantidades_por_produto(itens)
    reservar_estoque_pedido(por_produto)

    def _desfazer_estoque() -> None:
        repor_estoque_pedido(por_produto)

    try:
        pedido = insert_pedido(
            {
                "user_id": user_id,
                "nome_cliente": nome_cliente,
                "telefone": telefone,
                "cpf_cnpj": cpf_cnpj,
                "email_cliente": email_cliente,
                **endereco,
                "observacoes": observacoes,
                "total_centavos": total,
                "frete_centavos": frete_centavos,
                "frete_servico": frete_servico,
                "frete_prazo_dias": frete_prazo_dias,
            }
        )
    except Exception:
        _desfazer_estoque()
        raise
    if not pedido:
        _desfazer_estoque()
        raise HTTPException(status_code=500, detail="Falha ao salvar pedido")

    try:
        itens_salvos = insert_pedido_itens(
            [{**item, "pedido_id": pedido["id"]} for item in itens_calculados]
        )
        if len(itens_salvos) != len(itens_calculados):
            raise HTTPException(status_code=500, detail="Falha ao salvar itens do pedido")
    except Exception:
        delete_pedido(pedido["id"])
        _desfazer_estoque()
        raise

    resultado = _com_documento_mascarado({**pedido, "itens": itens_salvos})
    from app.services import email_service  # import local evita ciclo
    email_service.enviar_pedido_criado(resultado)
    return resultado


def list_pedidos() -> list[dict]:
    return [_com_documento_mascarado(p) for p in get_all_pedidos()]


def list_pedidos_do_usuario(user_id: str) -> list[dict]:
    return [_com_documento_mascarado(p) for p in get_pedidos_by_user(user_id)]


def get_pedido_do_usuario(pedido_id: str, user_id: str) -> dict:
    """Um pedido do próprio cliente (página de acompanhamento). O filtro por
    user_id garante que pedido de outra pessoa responde 404, não 403 — não
    vaza a existência do pedido."""
    pedido = get_pedido_by_user(pedido_id, user_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return _com_documento_mascarado(pedido)


def update_pedido_status(pedido_id: str, pedido: PedidoUpdate) -> dict:
    data = pedido.model_dump(exclude_unset=True)
    if "codigo_rastreio" in data:
        data["codigo_rastreio"] = (data["codigo_rastreio"] or "").strip() or None

    _restaurar_estoque: dict[str, int] | None = None
    status_atual: str | None = None
    if "status" in data:
        atual = get_pedido_by_id(pedido_id)
        if not atual:
            raise HTTPException(status_code=404, detail="Pedido não encontrado")
        status_atual = atual.get("status", "novo")
        permitidos = TRANSICOES_PERMITIDAS.get(status_atual, set())
        if data["status"] not in permitidos:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Transição inválida: {status_atual} → {data['status']}. "
                    f"Transições permitidas: {sorted(permitidos) or 'nenhuma'}."
                ),
            )
        if data["status"] in {"cancelado", "expirado"} and status_atual in {"novo", "em_andamento"}:
            _restaurar_estoque = quantidades_por_produto(atual.get("itens") or [])

    if _restaurar_estoque and status_atual:
        # CAS: só restaura estoque se este processo foi quem mudou o status,
        # evitando dupla devolução em requisições concorrentes.
        result = update_pedido_se_status(pedido_id, status_atual, data)
        if not result:
            raise HTTPException(
                status_code=409,
                detail="O pedido foi modificado por outro processo. Recarregue e tente novamente.",
            )
        repor_estoque_pedido(_restaurar_estoque)
    else:
        result = update_pedido(pedido_id, data)
        if not result:
            raise HTTPException(status_code=404, detail="Pedido não encontrado")
    resultado = _com_documento_mascarado(result)
    if data.get("status") == "enviado":
        from app.services import email_service
        email_service.enviar_pedido_enviado(resultado)
    return resultado


# Pedidos que representam venda concretizada: excluir apagaria também os
# registros de pagamento (ON DELETE CASCADE) — histórico financeiro some.
STATUS_PROTEGIDOS_EXCLUSAO = {"pago", "enviado", "concluido"}


_STATUS_COM_ESTOQUE_RESERVADO = {"novo", "em_andamento"}


def remove_pedido(pedido_id: str) -> dict:
    pedido = get_pedido_by_id(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    if pedido["status"] in STATUS_PROTEGIDOS_EXCLUSAO:
        raise HTTPException(
            status_code=409,
            detail="Pedido pago não pode ser excluído (histórico de pagamento); "
            "use o status Cancelado se necessário.",
        )
    # Devolve o estoque reservado antes de apagar, igual ao que acontece no
    # cancelamento — sem isso o estoque deriva para baixo permanentemente.
    if pedido["status"] in _STATUS_COM_ESTOQUE_RESERVADO:
        por_produto = quantidades_por_produto(pedido.get("itens") or [])
        if por_produto:
            repor_estoque_pedido(por_produto)
    result = delete_pedido(pedido_id)
    if not result:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return _com_documento_mascarado(result)


def get_pedido_rastreio(pedido_id: str, user, token_pagamento: str | None) -> dict:
    """Rastreio público: autoriza pelo token de pagamento (convidado), pelo
    Bearer do dono ou por role staff. Responde 404 para qualquer acesso não
    autorizado, igual à de pedido inexistente (não confirma que o UUID existe)."""
    pedido = get_pedido_by_id(pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    autorizado = False
    if token_pagamento and token_pagamento_valido(token_pagamento, pedido_id):
        autorizado = True
    elif user is not None:
        if pedido.get("user_id") == user.id:
            autorizado = True
        elif role_at_least(resolve_role(user.id, user.email), ROLE_STAFF):
            autorizado = True

    if not autorizado:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return _com_documento_mascarado(pedido)
