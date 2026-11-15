from fastapi import APIRouter

from app.controllers import shot_spec_controller
from app.schemas.shot_spec import ShotSpec

router = APIRouter(tags=["shot-spec"])

router.add_api_route(
    "/shot-spec", shot_spec_controller.create_shot_spec, methods=["POST"], response_model=ShotSpec
)
