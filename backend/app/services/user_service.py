from fastapi import HTTPException

from app.core.database import supabase
from app.core.roles import ROLE_ADMIN, ROLE_CUSTOMER
from app.repositories.user_role_repository import get_all_user_roles, upsert_user_role
from app.schemas.user import UserWithRole


def _list_all_users():
    """Fetches all GoTrue users across pages (list_users returns one page)."""
    page, per_page = 1, 100
    while True:
        batch = supabase.auth.admin.list_users(page=page, per_page=per_page)
        if not batch:
            break
        yield from batch
        if len(batch) < per_page:
            break
        page += 1


def list_users() -> list[UserWithRole]:
    users = list(_list_all_users())
    roles = get_all_user_roles()
    result = []
    for user in users:
        role = roles.get(user.id) or ROLE_CUSTOMER
        metadata = user.user_metadata or {}
        result.append(
            UserWithRole(
                id=user.id,
                email=user.email or "",
                name=metadata.get("name"),
                role=role,
                created_at=str(user.created_at) if user.created_at else None,
            )
        )
    return result


def set_user_role(user_id: str, role: str, acting_user_id: str) -> dict:
    if user_id == acting_user_id and role != ROLE_ADMIN:
        raise HTTPException(
            status_code=400, detail="Você não pode remover seu próprio acesso de administrador"
        )
    result = upsert_user_role(user_id, role)
    if not result:
        raise HTTPException(status_code=500, detail="Falha ao atualizar o papel do usuário")
    return result
