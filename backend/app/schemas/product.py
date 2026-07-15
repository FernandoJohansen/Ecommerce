from pydantic import BaseModel, Field, field_validator


def _validar_tamanhos(tamanhos: list[str]) -> list[str]:
    limpos = [t.strip() for t in tamanhos]
    if any(not t for t in limpos):
        raise ValueError("Tamanho não pode ser vazio")
    if len(set(limpos)) != len(limpos):
        raise ValueError("Tamanhos duplicados")
    return limpos


def _validar_precos(precos: dict[str, int]) -> dict[str, int]:
    if any(valor <= 0 for valor in precos.values()):
        raise ValueError("Preço deve ser maior que zero (em centavos)")
    return {tamanho.strip(): valor for tamanho, valor in precos.items()}


class ProdutoCreate(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    tamanhos: list[str] = Field(min_length=1)
    descricao: str | None = None
    tag: str | None = None
    ordem: int = 0
    estoque: int = Field(default=0, ge=0)
    precos: dict[str, int] = {}
    ativo: bool = True

    @field_validator("nome")
    @classmethod
    def _nome_strip(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("Nome não pode ser vazio")
        return valor

    _tamanhos = field_validator("tamanhos")(_validar_tamanhos)
    _precos = field_validator("precos")(_validar_precos)


class ProdutoUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    tamanhos: list[str] | None = Field(default=None, min_length=1)
    descricao: str | None = None
    tag: str | None = None
    ordem: int | None = None
    estoque: int | None = Field(default=None, ge=0)
    precos: dict[str, int] | None = None
    ativo: bool | None = None

    @field_validator("nome")
    @classmethod
    def _nome_strip(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        valor = valor.strip()
        if not valor:
            raise ValueError("Nome não pode ser vazio")
        return valor

    @field_validator("tamanhos")
    @classmethod
    def _tamanhos(cls, valor: list[str] | None) -> list[str] | None:
        return None if valor is None else _validar_tamanhos(valor)

    @field_validator("precos")
    @classmethod
    def _precos(cls, valor: dict[str, int] | None) -> dict[str, int] | None:
        return None if valor is None else _validar_precos(valor)


class ProdutoResponse(BaseModel):
    id: str
    nome: str
    tamanhos: list[str]
    descricao: str | None = None
    tag: str | None = None
    estoque: int = 0
    precos: dict[str, int] = {}
    imagens: list[str] = []


class EstoqueUpdate(BaseModel):
    estoque: int = Field(ge=0)


class ImagemRemove(BaseModel):
    url: str = Field(min_length=1)


class ImagensReorder(BaseModel):
    imagens: list[str]


class AromaResponse(BaseModel):
    id: str
    nome: str
