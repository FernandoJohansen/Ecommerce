"""Read-only integration tests for the produtos and aromas tables.

Safe to run against production: no writes are made.
"""

import pytest


class TestProdutos:
    def test_returns_list(self, db):
        result = db.table("produtos").select("*").eq("ativo", True).order("ordem").execute()
        assert isinstance(result.data, list)

    def test_active_products_have_required_fields(self, db):
        result = db.table("produtos").select("*").eq("ativo", True).execute()
        for produto in result.data:
            assert "id" in produto, f"produto sem id: {produto}"
            assert "nome" in produto, f"produto sem nome: {produto}"
            assert "ativo" in produto
            assert produto["ativo"] is True

    def test_prices_are_non_negative(self, db):
        # Prices are stored as a JSONB dict {"tamanho": centavos, ...}
        result = db.table("produtos").select("nome, precos").eq("ativo", True).execute()
        for p in result.data:
            precos = p.get("precos") or {}
            for tamanho, valor in precos.items():
                assert isinstance(valor, int), f"{p['nome']} preço {tamanho} não é int: {valor}"
                assert valor >= 0, f"{p['nome']} preço {tamanho} negativo: {valor}"

    def test_stock_is_non_negative(self, db):
        result = db.table("produtos").select("nome, estoque").execute()
        for p in result.data:
            estoque = p.get("estoque")
            if estoque is not None:
                assert estoque >= 0, f"estoque negativo: {p['nome']} = {estoque}"

    def test_admin_view_includes_inactive(self, db):
        all_rows = db.table("produtos").select("id, ativo").execute()
        active_rows = db.table("produtos").select("id").eq("ativo", True).execute()
        # Admin view must be >= active view
        assert len(all_rows.data) >= len(active_rows.data)


class TestAromas:
    def test_returns_list(self, db):
        result = db.table("aromas").select("*").eq("ativo", True).order("ordem").execute()
        assert isinstance(result.data, list)

    def test_aromas_have_nome(self, db):
        result = db.table("aromas").select("*").eq("ativo", True).execute()
        assert len(result.data) > 0, "Nenhum aroma ativo — tabela vazia?"
        for aroma in result.data:
            assert "nome" in aroma
            assert aroma["nome"], f"aroma com nome vazio: {aroma}"

    def test_no_duplicate_aroma_names(self, db):
        result = db.table("aromas").select("nome").eq("ativo", True).execute()
        nomes = [r["nome"] for r in result.data]
        assert len(nomes) == len(set(nomes)), f"Aromas duplicados: {nomes}"
