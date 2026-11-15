import asyncpg
import structlog

from app.core.config import Settings

log = structlog.get_logger()


async def create_pool(settings: Settings) -> asyncpg.Pool | None:
    """Crée le pool Postgres. Retourne None si non configuré ou injoignable."""
    dsn = settings.database_url.get_secret_value()
    if not dsn:
        log.warning("database_url_missing")
        return None
    try:
        return await asyncpg.create_pool(
            dsn,
            min_size=1,
            max_size=5,
            timeout=10,
            # Requis avec le pooler Supabase en mode transaction (port 6543)
            statement_cache_size=0,
        )
    except Exception as exc:  # noqa: BLE001
        log.error("database_connect_failed", error=repr(exc))
        return None
