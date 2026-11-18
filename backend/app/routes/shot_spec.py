from fastapi import APIRouter, Depends

from app.controllers import shot_spec_controller
from app.core.rate_limit import limit_shot_spec
from app.schemas.shot_spec import ShotSpec

router = APIRouter(tags=["shot-spec"])

router.add_api_route(
    "/shot-spec",
    shot_spec_controller.create_shot_spec,
    methods=["POST"],
    response_model=ShotSpec,
    dependencies=[Depends(limit_shot_spec)],  # exige un jeton valide puis limite le débit
)
