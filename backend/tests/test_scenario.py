from copy import deepcopy
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app
from app.schemas.scenario import ScenarioAnalysis
from app.services.llm_service import LLMService, LLMUnavailable


def fixture():
    scenes = [
        {
            "number": n,
            "heading": f"INT. CAFÉ - JOUR {n}",
            "setting": "INT",
            "time_of_day": "DAY",
            "location": "Café",
            "summary": "Yacine entre.",
            "characters": ["YACINE"],
            "props": [],
            "technical_requirements": [],
            "production_challenges": [],
            "missing_information": [],
            "inferences": [],
            "suggestions": [],
        }
        for n in (1, 2)
    ]
    return {
        "scenes": scenes,
        "characters": [
            {"name": "YACINE", "description": "", "scenes": [1, 2], "production_observations": []}
        ],
    }


BODY = {"title": "Le premier jour", "content": "INT. CAFÉ - JOUR\nYacine entre dans le café.\n" * 2}


def post(output, body=None):
    llm = MagicMock(scenario_timeout_seconds=1)
    llm.analyze_scenario = AsyncMock(
        side_effect=output if isinstance(output, Exception) else None, return_value=output
    )
    with TestClient(app) as client:
        app.state.llm = llm
        response = client.post("/scenarios/analyze", json=BODY if body is None else body)
    return response, llm


def test_multiscene_analysis_preserves_order_and_characters():
    response, llm = post(fixture())
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == BODY["title"]
    assert data["simulated"] is False
    assert [s["number"] for s in data["scenes"]] == [1, 2]
    assert data["characters"][0]["scenes"] == [1, 2]
    llm.analyze_scenario.assert_awaited_once_with(BODY["content"].strip())


def test_character_names_are_canonicalized_across_scenes():
    data = fixture()
    data["scenes"][1]["characters"] = ["yacine"]
    response, _ = post(data)
    assert response.status_code == 200
    assert response.json()["scenes"][1]["characters"] == ["YACINE"]


@pytest.mark.parametrize(
    "body",
    [
        {},
        {**BODY, "content": ""},
        {**BODY, "content": " " * 40},
        {**BODY, "title": " "},
        {**BODY, "content": 7},
        {**BODY, "content": "x" * 100001},
        {**BODY, "extra": "unwanted"},
    ],
)
def test_invalid_requests_do_not_call_provider(body):
    response, llm = post(fixture(), body)
    assert response.status_code == 422
    llm.analyze_scenario.assert_not_called()


@pytest.mark.parametrize(
    "failure,status,code",
    [
        (LLMUnavailable("private details"), 503, "llm_unavailable"),
        (TimeoutError("private details"), 504, "analysis_timeout"),
        (ValueError("private details"), 502, "invalid_model_output"),
        (RuntimeError("private details"), 502, "analysis_failed"),
    ],
)
def test_provider_failures_are_safe(failure, status, code):
    response, _ = post(failure)
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert "private details" not in response.text


@pytest.mark.parametrize("kind", ["order", "duplicates", "references", "empty", "malformed"])
def test_invalid_llm_output(kind):
    data = deepcopy(fixture())
    if kind == "order":
        data["scenes"].reverse()
    elif kind == "duplicates":
        data["characters"].append({**data["characters"][0], "name": "yacine"})
    elif kind == "references":
        data["characters"][0]["scenes"] = [1]
    elif kind == "empty":
        data["scenes"] = []
    else:
        data = {"invalid": "private details"}
    response, _ = post(data)
    assert response.status_code == 502
    assert "private details" not in response.text


@pytest.mark.asyncio
async def test_missing_api_key():
    llm = LLMService(Settings(_env_file=None, scenario_provider="anthropic", anthropic_api_key=""))
    with pytest.raises(LLMUnavailable):
        await llm.analyze_scenario(BODY["content"])


@pytest.mark.asyncio
async def test_shared_sdk_uses_structured_schema_and_rejects_truncation():
    llm = LLMService(
        Settings(scenario_provider="anthropic", anthropic_api_key="test-not-a-real-key")
    )
    parse = AsyncMock(
        return_value=MagicMock(
            parsed_output=ScenarioAnalysis.model_validate(fixture()), stop_reason="end_turn"
        )
    )
    llm._client = MagicMock()
    llm._client.with_options.return_value.beta.messages.parse = parse
    assert len((await llm.analyze_scenario(BODY["content"])).scenes) == 2
    assert parse.call_args.kwargs["output_format"] is ScenarioAnalysis
    assert parse.call_args.kwargs["messages"][0]["content"] == BODY["content"]
    parse.return_value.stop_reason = "max_tokens"
    with pytest.raises(ValueError):
        await llm.analyze_scenario(BODY["content"])
