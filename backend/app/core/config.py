import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
PIX_KEY: str = os.getenv("PIX_KEY", "")
PIX_BENEFICIARIO: str = os.getenv("PIX_BENEFICIARIO", "Carolina Viapiana")
ADMIN_EMAILS: set[str] = {
    email.strip().lower() for email in os.getenv("ADMIN_EMAILS", "").split(",") if email.strip()
}

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
