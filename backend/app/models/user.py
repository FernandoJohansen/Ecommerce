from pydantic import BaseModel


class SupabaseUser(BaseModel):
    id: str
    email: str | None = None
