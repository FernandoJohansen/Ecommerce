"""Payment token (anti-IDOR) — pure HMAC functions, no I/O.

These tokens gate the guest payment endpoints; a broken token would allow
any attacker who knows (or guesses) a pedido UUID to pay on behalf of the
real buyer, or to poll for payment status without authorisation.
"""

import os
import time

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-service-role-key-for-unit-tests-only")
os.environ.setdefault("ENVIRONMENT", "development")

import pytest

from app.core.payment_token import gerar_token_pagamento, token_pagamento_valido


class TestGerarToken:
    def test_returns_string(self):
        token = gerar_token_pagamento("pedido-abc")
        assert isinstance(token, str)

    def test_contains_dot_separator(self):
        token = gerar_token_pagamento("pedido-abc")
        assert "." in token

    def test_expiry_field_is_integer(self):
        token = gerar_token_pagamento("pedido-abc")
        expiry_str, _, _ = token.partition(".")
        assert expiry_str.isdigit()

    def test_expiry_is_in_the_future(self):
        token = gerar_token_pagamento("pedido-abc")
        expiry_str, _, _ = token.partition(".")
        assert int(expiry_str) > int(time.time())


class TestTokenValido:
    def test_fresh_token_is_valid(self):
        pedido_id = "pedido-uuid-001"
        token = gerar_token_pagamento(pedido_id)
        assert token_pagamento_valido(token, pedido_id) is True

    def test_wrong_pedido_id_fails(self):
        token = gerar_token_pagamento("pedido-uuid-001")
        assert token_pagamento_valido(token, "pedido-uuid-002") is False

    def test_tampered_signature_fails(self):
        token = gerar_token_pagamento("pedido-abc")
        expiry, _, sig = token.partition(".")
        tampered = f"{expiry}.{'a' * len(sig)}"
        assert token_pagamento_valido(tampered, "pedido-abc") is False

    def test_expired_token_fails(self):
        # Build a token that expired 1 second ago by patching the expiry field
        pedido_id = "pedido-expired"
        import hashlib
        import hmac
        from app.core.config import PAYMENT_TOKEN_SECRET

        expira_em = int(time.time()) - 1
        mensagem = f"{pedido_id}:{expira_em}".encode()
        sig = hmac.new(PAYMENT_TOKEN_SECRET.encode(), mensagem, hashlib.sha256).hexdigest()
        token = f"{expira_em}.{sig}"
        assert token_pagamento_valido(token, pedido_id) is False

    def test_malformed_no_dot_fails(self):
        assert token_pagamento_valido("nodothere", "pedido-abc") is False

    def test_malformed_non_numeric_expiry_fails(self):
        assert token_pagamento_valido("abc.somesig", "pedido-abc") is False

    def test_empty_token_fails(self):
        assert token_pagamento_valido("", "pedido-abc") is False

    def test_two_different_pedidos_get_different_tokens(self):
        t1 = gerar_token_pagamento("pedido-001")
        t2 = gerar_token_pagamento("pedido-002")
        assert t1 != t2
