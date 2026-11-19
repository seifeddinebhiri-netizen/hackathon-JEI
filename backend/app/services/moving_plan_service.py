"""PLAN EN MOUVEMENT : une prise décrite par des passages (en secondes), chacun avec ses cibles."""

import structlog

from app.core.errors import AppError
from app.schemas.rule import Rule
from app.schemas.shot_spec import (
    LLMMovingPlan,
    LLMSegment,
    Shot,
    ShotIntent,
    ShotSpecRequest,
    Timeline,
    TimelineSegment,
)
from app.services.calibration import compute_targets
from app.services.llm_service import LLMService, LLMUnavailable
from app.services.plan_common import cites_known_rules, rules_for

log = structlog.get_logger()
MAX_ATTEMPTS = 2
MAX_SEGMENTS = 8
MIN_SEGMENT_S = 0.5


def normalize_segments(segments: list[LLMSegment], duration_s: float) -> list[LLMSegment] | None:
    """Rend les passages consécutifs, de 0 à `duration_s`. None si le plan est inexploitable.

    Le modèle peut se tromper de quelques dixièmes de seconde : on recolle les passages bout à bout
    (début = fin du précédent) et on fait finir le dernier à la durée demandée. On refuse un passage
    trop court ou des fins qui ne se suivent pas. Un « cadrage final » identique au début est retiré.
    """
    if not 1 <= len(segments) <= MAX_SEGMENTS:
        return None
    ordered = sorted(segments, key=lambda s: (s.start_s, s.end_s))
    result: list[LLMSegment] = []
    cursor = 0.0
    for i, seg in enumerate(ordered):
        end = duration_s if i == len(ordered) - 1 else min(seg.end_s, duration_s)
        if end - cursor < MIN_SEGMENT_S:
            return None
        at_end = None if seg.at_end == seg.at_start else seg.at_end
        result.append(
            seg.model_copy(
                update={"start_s": round(cursor, 1), "end_s": round(end, 1), "at_end": at_end}
            )
        )
        cursor = end
    return result


def _timeline(plan: LLMMovingPlan, segments: list[LLMSegment], duration_s: float, shot_id: str):
    return Timeline(
        duration_s=duration_s,
        how_fr=plan.how_fr.strip(),
        segments=[
            TimelineSegment(
                id=f"{shot_id}-s{i + 1}",
                start_s=seg.start_s,
                end_s=seg.end_s,
                description_fr=seg.description_fr.strip(),
                at_start=seg.at_start,
                at_end=seg.at_end,
                targets_start=compute_targets(seg.at_start),
                targets_end=compute_targets(seg.at_end) if seg.at_end else None,
            )
            for i, seg in enumerate(segments)
        ],
    )


async def build_shot(
    llm: LLMService, request: ShotSpecRequest, rules_text: str, by_id: dict[str, Rule], shot_id: str
) -> Shot:
    assert request.duration_s is not None  # garanti par la validation de la requête
    duration_s = request.duration_s
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            plan = await llm.generate_moving(rules_text, request)
        except LLMUnavailable as exc:
            raise AppError(str(exc), status_code=503, code="llm_unavailable") from exc
        segments = normalize_segments(plan.segments, duration_s)
        if (
            segments is None
            or not plan.how_fr.strip()
            or not cites_known_rules(plan.rule_ids, by_id)
        ):
            log.warning("llm_moving_rejected", attempt=attempt, segments=len(plan.segments))
            continue
        timeline = _timeline(plan, segments, duration_s, shot_id)
        first = timeline.segments[0]
        intent = ShotIntent(
            **first.at_start.model_dump(),
            label_fr=plan.label_fr,
            why_fr=plan.why_fr,
            rule_ids=plan.rule_ids,
            advice_fr=plan.advice_fr,
        )
        return Shot(
            id=shot_id,
            intent=intent,
            targets=first.targets_start,
            rules=rules_for(plan.rule_ids, by_id),
            timeline=timeline,
        )
    raise AppError(
        "Le modèle n'a pas produit un plan valide. Réessayez.",
        status_code=502,
        code="invalid_model_output",
    )
