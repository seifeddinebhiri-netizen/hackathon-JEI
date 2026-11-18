from fastapi import APIRouter

from app.controllers import workspace_controller as c
from app.schemas.project import Ok
from app.schemas.workspace import WorkspaceOut

router = APIRouter(tags=["workspaces"])

router.add_api_route(
    "/workspaces", c.list_workspaces, methods=["GET"], response_model=list[WorkspaceOut]
)
router.add_api_route(
    "/workspaces/{workspace_id}", c.get_workspace, methods=["GET"], response_model=WorkspaceOut
)
router.add_api_route(
    "/workspaces/{workspace_id}", c.put_workspace, methods=["PUT"], response_model=WorkspaceOut
)
router.add_api_route(
    "/workspaces/{workspace_id}", c.delete_workspace, methods=["DELETE"], response_model=Ok
)
