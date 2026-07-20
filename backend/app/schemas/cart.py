from pydantic import BaseModel, Field

from app.schemas.order import DadosCliente


class CartItemCreate(BaseModel):
    produto_nome: str = Field(min_length=1, max_length=120)
    tamanho: str = Field(min_length=1, max_length=60)
    aroma: str = Field(min_length=1, max_length=60)
    refil: bool = False
    quantidade: int = Field(default=1, ge=1, le=99)


class CartItemUpdate(BaseModel):
    quantidade: int = Field(ge=1, le=99)


class CartItemResponse(BaseModel):
    id: str
    produto_nome: str
    tamanho: str
    aroma: str
    refil: bool
    quantidade: int
    # None quando o produto saiu do catálogo ou ficou sem preço para o tamanho
    preco_unitario_centavos: int | None = None
    subtotal_centavos: int | None = None


class CartCheckoutRequest(DadosCliente):
    pass
