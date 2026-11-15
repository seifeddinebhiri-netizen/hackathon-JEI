from fastapi import APIRouter

from app.controllers import planner_controller
from app.schemas.location_suggest import LocationSuggestResponse

router = APIRouter(prefix="/planner", tags=["planner"])

router.add_api_route(
    "/locations/suggest",
    planner_controller.suggest_locations,
    methods=["POST"],
    response_model=LocationSuggestResponse,
)
