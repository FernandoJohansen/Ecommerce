from pydantic import BaseModel, Field


class CartItemCreate(BaseModel):
    produto_nome: str
    tamanho: str
    aroma: str
    refil: bool = False
    quantidade: int = Field(default=1, ge=1)


class CartItemUpdate(BaseModel):
    quantidade: int = Field(ge=1)


class CartItemResponse(BaseModel):
    id: str
    produto_nome: str
    tamanho: str
    aroma: str
    refil: bool
    quantidade: int
