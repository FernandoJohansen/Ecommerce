from typing import Literal

from pydantic import BaseModel

Role = Literal["customer", "staff", "admin"]


class UserRoleUpdate(BaseModel):
    role: Role


class UserWithRole(BaseModel):
    id: str
    email: str
    name: str | None = None
    role: str
    created_at: str | None = None
