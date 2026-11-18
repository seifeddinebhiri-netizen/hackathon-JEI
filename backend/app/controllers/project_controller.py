from fastapi import Depends, Request, Response

from app.core.auth import CurrentUser, get_current_user
from app.schemas.project import CreateProjectInput, Me, Ok, Project, UpdateProjectInput
from app.services import project_service


async def create_project(
    body: CreateProjectInput,
    request: Request,
    response: Response,
    user: CurrentUser = Depends(get_current_user),
) -> Project:
    project = await project_service.create_project(request.app.state.db_pool, user, body)
    response.status_code = 201
    return project


async def get_project(
    project_id: str, request: Request, user: CurrentUser = Depends(get_current_user)
) -> Project:
    return await project_service.get_project(request.app.state.db_pool, user, project_id)


async def update_project(
    project_id: str,
    body: UpdateProjectInput,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
) -> Project:
    return await project_service.update_project(request.app.state.db_pool, user, project_id, body)


async def delete_project(
    project_id: str, request: Request, user: CurrentUser = Depends(get_current_user)
) -> Ok:
    await project_service.delete_project(request.app.state.db_pool, user, project_id)
    return Ok()


async def me(request: Request, user: CurrentUser = Depends(get_current_user)) -> Me:
    return await project_service.get_me(request.app.state.db_pool, user)
