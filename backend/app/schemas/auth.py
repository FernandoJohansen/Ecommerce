from typing import Annotated

from pydantic import BaseModel, StringConstraints


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_email: str
    role: str = "customer"
    is_admin: bool = False


class SignupRequest(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    phone: Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=20)]
    email: str
    password: Annotated[str, StringConstraints(min_length=6, max_length=72)]


class SignupResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None
    user_email: str
    needs_confirmation: bool


class ProfileResponse(BaseModel):
    id: str
    email: str
    role: str = "customer"
    name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None


class ProfileUpdateRequest(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
