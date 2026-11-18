import uuid
from datetime import UTC, datetime

from app.core.errors import AppError
from app.schemas.shot_spec import Motion, ShotSpec, ShotSpecRequest
from app.services import moving_plan_service, rules_service, static_plan_service
from app.services.calibration import CALIBRATION_VERSION
from app.services.llm_service import LLMService


async def create_shot_spec(llm: LLMService, request: ShotSpecRequest) -> ShotSpec:
    """Un seul plan par scène. Deux chemins, avec chacun son prompt : plan en mouvement (une prise
    décrite par des passages en secondes) ou plan fixe (un cadrage)."""
    rules = rules_service.select_rules()  # point d'extension RAG : aujourd'hui, toutes les règles
    if not rules:
        raise AppError("Base de règles indisponible.", status_code=503, code="rules_unavailable")
    by_id = {r.id: r for r in rules}
    rules_text = rules_service.format_for_prompt(rules)

    scene_id = request.scene_id or uuid.uuid4().hex[:12]
    shot_id = f"{scene_id}-a"
    builder = (
        moving_plan_service.build_shot
        if request.motion == Motion.moving
        else static_plan_service.build_shot
    )
    shot = await builder(llm, request, rules_text, by_id, shot_id)
    return ShotSpec(
        scene_id=scene_id,
        calibration=CALIBRATION_VERSION,
        model=llm.model,
        generated_at=datetime.now(UTC),
        shots=[shot],
    )
