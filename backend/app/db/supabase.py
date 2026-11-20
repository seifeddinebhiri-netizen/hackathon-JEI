import structlog
from supabase import AsyncClient, acreate_client

from app.core.config import Settings

log = structlog.get_logger()


async def create_supabase(settings: Settings) -> AsyncClient | None:
    """Client Supabase (clé service role, côté serveur uniquement).

    Retourne None si non configuré ou invalide, comme create_pool.
    """
    key = settings.supabase_service_role_key.get_secret_value()
    if not settings.supabase_url or not key:
        return None
    try:
        return await acreate_client(settings.supabase_url, key)
    except Exception as exc:  # noqa: BLE001
        log.error("supabase_client_failed", error=repr(exc))
        return None
