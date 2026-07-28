from app.core.database import supabase


def webhook_evento_novo(event_id: str, provider: str) -> bool:
    """Returns True if event_id is new and was registered; False if duplicate.

    Two-step check-then-insert: not perfectly atomic, but combined with the
    PRIMARY KEY constraint any concurrent duplicate insert will silently fail
    and return False. PSP-side verification in payment_service provides the
    authoritative idempotency guard.
    """
    existing = (
        supabase.table("webhook_events")
        .select("event_id")
        .eq("event_id", event_id)
        .execute()
    )
    if existing.data:
        return False
    try:
        supabase.table("webhook_events").insert(
            {"event_id": event_id, "provider": provider}
        ).execute()
        return True
    except Exception:
        return False
