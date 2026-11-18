from fastapi import APIRouter

from app.controllers import project_controller as c
from app.schemas.project import Me, Ok, Project

router = APIRouter(tags=["projects"])

router.add_api_route("/projects", c.create_project, methods=["POST"], response_model=Project)
router.add_api_route(
    "/projects/{project_id}", c.get_project, methods=["GET"], response_model=Project
)
router.add_api_route(
    "/projects/{project_id}", c.update_project, methods=["PATCH"], response_model=Project
)
router.add_api_route(
    "/projects/{project_id}", c.delete_project, methods=["DELETE"], response_model=Ok
)
router.add_api_route("/me", c.me, methods=["GET"], response_model=Me)
