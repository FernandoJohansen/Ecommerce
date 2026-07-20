from fastapi import Depends, HTTPException, status

from app.core.roles import ROLE_ADMIN, ROLE_CUSTOMER, ROLE_STAFF, role_at_least
from app.core.security import verify_token, verify_token_optional
from app.repositories.user_role_repository import get_user_role

get_current_user = verify_token
get_optional_user = verify_token_optional


def resolve_role(user_id: str, email: str | None) -> str:
    # A única fonte de papel é a tabela user_roles. O primeiro admin é semeado
    # direto no banco (backend/scripts/conceder_admin.py) — não existe caminho
    # que conceda admin por e-mail/env, então registrar um e-mail "esperado"
    # antes da dona não dá privilégio nenhum.
    return get_user_role(user_id) or ROLE_CUSTOMER


def require_role(minimum: str):
    def dependency(user=Depends(get_current_user)):
        if not role_at_least(resolve_role(user.id, user.email), minimum):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito")
        return user

    return dependency


get_staff_user = require_role(ROLE_STAFF)
get_admin_user = require_role(ROLE_ADMIN)
