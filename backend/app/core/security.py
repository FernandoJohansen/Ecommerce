from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase_auth.errors import AuthError

from app.core.database import supabase

bearer_scheme = HTTPBearer()
bearer_scheme_optional = HTTPBearer(auto_error=False)


@dataclass
class AuthUser:
    id: str
    email: str | None


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    # get_claims verifies locally against JWKS (cached 600s) when the project
    # uses asymmetric JWT keys; falls back to get_user() on HS256 — no behaviour
    # change today, but eliminates the GoTrue round-trip once asymmetric keys
    # are enabled in the Supabase dashboard.
    try:
        response = supabase.auth.get_claims(credentials.credentials)
    except AuthError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")
    if not response:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")
    claims = response["claims"]
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")
    return AuthUser(id=user_id, email=claims.get("email"))


def verify_token_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme_optional),
):
    """Resolve o usuário quando houver token; sem token, None (convidado).

    Um token presente mas inválido/expirado é erro (401), não convidado:
    devolver None aqui criaria o pedido sem user_id para um cliente logado,
    sem nunca disparar a re-autenticação no frontend."""
    if credentials is None:
        return None
    return verify_token(credentials)
