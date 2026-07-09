from pydantic import BaseModel


class PedidoCreate(BaseModel):
    produto_nome: str
    tamanho: str
    aroma: str
    refil: bool = False
    quantidade: int = 1
    nome_cliente: str | None = None
    observacoes: str | None = None


class PedidoUpdate(BaseModel):
    status: str


class PedidoResponse(BaseModel):
    id: str
    produto_nome: str
    tamanho: str
    aroma: str
    refil: bool
    quantidade: int
    nome_cliente: str | None = None
    observacoes: str | None = None
    status: str
