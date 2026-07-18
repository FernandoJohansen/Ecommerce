from app.core.database import supabase


def insert_pedido(data: dict) -> dict:
    result = supabase.table("pedidos").insert(data).execute()
    return result.data[0] if result.data else {}


def insert_pedido_itens(itens: list[dict]) -> list[dict]:
    result = supabase.table("pedido_itens").insert(itens).execute()
    return result.data or []


def get_pedido_by_id(pedido_id: str) -> dict | None:
    result = supabase.table("pedidos").select("*").eq("id", pedido_id).execute()
    return result.data[0] if result.data else None


def get_all_pedidos() -> list[dict]:
    result = (
        supabase.table("pedidos")
        .select("*, itens:pedido_itens(*)")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def get_pedidos_by_user(user_id: str) -> list[dict]:
    result = (
        supabase.table("pedidos")
        .select("*, itens:pedido_itens(*)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def get_pedido_by_user(pedido_id: str, user_id: str) -> dict | None:
    result = (
        supabase.table("pedidos")
        .select("*, itens:pedido_itens(*)")
        .eq("id", pedido_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None


def get_pedidos_novos_antes(cutoff_iso: str) -> list[dict]:
    """Pedidos ainda 'novo' criados antes do instante dado (candidatos a expirar)."""
    result = (
        supabase.table("pedidos")
        .select("*, itens:pedido_itens(*)")
        .eq("status", "novo")
        .lt("created_at", cutoff_iso)
        .execute()
    )
    return result.data or []


def update_pedido(pedido_id: str, data: dict) -> dict:
    result = supabase.table("pedidos").update(data).eq("id", pedido_id).execute()
    return result.data[0] if result.data else {}


def update_pedido_se_status(pedido_id: str, status_atual: str, data: dict) -> dict | None:
    """Atualiza somente se o pedido ainda estiver no status esperado; None quando
    outro processo mudou o status antes (evita corrida com webhook/admin)."""
    result = (
        supabase.table("pedidos")
        .update(data)
        .eq("id", pedido_id)
        .eq("status", status_atual)
        .execute()
    )
    return result.data[0] if result.data else None


def delete_pedido(pedido_id: str) -> dict:
    # pedido_itens rows go along via ON DELETE CASCADE
    result = supabase.table("pedidos").delete().eq("id", pedido_id).execute()
    return result.data[0] if result.data else {}
