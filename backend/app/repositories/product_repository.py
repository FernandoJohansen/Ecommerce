from app.core.database import supabase


def get_all_produtos() -> list[dict]:
    result = supabase.table("produtos").select("*").eq("ativo", True).order("ordem").execute()
    return result.data


def get_all_aromas() -> list[dict]:
    result = supabase.table("aromas").select("*").eq("ativo", True).order("ordem").execute()
    return result.data


def update_produto_estoque(produto_id: str, estoque: int) -> dict:
    result = supabase.table("produtos").update({"estoque": estoque}).eq("id", produto_id).execute()
    return result.data[0] if result.data else {}


def adjust_estoque(produto_nome: str, delta: int) -> int:
    """Atomically adjusts stock via the ajustar_estoque SQL function.

    Raises the underlying postgrest error with message containing
    'estoque_insuficiente' or 'produto_nao_encontrado' on failure.
    """
    result = supabase.rpc(
        "ajustar_estoque", {"p_nome": produto_nome, "p_delta": delta}
    ).execute()
    return result.data
