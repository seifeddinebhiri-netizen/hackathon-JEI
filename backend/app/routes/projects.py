from fastapi import APIRouter

from app.controllers import project_controller

router = APIRouter(prefix="/projects", tags=["projects"])

router.add_api_route("", project_controller.create_project, methods=["POST"], status_code=201)
router.add_api_route("/{project_id}", project_controller.get_project, methods=["GET"])
router.add_api_route("/{project_id}", project_controller.update_project, methods=["PATCH"])
router.add_api_route("/{project_id}", project_controller.delete_project, methods=["DELETE"])
