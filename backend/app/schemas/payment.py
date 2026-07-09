from pydantic import BaseModel


class PixResponse(BaseModel):
    chave: str
    beneficiario: str
    instrucoes: str
