"""Lieux proposés pour un décor : le LLM propose des TYPES de lieux, la recherche géographique
trouve de vrais lieux. Aucun lieu de la réponse ne vient du LLM."""

import structlog
from pydantic import ValidationError

from app.core.errors import AppError
from app.schemas.location_suggest import (
    LocationSuggestRequest,
    LocationSuggestResponse,
    PropositionWithCandidates,
)
from app.services.llm_service import LLMService, LLMUnavailable
from app.services.places_service import PlacesService

log = structlog.get_logger()

MAX_PROPOSITIONS = 3


async def suggest_locations(
    llm: LLMService, places: PlacesService, body: LocationSuggestRequest
) -> LocationSuggestResponse:
    try:
        suggestion = await llm.suggest_locations(body)
    except LLMUnavailable as exc:
        raise AppError(
            "Les propositions de lieux sont indisponibles pour le moment. "
            "Tu peux remplir le lieu à la main.",
            status_code=503,
            code="llm_unavailable",
        ) from exc
    except ValidationError as exc:
        raise AppError(
            "Le modèle n'a pas produit de propositions valides. Réessaie.",
            status_code=502,
            code="invalid_model_output",
        ) from exc

    if not suggestion.propositions:
        raise AppError(
            "Le modèle n'a pas produit de propositions valides. Réessaie.",
            status_code=502,
            code="invalid_model_output",
        )

    propositions: list[PropositionWithCandidates] = []
    for p in suggestion.propositions[:MAX_PROPOSITIONS]:
        # Recherches l'une après l'autre : le service respecte 1 requête par seconde
        candidates = await places.search(p.requete_recherche, body.film.city)
        propositions.append(PropositionWithCandidates(**p.model_dump(), candidates=candidates))

    log.info(
        "location_suggest",
        propositions=len(propositions),
        candidates=sum(len(p.candidates) for p in propositions),
    )
    return LocationSuggestResponse(
        decor=body.decor.name,
        besoins=suggestion.besoins,
        propositions=propositions,
        mutualisation=suggestion.mutualisation or None,
        model=llm.model,
    )
