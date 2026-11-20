from fastapi import Request

from app.schemas.scenario import ScenarioRequest, ScenarioResponse
from app.services.scenario_analysis_service import analyze


async def analyze_scenario(body: ScenarioRequest, request: Request) -> ScenarioResponse:
    return await analyze(request.app.state.llm, body)
