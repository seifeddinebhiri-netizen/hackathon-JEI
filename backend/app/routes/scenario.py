from fastapi import APIRouter

from app.controllers.scenario_controller import analyze_scenario
from app.schemas.scenario import ScenarioResponse

router = APIRouter(tags=["scenarios"])
router.add_api_route(
    "/scenarios/analyze", analyze_scenario, methods=["POST"], response_model=ScenarioResponse
)
