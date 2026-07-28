"""Order state machine — tests for update_pedido_status.

Seam: update_pedido_status(pedido_id, PedidoUpdate)
Mocked at the repository boundary so no Supabase connection is made.
"""

from unittest.mock import call, patch

import pytest
from fastapi import HTTPException

from app.schemas.order import PedidoUpdate
from app.services.order_service import update_pedido_status

# ---------------------------------------------------------------------------
# Shared test data
# ---------------------------------------------------------------------------

_ITENS = [
    {
        "produto_nome": "Difusor P",
        "tamanho": "P",
        "aroma": "Lavanda",
        "refil": False,
        "quantidade": 2,
        "preco_unitario_centavos": 4500,
        "subtotal_centavos": 9000,
    },
    {
        "produto_nome": "Difusor G",
        "tamanho": "G",
        "aroma": "Rosa",
        "refil": False,
        "quantidade": 1,
        "preco_unitario_centavos": 8000,
        "subtotal_centavos": 8000,
    },
]

# What quantidades_por_produto(_ITENS) should produce (computed by hand):
_EXPECTED_QUANTIDADES = {"Difusor P": 2, "Difusor G": 1}


def _pedido(status: str, itens: list | None = None) -> dict:
    return {"id": "pedido-001", "status": status, "itens": itens or []}


def _updated(status: str) -> dict:
    return {"id": "pedido-001", "status": status}


# ---------------------------------------------------------------------------
# Valid transitions
# ---------------------------------------------------------------------------


@patch("app.services.order_service.repor_estoque_pedido")
@patch("app.services.order_service.update_pedido")
@patch("app.services.order_service.get_pedido_by_id")
class TestValidTransitions:
    def test_novo_to_pago(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("novo")
        mock_update.return_value = _updated("pago")

        result = update_pedido_status("pedido-001", PedidoUpdate(status="pago"))

        assert result["status"] == "pago"
        mock_repor.assert_not_called()

    def test_novo_to_em_andamento(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("novo")
        mock_update.return_value = _updated("em_andamento")

        result = update_pedido_status("pedido-001", PedidoUpdate(status="em_andamento"))

        assert result["status"] == "em_andamento"
        mock_repor.assert_not_called()

    def test_pago_to_enviado(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("pago")
        mock_update.return_value = _updated("enviado")

        result = update_pedido_status("pedido-001", PedidoUpdate(status="enviado"))

        assert result["status"] == "enviado"
        mock_repor.assert_not_called()

    def test_enviado_to_concluido(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("enviado")
        mock_update.return_value = _updated("concluido")

        result = update_pedido_status("pedido-001", PedidoUpdate(status="concluido"))

        assert result["status"] == "concluido"
        mock_repor.assert_not_called()


# ---------------------------------------------------------------------------
# Invalid (blocked) transitions
# ---------------------------------------------------------------------------


@patch("app.services.order_service.repor_estoque_pedido")
@patch("app.services.order_service.update_pedido")
@patch("app.services.order_service.get_pedido_by_id")
class TestBlockedTransitions:
    def test_cancelado_to_pago_raises_409(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("cancelado")

        with pytest.raises(HTTPException) as exc:
            update_pedido_status("pedido-001", PedidoUpdate(status="pago"))

        assert exc.value.status_code == 409
        mock_update.assert_not_called()

    def test_concluido_to_expirado_raises_409(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("concluido")

        with pytest.raises(HTTPException) as exc:
            update_pedido_status("pedido-001", PedidoUpdate(status="expirado"))

        assert exc.value.status_code == 409
        mock_update.assert_not_called()

    def test_pago_to_cancelado_raises_409(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("pago")

        with pytest.raises(HTTPException) as exc:
            update_pedido_status("pedido-001", PedidoUpdate(status="cancelado"))

        assert exc.value.status_code == 409
        mock_update.assert_not_called()

    def test_expirado_to_novo_raises_409(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("expirado")

        with pytest.raises(HTTPException) as exc:
            update_pedido_status("pedido-001", PedidoUpdate(status="novo"))

        assert exc.value.status_code == 409
        mock_update.assert_not_called()


# ---------------------------------------------------------------------------
# Stock restoration on cancel / expire
# ---------------------------------------------------------------------------


@patch("app.services.order_service.repor_estoque_pedido")
@patch("app.services.order_service.update_pedido")
@patch("app.services.order_service.get_pedido_by_id")
class TestStockRestoration:
    def test_novo_to_cancelado_restores_stock(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("novo", _ITENS)
        mock_update.return_value = _updated("cancelado")

        update_pedido_status("pedido-001", PedidoUpdate(status="cancelado"))

        mock_repor.assert_called_once_with(_EXPECTED_QUANTIDADES)

    def test_novo_to_expirado_restores_stock(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("novo", _ITENS)
        mock_update.return_value = _updated("expirado")

        update_pedido_status("pedido-001", PedidoUpdate(status="expirado"))

        mock_repor.assert_called_once_with(_EXPECTED_QUANTIDADES)

    def test_em_andamento_to_cancelado_restores_stock(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("em_andamento", _ITENS)
        mock_update.return_value = _updated("cancelado")

        update_pedido_status("pedido-001", PedidoUpdate(status="cancelado"))

        mock_repor.assert_called_once_with(_EXPECTED_QUANTIDADES)

    def test_pago_to_reembolsado_does_not_restore_stock(self, mock_get, mock_update, mock_repor):
        # Stock was already consumed on payment — a refund doesn't put stock back
        mock_get.return_value = _pedido("pago", _ITENS)
        mock_update.return_value = _updated("reembolsado")

        update_pedido_status("pedido-001", PedidoUpdate(status="reembolsado"))

        mock_repor.assert_not_called()

    def test_enviado_to_concluido_does_not_restore_stock(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = _pedido("enviado", _ITENS)
        mock_update.return_value = _updated("concluido")

        update_pedido_status("pedido-001", PedidoUpdate(status="concluido"))

        mock_repor.assert_not_called()

    def test_missing_pedido_raises_404(self, mock_get, mock_update, mock_repor):
        mock_get.return_value = None

        with pytest.raises(HTTPException) as exc:
            update_pedido_status("ghost-id", PedidoUpdate(status="pago"))

        assert exc.value.status_code == 404
        mock_repor.assert_not_called()
