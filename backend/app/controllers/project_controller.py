from typing import Annotated, Any

import asyncpg
from fastapi import Depends, Request

from app.core.auth import Caller, get_caller
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.postgres import ensure_pool
from app.schemas.project import CreateProjectInput, UpdateProjectInput
from app.services import project_service

CallerDep = Annotated[Caller, Depends(get_caller)]


async def _pool(request: Request) -> asyncpg.Pool:
    pool = await ensure_pool(request.app, get_settings())
    if pool is None:
        raise AppError(
            "Base de données indisponible. Réessaie dans un instant.", 503, "db_unavailable"
        )
    return pool


async def create_project(
    body: CreateProjectInput, request: Request, caller: CallerDep
) -> dict[str, Any]:
    return await project_service.create(await _pool(request), caller.owner_id, body)


async def get_project(project_id: str, request: Request, caller: CallerDep) -> dict[str, Any]:
    return await project_service.get(await _pool(request), caller.owner_id, project_id)


async def update_project(
    project_id: str, body: UpdateProjectInput, request: Request, caller: CallerDep
) -> dict[str, Any]:
    return await project_service.update(await _pool(request), caller.owner_id, project_id, body)


async def delete_project(project_id: str, request: Request, caller: CallerDep) -> dict[str, bool]:
    await project_service.delete(await _pool(request), caller.owner_id, project_id)
    return {"ok": True}
