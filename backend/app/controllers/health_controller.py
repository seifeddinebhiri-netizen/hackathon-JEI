from fastapi import Request, Response

from app.schemas.health import LiveResponse, ReadyResponse
from app.services import health_service


async def live() -> LiveResponse:
    return LiveResponse(status="ok")


async def ready(request: Request, response: Response) -> ReadyResponse:
    state = request.app.state
    database = await health_service.check_database(state.db_pool)
    supabase = "configured" if state.supabase is not None else "not_configured"
    ok = database == "up"
    if not ok:
        response.status_code = 503
    return ReadyResponse(status="ok" if ok else "degraded", database=database, supabase=supabase)
