"""Integration test conftest.

Loads real .env credentials (override the mock values set by the root conftest)
and exposes a session-scoped `db` fixture — a fresh Supabase client that talks
to the real database. Tests use `db` directly; no app.core.database singleton
is involved so there is no import-order race.

Run integration tests in isolation:
    uv run pytest tests/integration/ -v
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Override mock vars set by root conftest before any supabase import.
_env_file = Path(__file__).parent.parent.parent / ".env"
load_dotenv(_env_file, override=True)

import pytest
from supabase import create_client

_URL = os.environ["SUPABASE_URL"]
_KEY = os.environ["SUPABASE_KEY"]


@pytest.fixture(scope="session")
def db():
    """Fresh Supabase client using real credentials."""
    return create_client(_URL, _KEY)
