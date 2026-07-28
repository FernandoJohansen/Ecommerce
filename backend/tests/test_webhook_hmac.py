"""Webhook HMAC signature validation — tests for _validar_assinatura_mp.

Seam: _validar_assinatura_mp(request, data_id) raises HTTPException(401)
on any signature failure; returns None on success.

The expected HMAC values are computed independently in each helper, not
re-derived from the implementation under test.
"""

import hashlib
import hmac
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

_SECRET = "test-webhook-secret-abc123"
_TS = "1700000000"  # fixed timestamp; staleness check disabled in all tests


def _mock_request(data_id: str, secret: str, *, request_id: str | None = None) -> MagicMock:
    """Build a mock Starlette Request whose x-signature header contains the
    correct HMAC for the given data_id and secret.  This mirrors what
    MercadoPago would send — it is NOT the implementation under test."""
    manifesto = ""
    if data_id:
        manifesto += f"id:{data_id};"
    if request_id:
        manifesto += f"request-id:{request_id};"
    manifesto += f"ts:{_TS};"

    v1 = hmac.new(secret.encode(), manifesto.encode(), hashlib.sha256).hexdigest()
    x_sig = f"ts={_TS},v1={v1}"

    headers: dict[str, str] = {"x-signature": x_sig}
    if request_id is not None:
        headers["x-request-id"] = request_id

    req = MagicMock()
    req.headers.get.side_effect = lambda key, default=None: headers.get(key, default)
    return req


# Disable timestamp staleness check for all tests in this module so the fixed
# _TS value doesn't cause spurious 401s regardless of when the suite runs.
pytestmark = pytest.mark.usefixtures("_disable_ts_check")


@pytest.fixture(autouse=True)
def _disable_ts_check(monkeypatch):
    import app.api.v1.payments as mod

    monkeypatch.setattr(mod, "MERCADO_PAGO_WEBHOOK_TOLERANCIA_SEGUNDOS", 0)
    monkeypatch.setattr(mod, "MERCADO_PAGO_WEBHOOK_SECRET", _SECRET)


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_valid_signature_passes():
    from app.api.v1.payments import _validar_assinatura_mp

    req = _mock_request("12345678", _SECRET)
    # Must not raise
    _validar_assinatura_mp(req, "12345678")


def test_valid_signature_with_request_id_passes():
    from app.api.v1.payments import _validar_assinatura_mp

    req = _mock_request("12345678", _SECRET, request_id="req-abc")
    _validar_assinatura_mp(req, "12345678")


def test_mixed_case_data_id_preserved_in_manifest():
    """data_id must enter the manifest as-is; any case change breaks the HMAC."""
    from app.api.v1.payments import _validar_assinatura_mp

    mixed = "AbC123XyZ"
    req = _mock_request(mixed, _SECRET)
    # Passing the same mixed-case ID → manifest matches → no exception
    _validar_assinatura_mp(req, mixed)


# ---------------------------------------------------------------------------
# Regression: the old bug lowercased data_id, which caused HMAC mismatch
# for any ID containing uppercase characters.
# ---------------------------------------------------------------------------


def test_lowercased_data_id_fails_when_mp_sent_mixed_case():
    """Regression guard for the bug that lowercased data_id before HMAC.

    MP signs with the original mixed-case ID.  If the server lowercases it
    before computing the expected HMAC, the manifests differ → 401.
    This test catches any re-introduction of .lower() on data_id.
    """
    from app.api.v1.payments import _validar_assinatura_mp

    mixed = "AbC123XyZ"
    # The signed request uses the mixed-case ID (as MP would send)
    req = _mock_request(mixed, _SECRET)

    # Passing the lowercased ID to the validator → manifest mismatch → 401
    with pytest.raises(HTTPException) as exc:
        _validar_assinatura_mp(req, mixed.lower())

    assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# Error cases
# ---------------------------------------------------------------------------


def test_wrong_secret_raises_401():
    from app.api.v1.payments import _validar_assinatura_mp

    req = _mock_request("12345678", "wrong-secret-xyz")
    with pytest.raises(HTTPException) as exc:
        _validar_assinatura_mp(req, "12345678")
    assert exc.value.status_code == 401


def test_tampered_data_id_raises_401():
    from app.api.v1.payments import _validar_assinatura_mp

    # Signed for "12345678", presented as "99999999"
    req = _mock_request("12345678", _SECRET)
    with pytest.raises(HTTPException) as exc:
        _validar_assinatura_mp(req, "99999999")
    assert exc.value.status_code == 401


def test_missing_v1_raises_401():
    from app.api.v1.payments import _validar_assinatura_mp

    req = MagicMock()
    # x-signature present but has no v1= part
    req.headers.get.side_effect = lambda key, default=None: (
        f"ts={_TS}" if key == "x-signature" else default
    )

    with pytest.raises(HTTPException) as exc:
        _validar_assinatura_mp(req, "12345678")
    assert exc.value.status_code == 401


def test_empty_signature_header_raises_401():
    from app.api.v1.payments import _validar_assinatura_mp

    req = MagicMock()
    req.headers.get.side_effect = lambda key, default=None: default

    with pytest.raises(HTTPException) as exc:
        _validar_assinatura_mp(req, "12345678")
    assert exc.value.status_code == 401
