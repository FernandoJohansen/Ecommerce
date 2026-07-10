from supabase import create_client, Client
from supabase.client import ClientOptions
from app.core.config import SUPABASE_URL, SUPABASE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Auth-only client for login/signup. Signing in stores the user's session on
# the client, which would replace the service-role key on the shared client
# above and break admin/table access — so user auth flows must never run on it.
supabase_auth: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
    options=ClientOptions(auto_refresh_token=False, persist_session=False),
)
