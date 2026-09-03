"""Mascaramento e anonimização de dados pessoais (LGPD).

O CPF/CNPJ completo fica só no banco e nas chamadas ao PSP (Mercado Pago
exige o documento real); nenhuma resposta da API devolve o documento em
claro — nem para staff/admin, nem para o próprio cliente. O formato segue
o padrão do gov.br: primeiros dígitos e verificadores ocultos.
"""

import re

# Campos de pedidos que contêm dados pessoais — zeramos todos na anonimização
# LGPD (Art. 18). A lista é a única fonte de verdade: tanto a varredura
# periódica (main.py) quanto a exclusão por pedido do usuário (auth.py) usam
# este dict para não divergirem.
CAMPOS_ANONIMIZAR_PEDIDOS: dict = {
    "nome_cliente": "ANONIMIZADO",
    "email_cliente": None,
    "telefone": None,
    "cpf_cnpj": None,
    "estado": None,
    "rua": None,
    "numero": None,
    "complemento": None,
    "bairro": None,
    "cidade": None,
    "cep": None,
    "observacoes": None,
}


def mascarar_documento(valor: str | None) -> str | None:
    if not valor:
        return None
    digitos = re.sub(r"\D", "", valor)
    if len(digitos) == 11:  # CPF → ***.456.789-**
        return f"***.{digitos[3:6]}.{digitos[6:9]}-**"
    if len(digitos) == 14:  # CNPJ → **.345.678/0001-**
        return f"**.{digitos[2:5]}.{digitos[5:8]}/{digitos[8:12]}-**"
    # Valor fora do padrão (dado legado): não vaza nada
    return "***"
