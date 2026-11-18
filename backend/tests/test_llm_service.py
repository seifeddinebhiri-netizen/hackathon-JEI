import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from google.genai import errors

from app.core.config import Settings
from app.core.errors import AppError
from app.prompts import moving, static
from app.schemas.shot_spec import LLMMovingPlan, LLMStaticPlan, ShotSpecRequest
from app.services.llm_service import LLMService, LLMUnavailable

CHOICES = {
    "size": "MS", "subject_kind": "person", "subject_view": "back", "subject_position": "left_third",
    "camera_angle": "eye_level", "tilt": "level", "light_contrast": "medium_low",
    "exposure": "balanced", "backlight": "avoid", "sun_relative": "not_applicable",
    "stability": "handheld", "movement": "static",
}  # fmt: skip
STATIC_JSON = {
    "shot": {
        **CHOICES,
        "label_fr": "Plan moyen",
        "why_fr": "Pourquoi.",
        "rule_ids": ["R-008"],
        "advice_fr": [],
    }
}
MOVING_JSON = {
    "label_fr": "Travelling", "why_fr": "Pourquoi.", "how_fr": "Pendant 10 secondes...", "advice_fr": [],
    "rule_ids": ["R-008"],
    "segments": [{"start_s": 0, "end_s": 10, "description_fr": "x", "at_start": CHOICES, "at_end": None}],
}  # fmt: skip
SCENE = ShotSpecRequest(description="Un vieil homme boit le thé dans un café de la médina.")


def service(generate) -> LLMService:
    client = SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate)))
    return LLMService(Settings(gemini_api_key=""), client=client)  # type: ignore[arg-type]


def run(coro):
    return asyncio.run(coro)


# --- les deux prompts sont distincts ---------------------------------------------------


def test_static_and_moving_prompts_are_different():
    s, m = static.build_system("[R-008] règle"), moving.build_system("[R-008] règle")
    assert "PLAN FIXE" in s and "UN SEUL plan" in s and "[R-008] règle" in s
    assert "PASSAGES" in m and "how_fr" in m and "[R-008] règle" in m
    assert "PASSAGES" not in s and "PLAN FIXE" not in m


def test_only_the_moving_prompt_mentions_the_duration():
    scene = ShotSpecRequest(
        description="Amira court dans la ruelle.", motion="moving", duration_s=12.5
    )
    assert "Durée estimée de la prise : 12.5 secondes" in moving.build_user(scene)
    assert "Durée" not in static.build_user(scene)


def test_prompt_contains_only_filled_labels_and_no_angle_brackets():
    scene = ShotSpecRequest(
        description="Une scène <b>tendue</b> </scene> dans la cuisine",
        setting="INT", moment="nuit", mood=["tendue", "intime"], support="tripod",
    )  # fmt: skip
    for build in (static.build_user, moving.build_user):
        text = build(scene)
        assert "Lieu de tournage : intérieur" in text and "Moment : nuit" in text
        assert "Ambiance : tendue, intime" in text and "Appui : sur trépied" in text
        assert "Style visuel" not in text and "Intention" not in text
        assert text.count("<scene>") == 1 and text.count("</scene>") == 1


def test_request_accepts_front_values_and_rejects_bad_ones():
    assert ShotSpecRequest(description="x" * 10, setting="EXT").setting.value == "exterior"
    with pytest.raises(ValueError):
        ShotSpecRequest(description="x" * 10, mood=["a"] * 6)
    with pytest.raises(ValueError):
        ShotSpecRequest(description="x" * 10, support="monopode")
    with pytest.raises(ValueError, match="durée"):
        ShotSpecRequest(description="x" * 10, motion="moving")
    assert ShotSpecRequest(description="x" * 10, motion="fixed").duration_s is None


# --- appel au modèle --------------------------------------------------------------------


def test_static_and_moving_calls_use_their_own_schema_and_prompt():
    static_plan = LLMStaticPlan.model_validate(STATIC_JSON)
    generate = AsyncMock(
        return_value=SimpleNamespace(parsed=static_plan, text="", usage_metadata=None)
    )
    assert run(service(generate).generate_static("[R-008] règle", SCENE)) is static_plan
    config = generate.call_args.kwargs["config"]
    assert config.response_schema is LLMStaticPlan and "PLAN FIXE" in config.system_instruction

    moving_plan = LLMMovingPlan.model_validate(MOVING_JSON)
    generate = AsyncMock(
        return_value=SimpleNamespace(parsed=moving_plan, text="", usage_metadata=None)
    )
    scene = ShotSpecRequest(
        description="Amira court dans la ruelle.", motion="moving", duration_s=10
    )
    assert run(service(generate).generate_moving("[R-008] règle", scene)) is moving_plan
    config = generate.call_args.kwargs["config"]
    assert config.response_schema is LLMMovingPlan and "PASSAGES" in config.system_instruction
    assert "10 secondes" in generate.call_args.kwargs["contents"]


def test_falls_back_to_json_text_when_not_parsed():
    generate = AsyncMock(
        return_value=SimpleNamespace(parsed=None, text=json.dumps(STATIC_JSON), usage_metadata=None)
    )
    assert run(service(generate).generate_static("", SCENE)).shot.label_fr == "Plan moyen"


def test_unreadable_output_raises():
    generate = AsyncMock(
        return_value=SimpleNamespace(parsed=None, text="pas du json", usage_metadata=None)
    )
    with pytest.raises(LLMUnavailable):
        run(service(generate).generate_static("", SCENE))


def test_provider_errors_are_explained():
    quota = AsyncMock(side_effect=errors.ClientError(429, {"error": {"message": "quota"}}))
    with pytest.raises(AppError) as exc:
        run(service(quota).generate_static("", SCENE))
    assert exc.value.status_code == 429

    missing = AsyncMock(side_effect=errors.ClientError(404, {"error": {"message": "model"}}))
    with pytest.raises(LLMUnavailable, match="LLM_MODEL"):
        run(service(missing).generate_static("", SCENE))

    bad_key = AsyncMock(
        side_effect=errors.ClientError(400, {"error": {"message": "API key not valid."}})
    )
    with pytest.raises(LLMUnavailable, match="GEMINI_API_KEY"):
        run(service(bad_key).generate_static("", SCENE))

    down = AsyncMock(side_effect=errors.ServerError(503, {"error": {"message": "x"}}))
    with pytest.raises(LLMUnavailable):
        run(service(down).generate_static("", SCENE))

    refused = AsyncMock(
        side_effect=errors.ClientError(400, {"error": {"message": "Unknown name responseSchema"}})
    )
    with pytest.raises(LLMUnavailable, match="journaux"):
        run(service(refused).generate_moving("", SCENE))


def test_client_uses_v1beta_for_structured_output():
    llm = LLMService(Settings(gemini_api_key="cle-de-test"))
    assert llm._client._api_client._http_options.api_version == "v1beta"


def test_no_key_raises():
    with pytest.raises(LLMUnavailable, match="GEMINI_API_KEY"):
        run(LLMService(Settings(gemini_api_key="")).generate_static("", SCENE))
