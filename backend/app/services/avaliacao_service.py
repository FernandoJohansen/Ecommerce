from fastapi import HTTPException

from app.repositories.avaliacao_repository import (
    get_avaliacao_by_id,
    get_avaliacao_by_pedido_produto,
    get_avaliacoes_aprovadas,
    get_avaliacoes_pendentes,
    get_nomes_itens_pedido,
    get_produto_id_by_nome,
    insert_avaliacao,
    update_avaliacao,
)
from app.repositories.order_repository import get_pedido_by_id
from app.schemas.avaliacao import AvaliacaoCreate

_STATUS_AVALIAVEIS = {"pago", "enviado", "concluido"}


def listar_avaliacoes(produto_id: str) -> dict:
    rows = get_avaliacoes_aprovadas(produto_id)
    total = len(rows)
    media = round(sum(r["nota"] for r in rows) / total, 1) if total else 0.0
    return {"media": media, "total": total, "avaliacoes": rows}


def criar_avaliacao(data: AvaliacaoCreate, user) -> dict:
    pedido = get_pedido_by_id(data.pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    if pedido.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="Pedido não pertence ao usuário")

    if pedido.get("status") not in _STATUS_AVALIAVEIS:
        raise HTTPException(
            status_code=422,
            detail="Só é possível avaliar pedidos pagos ou entregues",
        )

    if data.produto_nome not in get_nomes_itens_pedido(data.pedido_id):
        raise HTTPException(status_code=422, detail="Produto não encontrado neste pedido")

    if get_avaliacao_by_pedido_produto(data.pedido_id, data.produto_nome):
        raise HTTPException(status_code=409, detail="Você já avaliou este produto neste pedido")

    nome_completo = pedido.get("nome_cliente") or "Cliente"
    nome_avaliador = nome_completo.strip().split()[0]

    return insert_avaliacao({
        "pedido_id": data.pedido_id,
        "produto_id": get_produto_id_by_nome(data.produto_nome),
        "produto_nome": data.produto_nome,
        "nota": data.nota,
        "comentario": data.comentario or None,
        "nome_avaliador": nome_avaliador,
    })


def listar_pendentes() -> list[dict]:
    return get_avaliacoes_pendentes()


def moderar(avaliacao_id: str, aprovado: bool) -> dict:
    if not get_avaliacao_by_id(avaliacao_id):
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")
    return update_avaliacao(avaliacao_id, {"aprovado": aprovado})
