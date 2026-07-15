from app.core.database import supabase


def get_all_produtos() -> list[dict]:
    result = supabase.table("produtos").select("*").eq("ativo", True).order("ordem").execute()
    return result.data


def get_all_produtos_admin() -> list[dict]:
    """Todos os produtos, inclusive inativos, para o admin."""
    result = supabase.table("produtos").select("*").order("ordem").order("nome").execute()
    return result.data


def get_produto_by_id(produto_id: str) -> dict | None:
    result = supabase.table("produtos").select("*").eq("id", produto_id).execute()
    return result.data[0] if result.data else None


def get_produto_by_nome(nome: str) -> dict | None:
    result = supabase.table("produtos").select("id, nome").eq("nome", nome).execute()
    return result.data[0] if result.data else None


def insert_produto(data: dict) -> dict:
    result = supabase.table("produtos").insert(data).execute()
    return result.data[0]


def update_produto(produto_id: str, data: dict) -> dict:
    result = supabase.table("produtos").update(data).eq("id", produto_id).execute()
    return result.data[0] if result.data else {}


PRODUTO_IMAGENS_BUCKET = "produtos"


def upload_imagem_storage(path: str, content: bytes, content_type: str) -> str:
    """Sobe a imagem no bucket de produtos e retorna a URL pública."""
    storage = supabase.storage.from_(PRODUTO_IMAGENS_BUCKET)
    storage.upload(path, content, {"content-type": content_type, "upsert": "true"})
    return storage.get_public_url(path).rstrip("?")


def remove_imagem_storage(path: str) -> None:
    supabase.storage.from_(PRODUTO_IMAGENS_BUCKET).remove([path])


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
