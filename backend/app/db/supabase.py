from supabase import AsyncClient, acreate_client

from app.core.config import Settings


async def create_supabase(settings: Settings) -> AsyncClient | None:
    """Client Supabase (clé service role, côté serveur uniquement)."""
    key = settings.supabase_service_role_key.get_secret_value()
    if not settings.supabase_url or not key:
        return None
    return await acreate_client(settings.supabase_url, key)
