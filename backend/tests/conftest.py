import os

# Set before any app.* import so config.py doesn't raise RuntimeError and
# database.py doesn't attempt a real Supabase connection.
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-service-role-key-for-unit-tests-only")
os.environ.setdefault("ENVIRONMENT", "development")
