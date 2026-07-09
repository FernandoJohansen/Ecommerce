from app.core.database import supabase


def get_user_role(user_id: str) -> str | None:
    result = supabase.table("user_roles").select("role").eq("user_id", user_id).execute()
    return result.data[0]["role"] if result.data else None


def get_all_user_roles() -> dict[str, str]:
    result = supabase.table("user_roles").select("user_id, role").execute()
    return {row["user_id"]: row["role"] for row in result.data}


def upsert_user_role(user_id: str, role: str) -> dict:
    result = supabase.table("user_roles").upsert({"user_id": user_id, "role": role}).execute()
    return result.data[0] if result.data else {}
