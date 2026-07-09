from app.core.database import supabase


def get_all_produtos() -> list[dict]:
    result = supabase.table("produtos").select("*").eq("ativo", True).order("ordem").execute()
    return result.data


def get_all_aromas() -> list[dict]:
    result = supabase.table("aromas").select("*").eq("ativo", True).order("ordem").execute()
    return result.data
