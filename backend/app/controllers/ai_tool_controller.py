from fastapi import Depends, Query, Request

from app.core.auth import CurrentUser, get_current_user
from app.schemas.ai_tool import ResolveRequest, ResolveResponse, RunOut, Tool
from app.services import ai_tool_service


async def list_tools(
    request: Request,
    q: str = Query(default="", max_length=80),
    user: CurrentUser = Depends(get_current_user),
) -> list[Tool]:
    return await ai_tool_service.search_tools(request.app.state.db_pool, q)


async def get_tool(
    slug: str, request: Request, user: CurrentUser = Depends(get_current_user)
) -> Tool:
    return await ai_tool_service.get_tool(request.app.state.db_pool, slug)


async def resolve_tool(
    body: ResolveRequest, request: Request, user: CurrentUser = Depends(get_current_user)
) -> ResolveResponse:
    return await ai_tool_service.resolve(
        request.app.state.db_pool, request.app.state.tool_runner, user, body.name
    )


async def get_run(
    run_id: str, request: Request, user: CurrentUser = Depends(get_current_user)
) -> RunOut:
    return await ai_tool_service.get_run(request.app.state.db_pool, user, run_id)
