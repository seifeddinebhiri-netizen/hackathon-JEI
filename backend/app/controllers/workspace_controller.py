from uuid import UUID

from fastapi import Depends, Request

from app.core.auth import CurrentUser, get_current_user
from app.schemas.project import Ok
from app.schemas.workspace import WorkspaceIn, WorkspaceOut
from app.services import workspace_service


async def list_workspaces(
    request: Request, user: CurrentUser = Depends(get_current_user)
) -> list[WorkspaceOut]:
    return await workspace_service.list_workspaces(request.app.state.db_pool, user)


async def get_workspace(
    workspace_id: UUID, request: Request, user: CurrentUser = Depends(get_current_user)
) -> WorkspaceOut:
    return await workspace_service.get_workspace(request.app.state.db_pool, user, workspace_id)


async def put_workspace(
    workspace_id: UUID,
    body: WorkspaceIn,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
) -> WorkspaceOut:
    return await workspace_service.put_workspace(
        request.app.state.db_pool, user, workspace_id, body
    )


async def delete_workspace(
    workspace_id: UUID, request: Request, user: CurrentUser = Depends(get_current_user)
) -> Ok:
    await workspace_service.delete_workspace(request.app.state.db_pool, user, workspace_id)
    return Ok()
