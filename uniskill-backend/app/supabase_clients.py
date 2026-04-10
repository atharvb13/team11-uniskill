import os

from supabase import Client, ClientOptions, create_client

_supabase_url = os.environ.get("SUPABASE_URL")
_supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY")
_supabase_service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not _supabase_url or not _supabase_anon_key or not _supabase_service_role_key:
    raise RuntimeError("Missing Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).")

supabase_auth_client: Client = create_client(_supabase_url, _supabase_anon_key)

supabase_admin_client: Client = create_client(
    _supabase_url,
    _supabase_service_role_key,
    options=ClientOptions(
        auto_refresh_token=False,
        persist_session=False,
    ),
)
