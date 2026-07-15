"""Cotação de frete via Melhor Envio + regra de frete grátis.

O peso do pacote é estimado pelo tamanho de cada item (frascos de essência:
o líquido domina o peso); a caixa padrão vem da config. A opção mais barata
sai de graça quando o subtotal dos itens atinge FRETE_GRATIS_MINIMO_CENTAVOS.
"""

import re

from fastapi import HTTPException

from app.core.config import (
    FRETE_CEP_ORIGEM,
    FRETE_GRATIS_MINIMO_CENTAVOS,
    FRETE_PACOTE_ALTURA_CM,
    FRETE_PACOTE_COMPRIMENTO_CM,
    FRETE_PACOTE_LARGURA_CM,
)
from app.services.melhorenvio_client import calcular_frete, exigir_melhor_envio
from app.services.product_service import mapa_produtos, preco_unitario

# Peso estimado por tamanho, em kg (frasco + líquido + embalagem)
_PESO_TAMANHO_KG = {
    "60ml": 0.25,
    "100ml": 0.35,
    "250ml": 0.6,
    "500ml": 1.0,
    "1L": 1.6,
}
_PESO_PADRAO_KG = 0.3  # tamanhos sem volume ("Único", "Kit com 5")


def _peso_item_kg(tamanho: str, refil: bool) -> float:
    peso = _PESO_TAMANHO_KG.get(tamanho, _PESO_PADRAO_KG)
    # Item "com refil" embarca também o frasco de refil do mesmo tamanho
    return peso * 2 if refil else peso


def _so_digitos_cep(cep: str) -> str:
    digitos = re.sub(r"\D", "", cep)
    if len(digitos) != 8:
        raise HTTPException(status_code=422, detail="CEP deve ter 8 dígitos")
    return digitos


def cotar_frete(cep_destino: str, itens: list[dict]) -> dict:
    """Cota o frete para uma lista de itens {produto_nome, tamanho, refil,
    quantidade}. Valida produtos/tamanhos contra o catálogo, calcula peso e
    valor segurado no servidor e aplica a regra de frete grátis."""
    # Integração desligada responde 503 antes de qualquer validação — o
    # checkout usa isso para cair no fluxo sem frete.
    exigir_melhor_envio()
    produtos = mapa_produtos()

    subtotal = 0
    peso_kg = 0.0
    for item in itens:
        preco = preco_unitario(produtos, item["produto_nome"], item["tamanho"], item["refil"])
        subtotal += preco * item["quantidade"]
        peso_kg += _peso_item_kg(item["tamanho"], item["refil"]) * item["quantidade"]

    pacote = {
        "height": FRETE_PACOTE_ALTURA_CM,
        "width": FRETE_PACOTE_LARGURA_CM,
        "length": FRETE_PACOTE_COMPRIMENTO_CM,
        "weight": round(peso_kg, 2),
    }
    servicos = calcular_frete(
        cep_origem=_so_digitos_cep(FRETE_CEP_ORIGEM),
        cep_destino=_so_digitos_cep(cep_destino),
        pacote=pacote,
        valor_segurado_reais=round(subtotal / 100, 2),
    )
    if not servicos:
        raise HTTPException(
            status_code=422, detail="Nenhuma opção de frete disponível para este CEP"
        )

    opcoes = []
    for servico in servicos:
        preco_frete = servico.get("custom_price") or servico.get("price")
        try:
            valor_centavos = round(float(preco_frete) * 100)
        except (TypeError, ValueError):
            continue
        opcoes.append(
            {
                "servico_id": servico["id"],
                "nome": servico.get("name", ""),
                "transportadora": (servico.get("company") or {}).get("name", ""),
                "valor_centavos": valor_centavos,
                "prazo_dias": servico.get("delivery_time"),
                "frete_gratis": False,
            }
        )
    if not opcoes:
        raise HTTPException(
            status_code=422, detail="Nenhuma opção de frete disponível para este CEP"
        )

    opcoes.sort(key=lambda o: o["valor_centavos"])
    if subtotal >= FRETE_GRATIS_MINIMO_CENTAVOS:
        opcoes[0]["valor_centavos"] = 0
        opcoes[0]["frete_gratis"] = True

    return {
        "opcoes": opcoes,
        "frete_gratis_minimo_centavos": FRETE_GRATIS_MINIMO_CENTAVOS,
    }


def frete_do_pedido(cep_destino: str, itens: list[dict], servico_id: int) -> dict:
    """Recotação server-side na criação do pedido: nunca confia no valor de
    frete vindo do cliente. Retorna a opção escolhida ou 422 se ela sumiu."""
    cotacao = cotar_frete(cep_destino, itens)
    for opcao in cotacao["opcoes"]:
        if opcao["servico_id"] == servico_id:
            return opcao
    raise HTTPException(
        status_code=422,
        detail="A opção de frete escolhida não está mais disponível; recalcule o frete.",
    )
