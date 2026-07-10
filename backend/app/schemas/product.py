from pydantic import BaseModel, Field


class ProdutoResponse(BaseModel):
    id: str
    nome: str
    tamanhos: list[str]
    descricao: str | None = None
    tag: str | None = None
    estoque: int = 0
    precos: dict[str, int] = {}


class EstoqueUpdate(BaseModel):
    estoque: int = Field(ge=0)


class AromaResponse(BaseModel):
    id: str
    nome: str
