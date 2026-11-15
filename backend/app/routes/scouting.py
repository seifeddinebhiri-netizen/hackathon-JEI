import asyncio
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from app.controllers.scouting_controller import scouting_service
from app.core.errors import AppError
from app.schemas.scouting import (
    Category,
    Evaluation,
    EvaluationRequest,
    Interpretation,
    SceneInput,
    SearchResult,
    Weather,
)
from app.services.scouting_service import ScoutingService

router = APIRouter(tags=["scouting"])
Service = Annotated[ScoutingService, Depends(scouting_service)]


async def bounded(operation, seconds=45):
    try:
        async with asyncio.timeout(seconds):
            return await operation
    except TimeoutError:
        raise AppError(
            "Repérage trop long. Réessaie avec moins de lieux.", 504, "scouting_timeout"
        ) from None


@router.get("/locations/search", response_model=SearchResult)
async def search(
    service: Service,
    region: Annotated[str, Query(min_length=2, max_length=200)],
    category: Category = "cafe",
    radius_km: Annotated[int, Query(ge=1, le=30)] = 10,
):
    if not region.strip():
        raise AppError("Indique une région.", 422, "invalid_region")
    return await bounded(service.search(region.strip(), category, radius_km))


@router.get("/locations/{location_id}/weather", response_model=Weather)
async def weather(
    service: Service, location_id: Annotated[str, Path(pattern="^[a-f0-9]{24}$")], date: date
):
    return await bounded(service.weather(location_id, date))


@router.post("/locations/interpret-scene", response_model=Interpretation)
async def interpret(body: SceneInput, service: Service):
    return await bounded(service.interpret(body.text), 80)


@router.post("/planning/evaluate-location", response_model=list[Evaluation])
async def evaluate(body: EvaluationRequest, service: Service):
    return await bounded(service.evaluate(body), 110)
