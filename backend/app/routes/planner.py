from fastapi import APIRouter

from app.controllers import planner_controller
from app.schemas.location_suggest import LocationSuggestResponse
from app.schemas.scene_suggest import SceneSuggestResponse
from app.schemas.weather import WeatherDay

router = APIRouter(prefix="/planner", tags=["planner"])

router.add_api_route(
    "/locations/suggest",
    planner_controller.suggest_locations,
    methods=["POST"],
    response_model=LocationSuggestResponse,
)
router.add_api_route(
    "/scenes/suggest",
    planner_controller.suggest_scenes,
    methods=["POST"],
    response_model=SceneSuggestResponse,
)
router.add_api_route(
    "/weather",
    planner_controller.get_weather,
    methods=["GET"],
    response_model=list[WeatherDay],
)
