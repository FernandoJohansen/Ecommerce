from fastapi import HTTPException

from app.core.config import MELHOR_ENVIO_ENABLED
from app.repositories.order_repository import (
    delete_pedido,
    get_all_pedidos,
    get_pedidos_by_user,
    insert_pedido,
    insert_pedido_itens,
    update_pedido,
)
from app.schemas.order import PedidoCreate, PedidoUpdate
from app.services.frete_service import frete_do_pedido
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
        cpf_cnpj=pedido.cpf_cnpj,
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

    # Reserve stock for the whole order before writing anything; if one
    # product falls short, put back what was already taken and abort.
    por_produto = quantidades_por_produto(itens)

    baixados: list[tuple[str, int]] = []

    def _desfazer_estoque() -> None:
        for produto_nome, quantidade in baixados:
            repor_estoque(produto_nome, quantidade)

    try:
        for produto_nome, quantidade in por_produto.items():
            baixar_estoque(produto_nome, quantidade)
            baixados.append((produto_nome, quantidade))
    except HTTPException:
        _desfazer_estoque()
        raise

    try:
        pedido = insert_pedido(
            {
                "user_id": user_id,
                "nome_cliente": nome_cliente,
                "telefone": telefone,
                "cpf_cnpj": cpf_cnpj,
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

    return {**pedido, "itens": itens_salvos}


def list_pedidos() -> list[dict]:
    return get_all_pedidos()


def list_pedidos_do_usuario(user_id: str) -> list[dict]:
    return get_pedidos_by_user(user_id)


def update_pedido_status(pedido_id: str, pedido: PedidoUpdate) -> dict:
    data = pedido.model_dump(exclude_unset=True)
    if "codigo_rastreio" in data:
        # "" limpa o código; espaços acidentais não viram código válido
        data["codigo_rastreio"] = (data["codigo_rastreio"] or "").strip() or None
    result = update_pedido(pedido_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return result


def remove_pedido(pedido_id: str) -> dict:
    result = delete_pedido(pedido_id)
    if not result:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return result
