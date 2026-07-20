import logging
import time

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from supabase_auth.errors import AuthApiError

from app.core.config import SUPABASE_KEY, SUPABASE_URL
from app.core.database import supabase, supabase_auth
from app.core.imagem import ler_upload_limitado, tipo_imagem_real
from app.core.ratelimit import limiter
from app.core.roles import ROLE_ADMIN
from app.core.security import bearer_scheme
from app.dependencies.auth import get_current_user, resolve_role
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ProfileResponse,
    ProfileUpdateRequest,
    SignupRequest,
    SignupResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

AVATAR_BUCKET = "avatars"
AVATAR_MAX_BYTES = 2 * 1024 * 1024
AVATAR_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _update_user_metadata(jwt: str, data: dict) -> dict:
    # GoTrue only updates metadata on behalf of the user's own JWT, so we call
    # the REST endpoint directly instead of using the shared supabase client.
    response = httpx.put(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {jwt}"},
        json={"data": data},
    )
    if response.status_code != 200:
        logger.warning("Profile update failed: %s %s", response.status_code, response.text)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado"
        )
    return response.json()


def _profile_from_gotrue(data: dict) -> ProfileResponse:
    metadata = data.get("user_metadata") or {}
    return ProfileResponse(
        id=data["id"],
        email=data.get("email") or "",
        role=resolve_role(data["id"], data.get("email")),
        name=metadata.get("name"),
        phone=metadata.get("phone"),
        avatar_url=metadata.get("avatar_url"),
    )


# O login passa pelo backend, então o GoTrue vê um único IP para todos os
# clientes — o limite por IP real precisa ser aplicado aqui.
@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute;30/hour")
def login(request: Request, body: LoginRequest):
    try:
        response = supabase_auth.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except AuthApiError as e:
        logger.warning("Login failed: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")
    if not response.session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")
    role = resolve_role(response.user.id, response.user.email)
    return LoginResponse(
        access_token=response.session.access_token,
        expires_in=response.session.expires_in,
        user_email=response.user.email or "",
        role=role,
        is_admin=role == ROLE_ADMIN,
    )


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute;20/hour")
def signup(request: Request, body: SignupRequest):
    try:
        response = supabase_auth.auth.sign_up(
            {
                "email": body.email,
                "password": body.password,
                "options": {"data": {"name": body.name, "phone": body.phone}},
            }
        )
    except AuthApiError as e:
        logger.warning("Signup failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível criar a conta. Verifique os dados informados.",
        )
    if not response.user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível criar a conta. Verifique os dados informados.",
        )
    # Supabase returns a user with no identities (and no error) when the
    # e-mail is already registered and confirmed.
    if not response.session and not response.user.identities:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Este e-mail já está cadastrado."
        )
    if response.session:
        return SignupResponse(
            access_token=response.session.access_token,
            expires_in=response.session.expires_in,
            user_email=response.user.email or body.email,
            needs_confirmation=False,
        )
    return SignupResponse(user_email=body.email, needs_confirmation=True)


@router.post("/logout", status_code=204)
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    # Revoke the caller's own session; the client-level sign_out would revoke
    # whichever session happened to be stored on the shared client.
    httpx.post(
        f"{SUPABASE_URL}/auth/v1/logout",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {credentials.credentials}"},
    )


@router.get("/me", response_model=ProfileResponse)
def get_profile(user=Depends(get_current_user)):
    metadata = user.user_metadata or {}
    return ProfileResponse(
        id=user.id,
        email=user.email or "",
        role=resolve_role(user.id, user.email),
        name=metadata.get("name"),
        phone=metadata.get("phone"),
        avatar_url=metadata.get("avatar_url"),
    )


@router.patch("/me", response_model=ProfileResponse)
def update_profile(
    body: ProfileUpdateRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    data = _update_user_metadata(credentials.credentials, {"name": body.name})
    return _profile_from_gotrue(data)


@router.post("/me/avatar", response_model=ProfileResponse)
@limiter.limit("10/minute;60/hour")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    user=Depends(get_current_user),
):
    # Lê com corte no limite antes de carregar o corpo todo na memória.
    content = await ler_upload_limitado(file, AVATAR_MAX_BYTES)
    # Valida pelos magic bytes, não pelo Content-Type do cliente; o tipo
    # detectado é o que vai para o storage.
    tipo_real = tipo_imagem_real(content)
    ext = AVATAR_TYPES.get(tipo_real or "")
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Envie uma imagem JPG, PNG ou WebP.",
        )

    path = f"{user.id}.{ext}"
    try:
        supabase.storage.from_(AVATAR_BUCKET).upload(
            path, content, {"content-type": tipo_real, "upsert": "true"}
        )
    except Exception:
        logger.exception("Avatar upload failed for user %s", user.id)
        raise HTTPException(status_code=500, detail="Não foi possível enviar a imagem.")

    public_url = supabase.storage.from_(AVATAR_BUCKET).get_public_url(path).rstrip("?")
    # Cache-buster so the browser picks up the new image at the same path
    avatar_url = f"{public_url}?v={int(time.time())}"

    data = _update_user_metadata(credentials.credentials, {"avatar_url": avatar_url})
    return _profile_from_gotrue(data)
