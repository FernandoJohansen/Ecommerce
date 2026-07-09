from fastapi import APIRouter, Depends

from app.dependencies.auth import get_admin_user
from app.schemas.user import UserRoleUpdate, UserWithRole
from app.services.user_service import list_users, set_user_role

router = APIRouter(prefix="/admin/usuarios", tags=["admin"])


@router.get("", response_model=list[UserWithRole])
def get_users(_user=Depends(get_admin_user)):
    return list_users()


@router.put("/{user_id}/role")
def put_user_role(user_id: str, body: UserRoleUpdate, user=Depends(get_admin_user)):
    return set_user_role(user_id, body.role, user.id)
