from pydantic import BaseModel


class Pedido(BaseModel):
    id: str
    user_id: str | None = None
    nome_cliente: str | None = None
    telefone: str | None = None
    cep: str | None = None
    rua: str | None = None
    numero: str | None = None
    complemento: str | None = None
    bairro: str | None = None
    cidade: str | None = None
    estado: str | None = None
    observacoes: str | None = None
    total_centavos: int = 0
    status: str = "novo"


class PedidoItem(BaseModel):
    id: str
    pedido_id: str
    produto_nome: str
    tamanho: str
    aroma: str
    refil: bool = False
    quantidade: int = 1
    preco_unitario_centavos: int = 0
    subtotal_centavos: int = 0
