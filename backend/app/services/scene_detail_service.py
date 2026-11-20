"""Fiche de tournage d'une scène : le LLM lit le texte de la scène, le serveur nettoie."""

import structlog
from pydantic import ValidationError

from app.core.errors import AppError
from app.schemas.scene_detail import LLMSceneDetail, SceneDetail, SceneDetailRequest
from app.services.llm_service import LLMService, LLMUnavailable

log = structlog.get_logger()

MAX_ITEMS = 12


def _items(values: list[str]) -> list[str]:
    """Éléments non vides, sans doublon (à la casse près), 12 au plus."""
    seen: set[str] = set()
    out: list[str] = []
    for v in values:
        v = v.strip().rstrip(".")
        if v and v.casefold() not in seen and v.casefold() not in {"aucun", "non précisé"}:
            seen.add(v.casefold())
            out.append(v)
    return out[:MAX_ITEMS]


def _clean(raw: LLMSceneDetail) -> LLMSceneDetail:
    return raw.model_copy(
        update={
            "what_happens": raw.what_happens.strip(),
            "on_screen": raw.on_screen.strip(),
            "extras": raw.extras.strip(),
            "props": _items(raw.props),
            "costumes": _items(raw.costumes),
            "sound": _items(raw.sound),
            "special": _items(raw.special),
            "watch_out": _items(raw.watch_out)[:4],
        }
    )


async def detail_scene(llm: LLMService, body: SceneDetailRequest) -> SceneDetail:
    try:
        raw = await llm.detail_scene(body)
    except LLMUnavailable as exc:
        raise AppError(
            "La fiche de la scène est indisponible pour le moment. Réessaie dans un instant.",
            status_code=503,
            code="llm_unavailable",
        ) from exc
    except ValidationError as exc:
        raise AppError(
            "Le modèle n'a pas produit de fiche valide. Réessaie.",
            status_code=502,
            code="invalid_model_output",
        ) from exc
    detail = _clean(raw)
    if not detail.what_happens:
        raise AppError(
            "Le modèle n'a pas produit de fiche valide. Réessaie.",
            status_code=502,
            code="invalid_model_output",
        )
    # Jamais le texte de la scène dans les journaux : seulement des compteurs.
    log.info(
        "scene_detail",
        props=len(detail.props),
        special=len(detail.special),
        watch_out=len(detail.watch_out),
    )
    return SceneDetail(**detail.model_dump(), model=llm.suggest_model)
