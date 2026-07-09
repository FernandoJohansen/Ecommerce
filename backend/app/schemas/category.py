from pydantic import BaseModel


class CategoriaResponse(BaseModel):
    nome: str
    total_produtos: int
