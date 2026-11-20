from fastapi import APIRouter

from app.controllers import screenplay_controller
from app.schemas.screenplay import ParseScreenplayResult

router = APIRouter(prefix="/planner", tags=["planner"])

router.add_api_route(
    "/parse",
    screenplay_controller.parse,
    methods=["POST"],
    response_model=ParseScreenplayResult,
    summary="Découpe un scénario en scènes et extrait personnages et lieux",
)
