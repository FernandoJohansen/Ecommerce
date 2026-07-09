from app.core.database import supabase


def insert_pedido(data: dict) -> dict:
    result = supabase.table("pedidos").insert(data).execute()
    return result.data[0] if result.data else {}


def get_all_pedidos() -> list[dict]:
    result = supabase.table("pedidos").select("*").order("created_at", desc=True).execute()
    return result.data


def update_pedido(pedido_id: str, data: dict) -> dict:
    result = supabase.table("pedidos").update(data).eq("id", pedido_id).execute()
    return result.data[0] if result.data else {}


def delete_pedido(pedido_id: str) -> dict:
    result = supabase.table("pedidos").delete().eq("id", pedido_id).execute()
    return result.data[0] if result.data else {}
