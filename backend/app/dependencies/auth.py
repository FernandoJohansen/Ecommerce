from fastapi import Depends, HTTPException, status

from app.core.config import ADMIN_EMAILS
from app.core.roles import ROLE_ADMIN, ROLE_CUSTOMER, ROLE_STAFF, role_at_least
from app.core.security import verify_token
from app.repositories.user_role_repository import get_user_role

get_current_user = verify_token


def resolve_role(user_id: str, email: str | None) -> str:
    role = get_user_role(user_id)
    if role:
        return role
    # Bootstrap: ADMIN_EMAILS grants admin even without a user_roles row, so
    # the first admin can log in and assign roles to everyone else.
    if (email or "").lower() in ADMIN_EMAILS:
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
