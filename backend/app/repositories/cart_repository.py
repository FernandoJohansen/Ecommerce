from app.core.database import supabase

TABLE = "carrinho_itens"


def get_items(user_id: str) -> list[dict]:
    result = (
        supabase.table(TABLE).select("*").eq("user_id", user_id).order("created_at").execute()
    )
    return result.data


def find_matching_item(user_id: str, item: dict) -> dict | None:
    result = (
        supabase.table(TABLE)
        .select("*")
        .eq("user_id", user_id)
        .eq("produto_nome", item["produto_nome"])
        .eq("tamanho", item["tamanho"])
        .eq("aroma", item["aroma"])
        .eq("refil", item["refil"])
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def insert_item(data: dict) -> dict:
    result = supabase.table(TABLE).insert(data).execute()
    return result.data[0] if result.data else {}


def update_item(item_id: str, user_id: str, data: dict) -> dict:
    result = (
        supabase.table(TABLE).update(data).eq("id", item_id).eq("user_id", user_id).execute()
    )
    return result.data[0] if result.data else {}


def delete_item(item_id: str, user_id: str) -> dict:
    result = (
        supabase.table(TABLE).delete().eq("id", item_id).eq("user_id", user_id).execute()
    )
    return result.data[0] if result.data else {}


def clear_items(user_id: str) -> int:
    result = supabase.table(TABLE).delete().eq("user_id", user_id).execute()
    return len(result.data or [])
