from pydantic import BaseModel


class Tag(BaseModel):
    nome: str
    total_produtos: int = 0
