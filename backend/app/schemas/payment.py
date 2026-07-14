from pydantic import BaseModel


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
