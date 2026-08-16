from pydantic import BaseModel, Field


class AvaliacaoCreate(BaseModel):
    pedido_id: str
    produto_nome: str = Field(min_length=1, max_length=120)
    nota: int = Field(ge=1, le=5)
    comentario: str | None = Field(default=None, max_length=1000)


class AvaliacaoResponse(BaseModel):
    id: str
    nota: int
    comentario: str | None
    nome_avaliador: str
    created_at: str


class AvaliacoesListResponse(BaseModel):
    media: float
    total: int
    avaliacoes: list[AvaliacaoResponse]


class AvaliacaoModeracaoUpdate(BaseModel):
    aprovado: bool


class AvaliacaoPendenteResponse(BaseModel):
    id: str
    produto_nome: str
    nota: int
    comentario: str | None
    nome_avaliador: str
    aprovado: bool
    created_at: str
