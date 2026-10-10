"""Health endpoints — GET / and GET /health/db.

/health/db is pinged by UptimeRobot; it must never leak table data or
exception text, and must be rate limited.
"""

import os

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-service-role-key-for-unit-tests-only")
os.environ.setdefault("ENVIRONMENT", "development")

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.ratelimit import limiter
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_limiter():
    limiter.reset()
    yield
    limiter.reset()


def _mock_supabase(data=None, error: Exception | None = None):
    mock = MagicMock()
    execute = mock.table.return_value.select.return_value.limit.return_value.execute
    if error is not None:
        execute.side_effect = error
    else:
        execute.return_value = MagicMock(data=data)
    return mock


class TestHealth:
    def test_root_returns_ok(self):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestHealthDb:
    def test_ok_without_leaking_rows(self):
        with patch("app.main.supabase", _mock_supabase(data=[{"id": "x"}])):
            resp = client.get("/health/db")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_503_generic_on_failure(self):
        err = Exception("connection refused secret-host")
        with patch("app.main.supabase", _mock_supabase(error=err)):
            resp = client.get("/health/db")
        assert resp.status_code == 503
        assert resp.json() == {"status": "error"}
        assert "connection refused" not in resp.text
        assert "secret-host" not in resp.text

    def test_rate_limited_after_30_requests(self):
        with patch("app.main.supabase", _mock_supabase(data=[])):
            codes = [client.get("/health/db").status_code for _ in range(31)]
        assert codes[:30] == [200] * 30
        assert codes[30] == 429

    def test_queries_aromas_with_limit_1(self):
        mock = _mock_supabase(data=[])
        with patch("app.main.supabase", mock):
            client.get("/health/db")
        mock.table.assert_called_once_with("aromas")
        mock.table.return_value.select.assert_called_once_with("id")
        mock.table.return_value.select.return_value.limit.assert_called_once_with(1)
