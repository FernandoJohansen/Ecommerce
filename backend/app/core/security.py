from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase_auth.errors import AuthError

from app.core.database import supabase

bearer_scheme = HTTPBearer()
bearer_scheme_optional = HTTPBearer(auto_error=False)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try:
        response = supabase.auth.get_user(credentials.credentials)
    except AuthError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")
    if not response or not response.user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado")
    return response.user


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
