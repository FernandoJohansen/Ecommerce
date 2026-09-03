from app.core.database import supabase


def webhook_evento_novo(event_id: str, provider: str) -> bool:
    """Returns True if event_id is new and was registered; False if duplicate.

    Uses upsert with ignore_duplicates so transient DB errors propagate (and
    cause the PSP to retry) instead of being silently swallowed as duplicates.
    """
    result = (
        supabase.table("webhook_events")
        .upsert({"event_id": event_id, "provider": provider}, ignore_duplicates=True)
        .execute()
    )
    return bool(result.data)
