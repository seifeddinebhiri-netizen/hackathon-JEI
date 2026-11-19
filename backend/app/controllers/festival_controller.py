from datetime import date
from typing import Annotated

from fastapi import Query, Request

from app.schemas.festival import (
    AiPolicy,
    Festival,
    FestivalFilters,
    FestivalMatch,
    FestivalMatchRequest,
    FilmProfile,
)
from app.services import festival_service


async def search_festivals(
    request: Request,
    q: str | None = None,
    country: str | None = None,
    max_duration_min: Annotated[int | None, Query(ge=1)] = None,
    fee: Annotated[str | None, Query(pattern="^(gratuit|payant)$")] = None,
    deadline_before: date | None = None,
    subtitle_lang: str | None = None,
    ai_policy: AiPolicy | None = None,
    open_only: bool = False,
    film_duration_min: Annotated[int | None, Query(ge=1, le=600)] = None,
    film_language: str | None = None,
    film_genre: str | None = None,
    film_ai_departments: Annotated[int | None, Query(ge=0, le=20)] = None,
) -> list[FestivalMatch]:
    """GET /festivals : recherche + classement (contrat `searchFestivals`)."""
    filters = FestivalFilters(
        q=q,
        country=country,
        max_duration_min=max_duration_min,
        fee=fee,  # type: ignore[arg-type]
        deadline_before=deadline_before,
        subtitle_lang=subtitle_lang,
        ai_policy=ai_policy,
        open_only=open_only,
    )
    film_given = any(
        v is not None for v in (film_duration_min, film_language, film_genre, film_ai_departments)
    )
    film = (
        FilmProfile(
            duration_min=film_duration_min,
            language=film_language,
            genre=film_genre,
            declared_ai_departments=film_ai_departments or 0,
        )
        if film_given
        else None
    )
    return await festival_service.search(request.app.state.db_pool, filters, film)


async def match_festivals(body: FestivalMatchRequest, request: Request) -> list[FestivalMatch]:
    """POST /festivals/match : même résultat, le film et les filtres passent dans le corps."""
    return await festival_service.search(request.app.state.db_pool, body.filters, body.film)


async def get_festival(festival_id: str, request: Request) -> Festival:
    return await festival_service.get_festival(request.app.state.db_pool, festival_id)
