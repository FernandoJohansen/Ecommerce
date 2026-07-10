from app.core.database import supabase


def insert_pedido(data: dict) -> dict:
    result = supabase.table("pedidos").insert(data).execute()
    return result.data[0] if result.data else {}


def insert_pedido_itens(itens: list[dict]) -> list[dict]:
    result = supabase.table("pedido_itens").insert(itens).execute()
    return result.data or []


def get_all_pedidos() -> list[dict]:
    result = (
        supabase.table("pedidos")
        .select("*, itens:pedido_itens(*)")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def update_pedido(pedido_id: str, data: dict) -> dict:
    result = supabase.table("pedidos").update(data).eq("id", pedido_id).execute()
    return result.data[0] if result.data else {}


def delete_pedido(pedido_id: str) -> dict:
    # pedido_itens rows go along via ON DELETE CASCADE
    result = supabase.table("pedidos").delete().eq("id", pedido_id).execute()
    return result.data[0] if result.data else {}
