"""Checagem de senha vazada via Have I Been Pwned (k-anonymity).

Só os 5 primeiros caracteres hex do SHA-1 da senha saem do servidor; a API
devolve todos os sufixos daquela faixa e a comparação acontece aqui. Com
Add-Padding, a resposta inclui entradas falsas de contagem 0, então nem o
tamanho da resposta revela algo a um observador da rede.

Fail-open: se o serviço estiver fora do ar, o cadastro segue só com a
política de tamanho — indisponibilidade do HIBP não pode travar a loja.
"""

import hashlib
import logging

import httpx

logger = logging.getLogger(__name__)

_HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/"
_TIMEOUT_SEGUNDOS = 3.0


def senha_vazada(senha: str) -> bool:
    sha1 = hashlib.sha1(senha.encode()).hexdigest().upper()
    prefixo, sufixo = sha1[:5], sha1[5:]
    try:
        resposta = httpx.get(
            f"{_HIBP_RANGE_URL}{prefixo}",
            headers={"Add-Padding": "true"},
            timeout=_TIMEOUT_SEGUNDOS,
        )
        resposta.raise_for_status()
    except httpx.HTTPError as e:
        logger.warning("Checagem HIBP indisponível (%s); seguindo sem ela.", e)
        return False
    for linha in resposta.text.splitlines():
        candidato, _, contagem = linha.partition(":")
        # Entradas de padding vêm com contagem 0 e não são vazamentos reais
        if candidato == sufixo:
            return int(contagem.strip() or "0") > 0
    return False
