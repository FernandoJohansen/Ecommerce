from app.core.database import supabase


def insert_evento(data: dict) -> None:
    supabase.table("audit_log").insert(data).execute()


def get_eventos(limite: int = 200) -> list[dict]:
    result = (
        supabase.table("audit_log")
        .select("*")
        .order("created_at", desc=True)
        .limit(limite)
        .execute()
    )
    return result.data or []
