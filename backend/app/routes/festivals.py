from fastapi import APIRouter

from app.controllers import festival_controller
from app.schemas.festival import Festival, FestivalMatch

router = APIRouter(prefix="/festivals", tags=["festivals"])

router.add_api_route(
    "", festival_controller.search_festivals, methods=["GET"], response_model=list[FestivalMatch]
)
router.add_api_route(
    "/match",
    festival_controller.match_festivals,
    methods=["POST"],
    response_model=list[FestivalMatch],
)
router.add_api_route(
    "/{festival_id}", festival_controller.get_festival, methods=["GET"], response_model=Festival
)
