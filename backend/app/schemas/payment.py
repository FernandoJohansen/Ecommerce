import re

from pydantic import BaseModel, Field, field_validator

# Validação simples de e-mail (evita a dependência email-validator do EmailStr)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _valida_email(v: str) -> str:
    email = v.strip().lower()
    if not EMAIL_RE.match(email):
        raise ValueError("E-mail inválido")
    return email


class PixResponse(BaseModel):
    chave: str
    beneficiario: str
    instrucoes: str


class CobrancaPixCreate(BaseModel):
    pedido_id: str


class CobrancaPixResponse(BaseModel):
    txid: str
    pedido_id: str
    status: str
    valor_centavos: int
    brcode: str | None
    # QR Code do brcode como data URI SVG, pronto para <img src=...>
    qrcode: str | None


class MetodosResponse(BaseModel):
    pix: bool
    cartao: bool
    boleto: bool
    max_parcelas: int


class ResumoPedidoPagamento(BaseModel):
    pedido_id: str
    total_centavos: int
    status: str
    # True quando o pedido tem CPF/CNPJ (obrigatório para boleto e cartão)
    tem_documento: bool


class PagamentoCartaoCreate(BaseModel):
    pedido_id: str
    # Token do cartão gerado pelo Card Payment Brick — nunca o número do cartão
    token: str = Field(min_length=1)
    payment_method_id: str = Field(min_length=1)  # ex.: "master", "visa"
    issuer_id: str | None = None
    installments: int = Field(default=1, ge=1)
    payer_email: str

    @field_validator("payer_email")
    @classmethod
    def valida_email(cls, v: str) -> str:
        return _valida_email(v)


class PagamentoBoletoCreate(BaseModel):
    pedido_id: str
    email: str

    @field_validator("email")
    @classmethod
    def valida_email(cls, v: str) -> str:
        return _valida_email(v)


class PagamentoMpResponse(BaseModel):
    id: str  # mp_payment_id
    pedido_id: str
    metodo: str
    # status nativo do MP; situacao é a normalização usada pelo frontend
    # (pendente | aprovado | recusado | cancelado | estornado)
    status: str
    situacao: str
    valor_centavos: int
    status_detail: str | None = None
    mensagem_recusa: str | None = None
    parcelas: int | None = None
    boleto_url: str | None = None
    boleto_linha_digitavel: str | None = None
    boleto_vencimento: str | None = None
