from app.core.database import supabase


def get_avaliacoes_aprovadas(produto_id: str) -> list[dict]:
    result = (
        supabase.table("avaliacoes")
        .select("id, nota, comentario, nome_avaliador, created_at")
        .eq("produto_id", produto_id)
        .eq("aprovado", True)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def get_avaliacoes_pendentes() -> list[dict]:
    result = (
        supabase.table("avaliacoes")
        .select("id, produto_nome, nota, comentario, nome_avaliador, aprovado, created_at")
        .is_("moderado_em", "null")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def get_avaliacao_by_id(avaliacao_id: str) -> dict | None:
    result = supabase.table("avaliacoes").select("*").eq("id", avaliacao_id).execute()
    return result.data[0] if result.data else None


def get_avaliacao_by_pedido_produto(pedido_id: str, produto_nome: str) -> dict | None:
    result = (
        supabase.table("avaliacoes")
        .select("id")
        .eq("pedido_id", pedido_id)
        .eq("produto_nome", produto_nome)
        .execute()
    )
    return result.data[0] if result.data else None


def get_nomes_itens_pedido(pedido_id: str) -> set[str]:
    result = (
        supabase.table("pedido_itens")
        .select("produto_nome")
        .eq("pedido_id", pedido_id)
        .execute()
    )
    return {row["produto_nome"] for row in (result.data or [])}


def get_produto_id_by_nome(nome: str) -> str | None:
    result = supabase.table("produtos").select("id").eq("nome", nome).execute()
    return result.data[0]["id"] if result.data else None


def insert_avaliacao(data: dict) -> dict:
    result = supabase.table("avaliacoes").insert(data).execute()
    return result.data[0] if result.data else {}


def update_avaliacao(avaliacao_id: str, data: dict) -> dict:
    result = supabase.table("avaliacoes").update(data).eq("id", avaliacao_id).execute()
    return result.data[0] if result.data else {}
