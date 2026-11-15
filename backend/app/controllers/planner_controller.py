from datetime import date
from typing import Annotated

from fastapi import Query, Request

from app.core.config import get_settings
from app.core.errors import AppError
from app.schemas.location_suggest import LocationSuggestRequest, LocationSuggestResponse
from app.schemas.scene_suggest import SceneSuggestRequest, SceneSuggestResponse
from app.schemas.weather import WeatherDay
from app.services import location_suggest_service, scene_suggest_service
from app.services.places_service import PlacesService
from app.services.weather_service import WeatherService

MAX_WEATHER_DAYS = 120


def _places(request: Request) -> PlacesService:
    """Service de recherche de lieux, créé à la première utilisation (cache et cadence partagés)."""
    places = getattr(request.app.state, "places", None)
    if places is None:
        places = PlacesService()
        request.app.state.places = places
    return places


def _weather(request: Request) -> WeatherService:
    """Service météo, créé à la première utilisation (cache partagé)."""
    weather = getattr(request.app.state, "weather", None)
    if weather is None:
        weather = WeatherService(get_settings())
        request.app.state.weather = weather
    return weather


async def suggest_locations(
    body: LocationSuggestRequest, request: Request
) -> LocationSuggestResponse:
    return await location_suggest_service.suggest_locations(
        request.app.state.llm, _places(request), body
    )


async def suggest_scenes(body: SceneSuggestRequest, request: Request) -> SceneSuggestResponse:
    return await scene_suggest_service.suggest_scenes(request.app.state.llm, body)


async def get_weather(
    request: Request,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lon: Annotated[float, Query(ge=-180, le=180)],
    from_: Annotated[date, Query(alias="from")],
    to: date,
) -> list[WeatherDay]:
    if to < from_:
        raise AppError("La date de fin précède la date de début.", 422, "invalid_range")
    if (to - from_).days >= MAX_WEATHER_DAYS:
        raise AppError(
            "La période demandée est trop longue (120 jours au plus).", 422, "invalid_range"
        )
    return await _weather(request).days(lat, lon, from_, to)
