"""Token de pagamento para os endpoints públicos de pagamento (anti-IDOR).

Pedido de convidado não tem user_id, então login não basta para proteger a
tela de pagamento. Na criação do pedido a API devolve um token HMAC vinculado
ao pedido_id e com validade curta; apresentá-lo (header X-Payment-Token) prova
que o cliente recebeu a resposta da criação — saber só o UUID do pedido
(que vaza por Referer/logs/histórico) deixa de dar acesso.

Stateless: nada é gravado no banco; o segredo nunca sai do servidor.
"""

import hashlib
import hmac
import time

from app.core.config import PAYMENT_TOKEN_SECRET, PAYMENT_TOKEN_TTL_SEGUNDOS


def _assinatura(pedido_id: str, expira_em: int) -> str:
    mensagem = f"{pedido_id}:{expira_em}".encode()
    return hmac.new(PAYMENT_TOKEN_SECRET.encode(), mensagem, hashlib.sha256).hexdigest()


def gerar_token_pagamento(pedido_id: str) -> str:
    expira_em = int(time.time()) + PAYMENT_TOKEN_TTL_SEGUNDOS
    return f"{expira_em}.{_assinatura(pedido_id, expira_em)}"


def token_pagamento_valido(token: str, pedido_id: str) -> bool:
    expira_str, sep, recebida = token.partition(".")
    if not sep or not expira_str.isdigit():
        return False
    expira_em = int(expira_str)
    if time.time() > expira_em:
        return False
    return hmac.compare_digest(_assinatura(pedido_id, expira_em), recebida)
