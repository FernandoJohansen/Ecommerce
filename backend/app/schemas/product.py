from pydantic import BaseModel


class ProdutoResponse(BaseModel):
    id: str
    nome: str
    tamanhos: list[str]
    descricao: str | None = None
    tag: str | None = None


class AromaResponse(BaseModel):
    id: str
    nome: str
