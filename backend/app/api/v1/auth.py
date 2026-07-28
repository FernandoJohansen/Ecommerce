import logging
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from supabase_auth.errors import AuthApiError

from app.core.config import FRONTEND_URL, SUPABASE_KEY, SUPABASE_URL
from app.core.database import supabase, supabase_auth
from app.core.imagem import ler_upload_limitado, tipo_imagem_real
from app.core.ratelimit import limiter
from app.core.roles import ROLE_ADMIN
from app.core.security import bearer_scheme
from app.core.senha import senha_vazada
from app.dependencies.auth import get_current_user, resolve_role
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ProfileResponse,
    ProfileUpdateRequest,
    RecuperarSenhaRequest,
    RedefinirSenhaRequest,
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
    if senha_vazada(body.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta senha apareceu em vazamentos de dados na internet. Escolha outra senha.",
        )
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
    # Supabase devolve um usuário sem identities (e sem erro) quando o e-mail
    # já está cadastrado e confirmado. A resposta aqui é IGUAL à de um cadastro
    # novo pendente de confirmação — um 409 distinto permitiria enumerar quais
    # e-mails têm conta. O dono do e-mail simplesmente não recebe novo link.
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


@router.post("/recuperar-senha", status_code=204)
@limiter.limit("3/minute;10/hour")
def recuperar_senha(request: Request, body: RecuperarSenhaRequest):
    # Always 204 regardless of whether the e-mail exists — prevents enumeration.
    try:
        httpx.post(
            f"{SUPABASE_URL}/auth/v1/recover",
            headers={"apikey": SUPABASE_KEY, "Content-Type": "application/json"},
            params={"redirect_to": f"{FRONTEND_URL}/redefinir-senha"},
            json={"email": body.email},
            timeout=10,
        )
    except Exception as e:
        logger.warning("Password recovery request failed: %s", e)


@router.delete("/meus-dados", status_code=204)
def deletar_meus_dados(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    user=Depends(get_current_user),
):
    """LGPD Art. 18 — right to erasure. Anonymizes personal fields in past
    orders (fiscal records retained, personal data replaced) then deletes the
    auth account. Returns 204 regardless of whether any orders exist."""
    _anonimizar_pedidos_usuario(user.id)
    _deletar_conta_supabase(user.id, credentials.credentials)


def _anonimizar_pedidos_usuario(user_id: str) -> None:
    from app.core.database import supabase as _db
    _db.table("pedidos").update(
        {
            "nome_cliente": "ANONIMIZADO",
            "telefone": None,
            "cpf_cnpj": None,
            "rua": None,
            "numero": None,
            "complemento": None,
            "bairro": None,
            "cidade": None,
            "cep": None,
            "observacoes": None,
            "anonymized_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("user_id", user_id).is_("anonymized_at", "null").execute()


def _deletar_conta_supabase(user_id: str, _jwt: str) -> None:
    response = httpx.delete(
        f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        timeout=10,
    )
    if response.status_code not in (200, 204):
        logger.warning("Account deletion failed for %s: %s %s", user_id, response.status_code, response.text)


@router.post("/redefinir-senha", status_code=204)
def redefinir_senha(body: RedefinirSenhaRequest):
    if senha_vazada(body.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta senha apareceu em vazamentos de dados na internet. Escolha outra senha.",
        )
    response = httpx.put(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {body.access_token}"},
        json={"password": body.password},
        timeout=10,
    )
    if response.status_code != 200:
        logger.warning("Password reset failed: %s %s", response.status_code, response.text)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link de redefinição inválido ou expirado.",
        )
