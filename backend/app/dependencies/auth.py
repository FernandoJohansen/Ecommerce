from fastapi import Depends, HTTPException, status

from app.core.config import ADMIN_EMAILS
from app.core.roles import ROLE_ADMIN, ROLE_CUSTOMER, ROLE_STAFF, role_at_least
from app.core.security import verify_token, verify_token_optional
from app.repositories.user_role_repository import get_user_role, has_any_admin

get_current_user = verify_token
get_optional_user = verify_token_optional


def resolve_role(user_id: str, email: str | None) -> str:
    role = get_user_role(user_id)
    if role:
        return role
    # Bootstrap: ADMIN_EMAILS grants admin even without a user_roles row, so
    # the first admin can log in and assign roles to everyone else. One-shot:
    # assim que existir um admin de verdade em user_roles, a lista do .env
    # deixa de conceder qualquer coisa (registrar o e-mail da lista antes da
    # dona não dá mais admin).
    if (email or "").lower() in ADMIN_EMAILS and not has_any_admin():
        return ROLE_ADMIN
    return ROLE_CUSTOMER


def require_role(minimum: str):
    def dependency(user=Depends(get_current_user)):
        if not role_at_least(resolve_role(user.id, user.email), minimum):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito")
        return user

    return dependency


get_staff_user = require_role(ROLE_STAFF)
get_admin_user = require_role(ROLE_ADMIN)
