"""PLAN FIXE : un seul plan, un seul cadrage à viser."""

import structlog

from app.core.errors import AppError
from app.schemas.rule import Rule
from app.schemas.shot_spec import Movement, Shot, ShotSpecRequest
from app.services.calibration import compute_targets
from app.services.llm_service import LLMService, LLMUnavailable
from app.services.plan_common import cites_known_rules, rules_for

log = structlog.get_logger()
MAX_ATTEMPTS = 2


async def build_shot(
    llm: LLMService, request: ShotSpecRequest, rules_text: str, by_id: dict[str, Rule], shot_id: str
) -> Shot:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            plan = await llm.generate_static(rules_text, request)
        except LLMUnavailable as exc:
            raise AppError(str(exc), status_code=503, code="llm_unavailable") from exc
        if not cites_known_rules(plan.shot.rule_ids, by_id):
            log.warning("llm_static_rejected", attempt=attempt, rule_ids=plan.shot.rule_ids)
            continue
        intent = plan.shot.model_copy(update={"movement": Movement.static})  # plan fixe
        return Shot(
            id=shot_id,
            intent=intent,
            targets=compute_targets(intent),
            rules=rules_for(intent.rule_ids, by_id),
        )
    raise AppError(
        "Le modèle n'a pas produit un plan valide. Réessayez.",
        status_code=502,
        code="invalid_model_output",
    )
