from app.core.database import supabase


def get_product_tags() -> list[dict]:
    result = supabase.table("produtos").select("tag").eq("ativo", True).execute()
    counts: dict[str, int] = {}
    for row in result.data:
        tag = row.get("tag")
        if tag:
            counts[tag] = counts.get(tag, 0) + 1
    return [{"nome": tag, "total_produtos": count} for tag, count in counts.items()]
