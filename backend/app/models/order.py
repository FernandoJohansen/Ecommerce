from pydantic import BaseModel


class Pedido(BaseModel):
    id: str
    produto_nome: str
    tamanho: str
    aroma: str
    refil: bool = False
    quantidade: int = 1
    nome_cliente: str | None = None
    observacoes: str | None = None
    status: str = "novo"
