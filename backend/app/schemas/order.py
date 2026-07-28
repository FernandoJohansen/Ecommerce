import re

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.frete import FreteEscolhido

UFS = {
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
}


def _cpf_valido(digitos: str) -> bool:
    if digitos == digitos[0] * 11:
        return False
    # Dígitos verificadores (módulo 11)
    for tamanho in (9, 10):
        soma = sum(int(d) * peso for d, peso in zip(digitos, range(tamanho + 1, 1, -1)))
        dv = (soma * 10) % 11 % 10
        if dv != int(digitos[tamanho]):
            return False
    return True


def _cnpj_valido(digitos: str) -> bool:
    if digitos == digitos[0] * 14:
        return False
    for pesos in (
        [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
        [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    ):
        soma = sum(int(d) * peso for d, peso in zip(digitos, pesos))
        dv = 11 - soma % 11
        if dv >= 10:
            dv = 0
        if dv != int(digitos[len(pesos)]):
            return False
    return True


class EnderecoEntrega(BaseModel):
    cep: str
    rua: str = Field(min_length=2, max_length=200)
    numero: str = Field(min_length=1, max_length=20)
    complemento: str | None = Field(default=None, max_length=100)
    bairro: str = Field(min_length=2, max_length=100)
    cidade: str = Field(min_length=2, max_length=100)
    estado: str

    @field_validator("cep")
    @classmethod
    def valida_cep(cls, v: str) -> str:
        digitos = re.sub(r"\D", "", v)
        if len(digitos) != 8:
            raise ValueError("CEP deve ter 8 dígitos")
        return f"{digitos[:5]}-{digitos[5:]}"

    @field_validator("estado")
    @classmethod
    def valida_uf(cls, v: str) -> str:
        uf = v.strip().upper()
        if uf not in UFS:
            raise ValueError("UF inválida")
        return uf


class PedidoItemCreate(BaseModel):
    produto_nome: str = Field(min_length=1, max_length=120)
    tamanho: str = Field(min_length=1, max_length=60)
    aroma: str = Field(min_length=1, max_length=60)
    refil: bool = False
    quantidade: int = Field(default=1, ge=1, le=99)


class DadosCliente(BaseModel):
    """Dados de cliente/entrega comuns ao pedido direto e ao checkout do carrinho."""

    nome_cliente: str = Field(min_length=2, max_length=120)
    telefone: str = Field(max_length=30)
    # Exigido pelo Mercado Pago para boleto e antifraude de cartão.
    # CPF (11 dígitos) ou CNPJ (14 dígitos, compra como pessoa jurídica).
    cpf_cnpj: str = Field(max_length=25)
    # Opcional: usado para envio de e-mails transacionais (Brevo). Ausente em
    # pedidos antigos e em convidados que não informaram e-mail.
    email_cliente: str | None = Field(default=None, max_length=254)
    endereco: EnderecoEntrega
    observacoes: str | None = Field(default=None, max_length=500)
    # Opção de frete escolhida no checkout; recotada no servidor. None quando
    # a integração de frete está desligada (entrega combinada pelo WhatsApp).
    frete: FreteEscolhido | None = None

    @field_validator("nome_cliente")
    @classmethod
    def valida_nome(cls, v: str) -> str:
        nome = v.strip()
        if len(nome) < 2:
            raise ValueError("Informe o nome completo")
        return nome

    @field_validator("telefone")
    @classmethod
    def valida_telefone(cls, v: str) -> str:
        digitos = re.sub(r"\D", "", v)
        if not 10 <= len(digitos) <= 11:
            raise ValueError("Telefone deve ter DDD + número (10 ou 11 dígitos)")
        return digitos

    @field_validator("cpf_cnpj")
    @classmethod
    def valida_cpf_cnpj(cls, v: str) -> str:
        digitos = re.sub(r"\D", "", v)
        if len(digitos) == 11:
            if not _cpf_valido(digitos):
                raise ValueError("CPF inválido")
        elif len(digitos) == 14:
            if not _cnpj_valido(digitos):
                raise ValueError("CNPJ inválido")
        else:
            raise ValueError("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)")
        return digitos

    @field_validator("email_cliente")
    @classmethod
    def valida_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        local, _, domain = v.partition("@")
        if not local or not domain or "." not in domain:
            raise ValueError("E-mail inválido")
        return v


class PedidoCreate(DadosCliente):
    itens: list[PedidoItemCreate] = Field(min_length=1, max_length=50)


STATUS_PEDIDO = {
    "novo", "em_andamento", "pago", "enviado",
    "concluido", "cancelado", "expirado", "reembolsado",
}

# Allowed manual transitions for staff PATCH. Terminal states (concluido,
# cancelado, expirado, reembolsado) cannot be reversed.
TRANSICOES_PERMITIDAS: dict[str, set[str]] = {
    "novo":         {"em_andamento", "pago", "cancelado", "expirado"},
    "em_andamento": {"pago", "cancelado", "expirado"},
    "pago":         {"enviado", "reembolsado"},
    "enviado":      {"concluido", "reembolsado"},
    "concluido":    set(),
    "cancelado":    set(),
    "expirado":     set(),
    "reembolsado":  set(),
}


class PedidoUpdate(BaseModel):
    """Atualização parcial pelo admin: só os campos enviados são gravados."""

    status: str | None = None
    # "" limpa o código (volta a NULL no banco)
    codigo_rastreio: str | None = Field(default=None, max_length=100)

    @field_validator("status")
    @classmethod
    def valida_status(cls, v: str | None) -> str | None:
        if v is not None and v not in STATUS_PEDIDO:
            raise ValueError(f"Status inválido: {v}")
        return v

    @model_validator(mode="after")
    def exige_algum_campo(self) -> "PedidoUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe ao menos um campo para atualizar")
        return self


class PedidoItemResponse(BaseModel):
    id: str
    produto_nome: str
    tamanho: str
    aroma: str
    refil: bool
    quantidade: int
    preco_unitario_centavos: int
    subtotal_centavos: int


class PedidoResponse(BaseModel):
    id: str
    nome_cliente: str | None = None
    telefone: str | None = None
    cep: str | None = None
    rua: str | None = None
    numero: str | None = None
    complemento: str | None = None
    bairro: str | None = None
    cidade: str | None = None
    estado: str | None = None
    cpf_cnpj: str | None = None
    observacoes: str | None = None
    total_centavos: int = 0
    frete_centavos: int = 0
    frete_servico: str | None = None
    frete_prazo_dias: int | None = None
    codigo_rastreio: str | None = None
    status: str
    created_at: str | None = None
    itens: list[PedidoItemResponse] = []
    # Devolvido só na criação do pedido: credencial de acesso aos endpoints
    # públicos de pagamento (header X-Payment-Token)
    token_pagamento: str | None = None
