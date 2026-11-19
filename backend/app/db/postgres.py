import asyncio

import asyncpg
import structlog
from fastapi import FastAPI

from app.core.config import Settings

log = structlog.get_logger()

_reconnect_lock = asyncio.Lock()


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
            # Chiffrement obligatoire : refuse une connexion en clair
            ssl="require",
            # Requis avec le pooler Supabase en mode transaction (port 6543)
            statement_cache_size=0,
        )
    except Exception as exc:  # noqa: BLE001
        log.error("database_connect_failed", error=repr(exc))
        return None


async def ensure_pool(app: FastAPI, settings: Settings) -> asyncpg.Pool | None:
    """Retourne le pool, en retentant la connexion s'il a échoué au démarrage."""
    if app.state.db_pool is None and settings.database_url.get_secret_value():
        async with _reconnect_lock:
            if app.state.db_pool is None:
                app.state.db_pool = await create_pool(settings)
                if app.state.db_pool is not None:
                    log.info("database_reconnected")
    return app.state.db_pool
