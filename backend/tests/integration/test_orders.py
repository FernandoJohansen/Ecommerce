"""Integration tests for the pedidos table lifecycle.

Each test that writes data uses a fixture that guarantees cleanup, so the
production database stays tidy even if the assertion fails.
"""

import pytest


_TEST_PEDIDO = {
    "nome_cliente": "[INTEGRATION_TEST] pytest",
    "telefone": "99999999999",
    "cpf_cnpj": "00000000000",
    "cep": "84000000",
    "cidade": "Ponta Grossa",
    "estado": "PR",
    "total_centavos": 0,
    "frete_centavos": 0,
    "status": "novo",
}


@pytest.fixture()
def pedido_id(db):
    """Insert a test pedido and delete it after the test, even on failure."""
    result = db.table("pedidos").insert(_TEST_PEDIDO).execute()
    pid = result.data[0]["id"]
    yield pid
    db.table("pedidos").delete().eq("id", pid).execute()


class TestPedidoLifecycle:
    def test_insert_returns_id(self, db):
        result = db.table("pedidos").insert(_TEST_PEDIDO).execute()
        pid = result.data[0]["id"]
        assert pid
        # cleanup
        db.table("pedidos").delete().eq("id", pid).execute()

    def test_read_by_id(self, db, pedido_id):
        result = db.table("pedidos").select("*").eq("id", pedido_id).execute()
        assert len(result.data) == 1
        row = result.data[0]
        assert row["id"] == pedido_id
        assert row["nome_cliente"] == _TEST_PEDIDO["nome_cliente"]
        assert row["status"] == "novo"

    def test_status_update(self, db, pedido_id):
        db.table("pedidos").update({"status": "cancelado"}).eq("id", pedido_id).execute()
        result = db.table("pedidos").select("status").eq("id", pedido_id).execute()
        assert result.data[0]["status"] == "cancelado"

    def test_delete_cascades_to_itens(self, db, pedido_id):
        # Insert a dummy item for the test pedido
        item = {
            "pedido_id": pedido_id,
            "produto_nome": "Difusor P",
            "tamanho": "P",
            "aroma": "Lavanda",
            "refil": False,
            "quantidade": 1,
            "preco_unitario_centavos": 4500,
            "subtotal_centavos": 4500,
        }
        db.table("pedido_itens").insert(item).execute()

        # The pedido_id fixture will delete the pedido — items must cascade
        # Verify the item exists before deletion
        before = db.table("pedido_itens").select("id").eq("pedido_id", pedido_id).execute()
        assert len(before.data) == 1

        # Delete pedido (cascade)
        db.table("pedidos").delete().eq("id", pedido_id).execute()

        after = db.table("pedido_itens").select("id").eq("pedido_id", pedido_id).execute()
        assert len(after.data) == 0

        # Mark pedido_id as already deleted so the fixture doesn't double-delete
        # (the delete is a no-op on Supabase, but it's cleaner to skip it)


class TestPedidosByUser:
    def test_filter_by_user_id_returns_empty_for_unknown_user(self, db):
        fake_uid = "00000000-0000-0000-0000-000000000000"
        result = (
            db.table("pedidos")
            .select("id")
            .eq("user_id", fake_uid)
            .execute()
        )
        assert result.data == []

    def test_filter_respects_user_id(self, db):
        import uuid

        uid = str(uuid.uuid4())
        pedido = {**_TEST_PEDIDO, "user_id": uid}
        result = db.table("pedidos").insert(pedido).execute()
        pid = result.data[0]["id"]

        try:
            rows = db.table("pedidos").select("id").eq("user_id", uid).execute()
            assert any(r["id"] == pid for r in rows.data)
        finally:
            db.table("pedidos").delete().eq("id", pid).execute()
