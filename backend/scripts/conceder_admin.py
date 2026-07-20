"""Semeia/ajusta papel de usuário direto no banco (tabela user_roles).

É o único caminho de bootstrap do primeiro admin: a API não concede admin por
e-mail/env (ver dependencies/auth.py), então numa instalação nova a dona cria
a conta normalmente e o operador roda este script uma vez.

Uso (de backend/, requer .env com a service role):
    uv run python scripts/conceder_admin.py dona@example.com           # admin
    uv run python scripts/conceder_admin.py fulano@example.com staff
    uv run python scripts/conceder_admin.py fulano@example.com customer
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import supabase  # noqa: E402
from app.core.roles import ROLE_ADMIN, ROLE_HIERARCHY  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    email = sys.argv[1].strip().lower()
    role = sys.argv[2].strip().lower() if len(sys.argv) > 2 else ROLE_ADMIN
    if role not in ROLE_HIERARCHY:
        raise SystemExit(f"Papel inválido: {role!r} (use {', '.join(ROLE_HIERARCHY)})")

    alvo = next(
        (u for u in supabase.auth.admin.list_users() if (u.email or "").lower() == email), None
    )
    if alvo is None:
        raise SystemExit(f"Nenhum usuário com o e-mail {email} — crie a conta antes.")

    supabase.table("user_roles").upsert({"user_id": alvo.id, "role": role}).execute()
    print(f"{email} ({alvo.id}) agora é {role}.")


if __name__ == "__main__":
    main()
