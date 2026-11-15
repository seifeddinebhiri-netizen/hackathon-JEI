from fastapi import Request

from app.schemas.location_suggest import LocationSuggestRequest, LocationSuggestResponse
from app.services import location_suggest_service
from app.services.places_service import PlacesService


def _places(request: Request) -> PlacesService:
    """Service de recherche de lieux, créé à la première utilisation (cache et cadence partagés)."""
    places = getattr(request.app.state, "places", None)
    if places is None:
        places = PlacesService()
        request.app.state.places = places
    return places


async def suggest_locations(
    body: LocationSuggestRequest, request: Request
) -> LocationSuggestResponse:
    return await location_suggest_service.suggest_locations(
        request.app.state.llm, _places(request), body
    )
