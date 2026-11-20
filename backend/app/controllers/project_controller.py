import asyncpg
from fastapi import Depends, Request, Response

from app.core.auth import CurrentUser, get_current_user
from app.core.config import get_settings
from app.db.postgres import ensure_pool
from app.schemas.project import CreateProjectInput, Me, Ok, Project, UpdateProjectInput
from app.services import project_service


async def _pool(request: Request) -> asyncpg.Pool | None:
    """Pool Postgres, recréé si la base était injoignable au démarrage."""
    return await ensure_pool(request.app, get_settings())


async def create_project(
    body: CreateProjectInput,
    request: Request,
    response: Response,
    user: CurrentUser = Depends(get_current_user),
) -> Project:
    project = await project_service.create_project(await _pool(request), user, body)
    response.status_code = 201
    return project


async def get_project(
    project_id: str, request: Request, user: CurrentUser = Depends(get_current_user)
) -> Project:
    return await project_service.get_project(await _pool(request), user, project_id)


async def update_project(
    project_id: str,
    body: UpdateProjectInput,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
) -> Project:
    return await project_service.update_project(await _pool(request), user, project_id, body)


async def delete_project(
    project_id: str, request: Request, user: CurrentUser = Depends(get_current_user)
) -> Ok:
    await project_service.delete_project(await _pool(request), user, project_id)
    return Ok()


async def me(request: Request, user: CurrentUser = Depends(get_current_user)) -> Me:
    return await project_service.get_me(await _pool(request), user)
