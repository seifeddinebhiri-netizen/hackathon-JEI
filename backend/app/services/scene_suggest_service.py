"""Suggestions de tournage sur les scènes : le LLM propose, le serveur filtre, l'auteur décide."""

import structlog
from pydantic import ValidationError

from app.core.errors import AppError
from app.schemas.scene_suggest import (
    LLMSceneSuggestion,
    SceneSuggestion,
    SceneSuggestRequest,
    SceneSuggestResponse,
)
from app.services.llm_service import LLMService, LLMUnavailable

log = structlog.get_logger()

MAX_SUGGESTIONS = 12


def _clean(s: LLMSceneSuggestion, req: SceneSuggestRequest) -> LLMSceneSuggestion | None:
    """Garde une suggestion seulement si elle est cohérente et applicable telle quelle.

    - les scènes citées existent (doublons retirés) ;
    - le changement correspond au type (et un seul champ `change_*` est rempli) ;
    - un regroupement vise un décor EXISTANT, différent de celui des scènes ;
    - un changement qui ne change rien est ignoré.
    """
    numbers = {sc.number: sc for sc in req.scenes}
    scene_numbers = list(dict.fromkeys(n for n in s.scene_numbers if n in numbers))
    if not scene_numbers or not s.message.strip():
        return None
    scenes = [numbers[n] for n in scene_numbers]
    setting = moment = decor = None
    if s.kind == "preciser_int_ext":
        if s.change_setting is None or all(sc.setting == s.change_setting for sc in scenes):
            return None
        setting = s.change_setting
    elif s.kind == "preciser_moment":
        if s.change_moment is None or all(sc.moment == s.change_moment for sc in scenes):
            return None
        moment = s.change_moment
    elif s.kind == "regrouper_decors":
        known = {d.casefold(): d for d in req.decors}
        target = known.get((s.change_decor or "").strip().casefold())
        if target is None or all(sc.decor.casefold() == target.casefold() for sc in scenes):
            return None
        decor = target
    return s.model_copy(
        update={
            "scene_numbers": scene_numbers,
            "change_setting": setting,
            "change_moment": moment,
            "change_decor": decor,
        }
    )


async def suggest_scenes(llm: LLMService, body: SceneSuggestRequest) -> SceneSuggestResponse:
    try:
        raw = await llm.suggest_scenes(body)
    except LLMUnavailable as exc:
        raise AppError(
            "Les suggestions de l'IA sont indisponibles pour le moment. Ton scénario reste tel quel.",
            status_code=503,
            code="llm_unavailable",
        ) from exc
    except ValidationError as exc:
        raise AppError(
            "Le modèle n'a pas produit de suggestions valides. Réessaie.",
            status_code=502,
            code="invalid_model_output",
        ) from exc

    kept = [c for c in (_clean(s, body) for s in raw.suggestions) if c is not None]
    kept = kept[:MAX_SUGGESTIONS]
    log.info("scene_suggest", proposed=len(raw.suggestions), kept=len(kept))
    return SceneSuggestResponse(
        suggestions=[
            SceneSuggestion(**s.model_dump(), id=f"sug-{i + 1}") for i, s in enumerate(kept)
        ],
        model=llm.model,
    )
