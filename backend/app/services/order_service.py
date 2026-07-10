from fastapi import HTTPException

from app.repositories.order_repository import (
    delete_pedido,
    get_all_pedidos,
    insert_pedido,
    insert_pedido_itens,
    update_pedido,
)
from app.schemas.order import PedidoCreate, PedidoUpdate
from app.services.product_service import (
    REFIL_PRODUTO,
    baixar_estoque,
    list_aromas,
    mapa_produtos,
    preco_unitario,
    repor_estoque,
)


def create_pedido(pedido: PedidoCreate, user_id: str | None = None) -> dict:
    return criar_pedido(
        itens=[item.model_dump() for item in pedido.itens],
        nome_cliente=pedido.nome_cliente,
        telefone=pedido.telefone,
        endereco=pedido.endereco.model_dump(),
        observacoes=pedido.observacoes,
        user_id=user_id,
    )


def criar_pedido(
    itens: list[dict],
    nome_cliente: str,
    telefone: str,
    endereco: dict,
    observacoes: str | None,
    user_id: str | None = None,
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

    # Reserve stock for the whole order before writing anything; if one
    # product falls short, put back what was already taken and abort.
    # Um item "com refil" também consome estoque do produto Refil.
    por_produto: dict[str, int] = {}
    for item in itens:
        por_produto[item["produto_nome"]] = (
            por_produto.get(item["produto_nome"], 0) + item["quantidade"]
        )
        if item["refil"] and item["produto_nome"] != REFIL_PRODUTO:
            por_produto[REFIL_PRODUTO] = por_produto.get(REFIL_PRODUTO, 0) + item["quantidade"]

    baixados: list[tuple[str, int]] = []
    try:
        for produto_nome, quantidade in por_produto.items():
            baixar_estoque(produto_nome, quantidade)
            baixados.append((produto_nome, quantidade))
    except HTTPException:
        for produto_nome, quantidade in baixados:
            repor_estoque(produto_nome, quantidade)
        raise

    def _desfazer_estoque() -> None:
        for produto_nome, quantidade in baixados:
            repor_estoque(produto_nome, quantidade)

    pedido = insert_pedido(
        {
            "user_id": user_id,
            "nome_cliente": nome_cliente,
            "telefone": telefone,
            **endereco,
            "observacoes": observacoes,
            "total_centavos": total,
        }
    )
    if not pedido:
        _desfazer_estoque()
        raise HTTPException(status_code=500, detail="Falha ao salvar pedido")

    itens_salvos = insert_pedido_itens(
        [{**item, "pedido_id": pedido["id"]} for item in itens_calculados]
    )
    if len(itens_salvos) != len(itens_calculados):
        delete_pedido(pedido["id"])
        _desfazer_estoque()
        raise HTTPException(status_code=500, detail="Falha ao salvar itens do pedido")

    return {**pedido, "itens": itens_salvos}


def list_pedidos() -> list[dict]:
    return get_all_pedidos()


def update_pedido_status(pedido_id: str, pedido: PedidoUpdate) -> dict:
    result = update_pedido(pedido_id, pedido.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return result


def remove_pedido(pedido_id: str) -> dict:
    result = delete_pedido(pedido_id)
    if not result:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return result
