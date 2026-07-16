from fastapi import APIRouter, Depends

from app.dependencies.auth import get_admin_user
from app.services.audit_service import listar_auditoria

router = APIRouter(prefix="/admin/auditoria", tags=["admin"])


@router.get("")
def get_auditoria(_user=Depends(get_admin_user)):
    return listar_auditoria()
