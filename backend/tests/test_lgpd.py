"""LGPD data masking — pure function, no I/O.

mascarar_documento is applied to every API response that includes a pedido's
CPF/CNPJ. A regression here means raw document numbers leak to the client.
"""

import os

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-service-role-key-for-unit-tests-only")
os.environ.setdefault("ENVIRONMENT", "development")

import pytest

from app.core.lgpd import mascarar_documento


class TestCpfMasking:
    def test_cpf_format(self):
        # 529.982.247-25 → ***.982.247-**
        result = mascarar_documento("52998224725")
        assert result == "***.982.247-**"

    def test_cpf_with_punctuation_stripped(self):
        result = mascarar_documento("529.982.247-25")
        assert result == "***.982.247-**"

    def test_cpf_does_not_expose_first_three_digits(self):
        result = mascarar_documento("52998224725")
        assert "529" not in result

    def test_cpf_does_not_expose_verifiers(self):
        result = mascarar_documento("52998224725")
        # verifiers are "25"; they must not appear at the end
        assert not result.endswith("25")
        assert result.endswith("-**")


class TestCnpjMasking:
    def test_cnpj_format(self):
        # 11.222.333/0001-81 → **.222.333/0001-**
        result = mascarar_documento("11222333000181")
        assert result == "**.222.333/0001-**"

    def test_cnpj_with_punctuation_stripped(self):
        result = mascarar_documento("11.222.333/0001-81")
        assert result == "**.222.333/0001-**"

    def test_cnpj_does_not_expose_first_two_digits(self):
        result = mascarar_documento("11222333000181")
        assert not result.startswith("11")

    def test_cnpj_does_not_expose_verifiers(self):
        result = mascarar_documento("11222333000181")
        assert not result.endswith("81")
        assert result.endswith("-**")


class TestEdgeCases:
    def test_none_returns_none(self):
        assert mascarar_documento(None) is None

    def test_empty_string_returns_none(self):
        assert mascarar_documento("") is None

    def test_non_standard_length_returns_stars(self):
        # Anything that is neither 11 nor 14 digits must be hidden entirely
        assert mascarar_documento("12345") == "***"

    def test_whitespace_only_returns_none(self):
        # Strips to 0 digits → empty
        result = mascarar_documento("   ")
        assert result is None or result == "***"
