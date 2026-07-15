from pydantic import BaseModel, Field


class FreteItem(BaseModel):
    """Item para cotação de frete (aroma não interessa para o peso)."""

    produto_nome: str = Field(min_length=1)
    tamanho: str = Field(min_length=1)
    refil: bool = False
    quantidade: int = Field(default=1, ge=1, le=99)


class CotacaoFreteRequest(BaseModel):
    cep: str = Field(min_length=8, max_length=9)
    itens: list[FreteItem] = Field(min_length=1)


class FreteOpcao(BaseModel):
    servico_id: int
    nome: str
    transportadora: str
    valor_centavos: int
    prazo_dias: int | None = None
    frete_gratis: bool = False


class CotacaoFreteResponse(BaseModel):
    opcoes: list[FreteOpcao]
    frete_gratis_minimo_centavos: int


class FreteEscolhido(BaseModel):
    """Opção de frete escolhida no checkout; o valor é recotado no servidor."""

    servico_id: int
