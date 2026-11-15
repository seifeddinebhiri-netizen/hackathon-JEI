import uuid
from datetime import UTC, datetime

import structlog

from app.core.errors import AppError
from app.schemas.rule import Rule
from app.schemas.shot_spec import (
    LLMShotSpec,
    RuleRef,
    Shot,
    ShotSpec,
    ShotSpecRequest,
)
from app.services import rules_service
from app.services.calibration import CALIBRATION_VERSION, compute_targets
from app.services.llm_service import LLMService, LLMUnavailable

log = structlog.get_logger()

MAX_ATTEMPTS = 2


def _unknown_rule_ids(spec: LLMShotSpec, known: set[str]) -> set[str]:
    cited = {rid for shot in spec.shots for rid in shot.rule_ids}
    return cited - known


def _is_valid(spec: LLMShotSpec, known: set[str]) -> bool:
    return (
        1 <= len(spec.shots) <= 4
        and all(shot.rule_ids for shot in spec.shots)
        and not _unknown_rule_ids(spec, known)
    )


def _rule_ref(rule: Rule) -> RuleRef:
    return RuleRef(
        id=rule.id,
        title_fr=rule.title_fr,
        confidence=rule.confidence.value,
        sources=[s.model_dump(mode="json") for s in rule.sources],
    )


async def create_shot_spec(llm: LLMService, request: ShotSpecRequest) -> ShotSpec:
    rules = rules_service.select_rules()  # point d'extension RAG : aujourd'hui, toutes les règles
    if not rules:
        raise AppError("Base de règles indisponible.", status_code=503, code="rules_unavailable")
    by_id = {r.id: r for r in rules}
    rules_text = rules_service.format_for_prompt(rules)

    spec: LLMShotSpec | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            candidate = await llm.generate_shots(
                rules_text, request.description, request.setting.value
            )
        except LLMUnavailable as exc:
            raise AppError(str(exc), status_code=503, code="llm_unavailable") from exc
        if _is_valid(candidate, set(by_id)):
            spec = candidate
            break
        log.warning(
            "llm_output_rejected",
            attempt=attempt,
            unknown_ids=sorted(_unknown_rule_ids(candidate, set(by_id))),
            shots=len(candidate.shots),
        )
    if spec is None:
        raise AppError(
            "Le modèle n'a pas produit une fiche valide. Réessayez.",
            status_code=502,
            code="invalid_model_output",
        )

    scene_id = request.scene_id or uuid.uuid4().hex[:12]
    shots = [
        Shot(
            id=f"{scene_id}-{chr(ord('a') + i)}",
            intent=intent,
            targets=compute_targets(intent),
            rules=[_rule_ref(by_id[rid]) for rid in dict.fromkeys(intent.rule_ids)],
        )
        for i, intent in enumerate(spec.shots)
    ]
    return ShotSpec(
        scene_id=scene_id,
        calibration=CALIBRATION_VERSION,
        model=llm.model,
        generated_at=datetime.now(UTC),
        shots=shots,
    )
