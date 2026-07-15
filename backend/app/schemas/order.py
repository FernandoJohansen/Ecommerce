import re

from pydantic import BaseModel, Field, field_validator

UFS = {
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
}


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
    produto_nome: str = Field(min_length=1)
    tamanho: str = Field(min_length=1)
    aroma: str = Field(min_length=1)
    refil: bool = False
    quantidade: int = Field(default=1, ge=1, le=99)


class DadosCliente(BaseModel):
    """Dados de cliente/entrega comuns ao pedido direto e ao checkout do carrinho."""

    nome_cliente: str = Field(min_length=2, max_length=120)
    telefone: str
    # Exigido pelo Mercado Pago para boleto e antifraude de cartão
    cpf: str
    endereco: EnderecoEntrega
    observacoes: str | None = Field(default=None, max_length=500)

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

    @field_validator("cpf")
    @classmethod
    def valida_cpf(cls, v: str) -> str:
        digitos = re.sub(r"\D", "", v)
        if len(digitos) != 11 or digitos == digitos[0] * 11:
            raise ValueError("CPF inválido")
        # Dígitos verificadores (módulo 11)
        for tamanho in (9, 10):
            soma = sum(int(d) * peso for d, peso in zip(digitos, range(tamanho + 1, 1, -1)))
            dv = (soma * 10) % 11 % 10
            if dv != int(digitos[tamanho]):
                raise ValueError("CPF inválido")
        return digitos


class PedidoCreate(DadosCliente):
    itens: list[PedidoItemCreate] = Field(min_length=1)


class PedidoUpdate(BaseModel):
    status: str


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
    cpf: str | None = None
    observacoes: str | None = None
    total_centavos: int = 0
    status: str
    created_at: str | None = None
    itens: list[PedidoItemResponse] = []
