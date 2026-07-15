from app.core.database import supabase


def insert_pagamento(data: dict) -> dict:
    result = supabase.table("pagamentos").insert(data).execute()
    return result.data[0] if result.data else {}


def get_pagamento_by_txid(txid: str) -> dict | None:
    result = supabase.table("pagamentos").select("*").eq("txid", txid).execute()
    return result.data[0] if result.data else None


def get_pagamentos_by_pedido(pedido_id: str) -> list[dict]:
    result = (
        supabase.table("pagamentos")
        .select("*")
        .eq("pedido_id", pedido_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def update_pagamento(txid: str, data: dict) -> dict:
    result = supabase.table("pagamentos").update(data).eq("txid", txid).execute()
    return result.data[0] if result.data else {}


def get_pagamento_by_mp_id(mp_payment_id: str) -> dict | None:
    result = (
        supabase.table("pagamentos").select("*").eq("mp_payment_id", mp_payment_id).execute()
    )
    return result.data[0] if result.data else None


def get_pagamentos_by_pedido_metodo(pedido_id: str, metodo: str) -> list[dict]:
    result = (
        supabase.table("pagamentos")
        .select("*")
        .eq("pedido_id", pedido_id)
        .eq("metodo", metodo)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


# Linhas do Mercado Pago têm txid NULL — só podem ser atualizadas pelo id.
def update_pagamento_by_id(pagamento_id: str, data: dict) -> dict:
    result = supabase.table("pagamentos").update(data).eq("id", pagamento_id).execute()
    return result.data[0] if result.data else {}
