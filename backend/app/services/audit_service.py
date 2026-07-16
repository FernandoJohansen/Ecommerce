"""Registro de auditoria das ações de equipe/admin (Sprint 10 — hardening).

Chamado pelos handlers da API depois que a ação principal deu certo. O
registro é best-effort: falha na auditoria (ex.: migration do audit_log ainda
não aplicada) é logada e NUNCA derruba a ação que o usuário fez.
"""

import logging

from app.repositories.audit_repository import get_eventos, insert_evento

logger = logging.getLogger(__name__)


def registrar_auditoria(
    user, acao: str, alvo_tipo: str, alvo_id: str | None = None, detalhes: dict | None = None
) -> None:
    try:
        insert_evento(
            {
                "user_id": str(user.id) if user else None,
                "user_email": getattr(user, "email", None),
                "acao": acao,
                "alvo_tipo": alvo_tipo,
                "alvo_id": str(alvo_id) if alvo_id else None,
                "detalhes": detalhes,
            }
        )
    except Exception:
        logger.exception("Falha ao registrar auditoria (%s em %s %s)", acao, alvo_tipo, alvo_id)


def listar_auditoria(limite: int = 200) -> list[dict]:
    return get_eventos(limite)
