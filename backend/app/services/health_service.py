import asyncpg
import structlog

log = structlog.get_logger()


async def check_database(pool: asyncpg.Pool | None) -> str:
    if pool is None:
        return "not_configured"
    try:
        async with pool.acquire(timeout=5) as conn:
            await conn.fetchval("SELECT 1")
        return "up"
    except Exception as exc:  # noqa: BLE001
        log.error("database_check_failed", error=repr(exc))
        return "down"
