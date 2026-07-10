from pydantic import BaseModel


class Produto(BaseModel):
    id: str
    nome: str
    tamanhos: list[str]
    descricao: str | None = None
    tag: str | None = None
    ordem: int = 0
    ativo: bool = True
    estoque: int = 0


class Aroma(BaseModel):
    id: str
    nome: str
    ativo: bool = True
    ordem: int = 0
