"""CPF/CNPJ validation — pure functions, no I/O, no mocking required.

Expected values come from the Brazilian Federal Revenue's published
check-digit algorithm, not from re-running the implementation.
"""

import pytest

from app.schemas.order import _cnpj_valido, _cpf_valido


class TestCpf:
    def test_valid_cpf_passes(self):
        # 529.982.247-25 — standard test CPF from the Receita Federal spec
        assert _cpf_valido("52998224725") is True

    def test_wrong_first_verifier_fails(self):
        # Flip the first check digit: …247-25 → …247-35
        assert _cpf_valido("52998224735") is False

    def test_wrong_second_verifier_fails(self):
        # Flip the second check digit: …247-25 → …247-26
        assert _cpf_valido("52998224726") is False

    def test_all_same_digits_rejected(self):
        # 111.111.111-11 — shortcut guard in the spec
        assert _cpf_valido("11111111111") is False

    def test_all_zeros_rejected(self):
        # 000.000.000-00
        assert _cpf_valido("00000000000") is False

    def test_another_valid_cpf(self):
        # 111.444.777-35 — hand-verified: dv1=(162×10)%11%10=3, dv2=(204×10)%11%10=5
        assert _cpf_valido("11144477735") is True


class TestCnpj:
    def test_valid_cnpj_passes(self):
        # 11.222.333/0001-81 — hand-verified against the Receita Federal algorithm
        assert _cnpj_valido("11222333000181") is True

    def test_wrong_first_verifier_fails(self):
        # 11.222.333/0001-91 (first check digit changed from 8 to 9)
        assert _cnpj_valido("11222333000191") is False

    def test_wrong_second_verifier_fails(self):
        # 11.222.333/0001-82 (second check digit changed from 1 to 2)
        assert _cnpj_valido("11222333000182") is False

    def test_all_same_digits_rejected(self):
        # 11.111.111/1111-11
        assert _cnpj_valido("11111111111111") is False

    def test_all_zeros_rejected(self):
        assert _cnpj_valido("00000000000000") is False
