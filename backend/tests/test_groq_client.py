import json

import httpx
import pytest
from pydantic import BaseModel

from app.services import groq_client
from app.services.errors import LLMUnavailable
from app.services.groq_client import groq_structured, wait_seconds


class Out(BaseModel):
    title: str


RATE_LIMIT_400 = {
    "error": {
        "message": "Rate limit reached for model `openai/gpt-oss-20b` in organization "
        "`org_secret` service tier `on_demand` on tokens per minute (TPM): Limit 8000, "
        "Used 4219, Requested 3894. Please try again in 847.5ms. Need more tokens? Upgrade.",
        "type": "tokens",
        "code": "rate_limit_exceeded",
    }
}


def ok(content: str = '{"title": "Scène 1"}', finish: str = "stop") -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "choices": [{"message": {"content": content}, "finish_reason": finish}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        },
    )


@pytest.fixture
def groq(monkeypatch):
    """Fait répondre Groq par une suite de réponses ; enregistre les requêtes et les attentes."""
    state = {"responses": [], "requests": [], "sleeps": []}
    real_client = httpx.AsyncClient

    def handler(request):
        state["requests"].append(json.loads(request.content))
        return state["responses"].pop(0)

    async def fake_sleep(s):
        state["sleeps"].append(s)

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
    )
    monkeypatch.setattr(groq_client.asyncio, "sleep", fake_sleep)
    return state


async def call(model: str = "openai/gpt-oss-20b") -> Out:
    return await groq_structured(
        api_key="k",
        model=model,
        timeout=5,
        max_completion_tokens=4000,
        system="s",
        user="u",
        output_format=Out,
    )


@pytest.mark.asyncio
async def test_sends_reasoning_effort_and_output_cap(groq):
    groq["responses"] = [ok()]
    assert (await call()).title == "Scène 1"
    body = groq["requests"][0]
    assert body["reasoning_effort"] == "low"
    assert body["max_completion_tokens"] == 4000
    assert body["response_format"]["type"] == "json_schema"


@pytest.mark.asyncio
async def test_no_reasoning_effort_for_other_models(groq):
    groq["responses"] = [ok()]
    await call(model="llama-3.3-70b-versatile")
    assert "reasoning_effort" not in groq["requests"][0]


@pytest.mark.asyncio
async def test_waits_and_retries_on_rate_limit(groq):
    groq["responses"] = [httpx.Response(400, json=RATE_LIMIT_400), ok()]
    assert (await call()).title == "Scène 1"
    assert len(groq["requests"]) == 2
    assert groq["sleeps"] and groq["sleeps"][0] == pytest.approx(0.8475 + 0.25)


@pytest.mark.asyncio
async def test_gives_up_when_wait_is_too_long(groq):
    body = {"error": {"message": "Rate limit reached. Please try again in 7m12s.", "code": "x"}}
    groq["responses"] = [httpx.Response(429, json=body)]
    with pytest.raises(LLMUnavailable, match="quota Groq atteint"):
        await call()
    assert groq["sleeps"] == []


@pytest.mark.asyncio
async def test_gives_up_after_max_attempts(groq):
    groq["responses"] = [
        httpx.Response(400, json=RATE_LIMIT_400) for _ in range(groq_client.MAX_ATTEMPTS)
    ]
    with pytest.raises(LLMUnavailable) as exc:
        await call()
    # La raison de Groq est donnée, sans l'identifiant d'organisation
    assert "Limit 8000" in str(exc.value)
    assert "org_secret" not in str(exc.value)


@pytest.mark.asyncio
async def test_truncated_answer_is_reported(groq):
    groq["responses"] = [ok('{"title": "Sc', finish="length")]
    with pytest.raises(LLMUnavailable, match="coupée"):
        await call()


@pytest.mark.asyncio
async def test_wrong_format_is_reported(groq):
    groq["responses"] = [ok('{"other": 1}')]
    with pytest.raises(LLMUnavailable, match="format inattendu"):
        await call()


@pytest.mark.asyncio
async def test_request_too_large(groq):
    body = {"error": {"message": "Request too large: Limit 8000, Requested 15000"}}
    groq["responses"] = [httpx.Response(413, json=body)]
    with pytest.raises(LLMUnavailable, match="texte trop long"):
        await call()


@pytest.mark.asyncio
async def test_refusal_includes_groq_reason(groq):
    groq["responses"] = [httpx.Response(401, json={"error": {"message": "Invalid API Key"}})]
    with pytest.raises(LLMUnavailable, match="Invalid API Key"):
        await call()


class Inner(BaseModel):
    name: str
    note: str | None = None


class Nested(BaseModel):
    items: list[Inner]
    count: int = 0


def test_strict_schema_closes_every_object():
    schema = groq_client.strict_schema(Nested.model_json_schema())
    assert schema["additionalProperties"] is False
    assert schema["required"] == ["items", "count"]
    inner = schema["$defs"]["Inner"]
    assert inner["additionalProperties"] is False
    assert inner["required"] == ["name", "note"]


@pytest.mark.asyncio
async def test_strict_mode_for_gpt_oss(groq):
    groq["responses"] = [ok()]
    await call()
    js = groq["requests"][0]["response_format"]["json_schema"]
    assert js["strict"] is True
    assert js["schema"]["additionalProperties"] is False


@pytest.mark.asyncio
async def test_non_strict_for_other_models(groq):
    groq["responses"] = [ok()]
    await call(model="llama-3.3-70b-versatile")
    js = groq["requests"][0]["response_format"]["json_schema"]
    assert js["strict"] is False
    assert js["schema"] == Out.model_json_schema()


@pytest.mark.asyncio
async def test_falls_back_to_non_strict_when_schema_rejected(groq):
    rejected = {"error": {"message": "invalid JSON schema for response_format: 'Out'"}}
    groq["responses"] = [httpx.Response(400, json=rejected), ok()]
    assert (await call()).title == "Scène 1"
    assert groq["requests"][0]["response_format"]["json_schema"]["strict"] is True
    assert groq["requests"][1]["response_format"]["json_schema"]["strict"] is False


@pytest.mark.asyncio
async def test_strict_generation_cut_short(groq):
    body = {
        "error": {
            "message": "Failed to generate JSON.",
            "code": "json_validate_failed",
            "failed_generation": "max completion tokens reached before generating a valid document",
        }
    }
    groq["responses"] = [httpx.Response(400, json=body)]
    with pytest.raises(LLMUnavailable, match="coupée"):
        await call()


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Please try again in 847.5ms.", 0.8475),
        ("Please try again in 4.1s.", 4.1),
        ("Please try again in 1m2.5s.", 62.5),
        ("Please try again in 7m12s.", 432),
        ("no hint here", None),
    ],
)
def test_wait_seconds(text, expected):
    r = httpx.Response(429, text=text)
    got = wait_seconds(r)
    assert got == (pytest.approx(expected) if expected is not None else None)


def _scene(n: int, names: list[str]) -> dict:
    return {
        "number": n,
        "heading": f"INT. LIEU {n} - JOUR",
        "setting": "INT",
        "time_of_day": "DAY",
        "location": "Lieu",
        "summary": "Résumé.",
        "characters": names,
        "props": [],
        "technical_requirements": [],
        "production_challenges": [],
        "missing_information": [],
        "inferences": [],
        "suggestions": [],
    }


def _char(name: str, scenes: list[int]) -> dict:
    return {"name": name, "description": "d", "scenes": scenes, "production_observations": []}


def test_repair_references_makes_model_answer_valid():
    from app.schemas.scenario import ScenarioAnalysis, repair_references

    # Réponse réelle de gpt-oss-120b, simplifiée : apparitions fausses, « Amira (jeune) » absente
    raw = {
        "scenes": [
            _scene(1, ["Amira", "Slim"]),
            _scene(2, ["Mère", "Nour"]),
            _scene(3, ["Amira (jeune)", "Amira"]),
        ],
        "characters": [
            _char("Amira", [1, 2, 3]),
            _char("Slim", [1, 3]),
            _char("Mère", [2]),
            _char("Nour", [2, 3]),
            _char("Fantôme", [9]),
        ],
    }
    with pytest.raises(ValueError):
        ScenarioAnalysis.model_validate(raw)
    fixed = ScenarioAnalysis.model_validate(repair_references(raw))
    apps = {c.name: c.scenes for c in fixed.characters}
    assert apps == {"Amira": [1, 3], "Slim": [1], "Mère": [2], "Nour": [2]}
    assert fixed.scenes[2].characters == ["Amira"]  # « Amira (jeune) » rattachée, sans doublon


def test_repair_references_adds_unknown_speaker():
    from app.schemas.scenario import ScenarioAnalysis, repair_references

    raw = {"scenes": [_scene(1, ["Yacine"])], "characters": []}
    fixed = ScenarioAnalysis.model_validate(repair_references(raw))
    assert [(c.name, c.scenes) for c in fixed.characters] == [("Yacine", [1])]


@pytest.mark.asyncio
async def test_repair_is_applied_before_validation(groq):
    groq["responses"] = [ok('{"title": "  brut  "}')]
    res = await groq_structured(
        api_key="k",
        model="openai/gpt-oss-20b",
        timeout=5,
        max_completion_tokens=100,
        system="s",
        user="u",
        output_format=Out,
        repair=lambda d: {"title": d["title"].strip()},
    )
    assert res.title == "brut"


def test_repair_analysis_maps_out_of_range_values_to_unknown():
    from app.schemas.scenario import ScenarioAnalysis, repair_analysis

    s1 = _scene(1, ["Slim"])
    s1["setting"] = "INT/EXT"  # réponse réelle de gpt-oss
    s2 = _scene(2, ["Slim"])
    s2["time_of_day"] = "CRESC"
    del s2["props"]
    raw = {"scenes": [s1, s2], "characters": [_char("Slim", [1])]}
    fixed = ScenarioAnalysis.model_validate(repair_analysis(raw))
    assert fixed.scenes[0].setting == "UNKNOWN"
    assert fixed.scenes[1].time_of_day == "UNKNOWN"
    assert fixed.scenes[1].props == []
    assert fixed.characters[0].scenes == [1, 2]


def test_repair_analysis_keeps_order_check():
    from app.schemas.scenario import ScenarioAnalysis, repair_analysis

    raw = {"scenes": [_scene(2, ["A"]), _scene(1, ["A"])], "characters": []}
    with pytest.raises(ValueError):
        ScenarioAnalysis.model_validate(repair_analysis(raw))


@pytest.mark.asyncio
async def test_strict_can_be_turned_off(groq):
    groq["responses"] = [ok()]
    await groq_structured(
        api_key="k",
        model="openai/gpt-oss-120b",
        timeout=5,
        max_completion_tokens=100,
        system="s",
        user="u",
        output_format=Out,
        strict=False,
    )
    assert groq["requests"][0]["response_format"]["json_schema"]["strict"] is False


@pytest.mark.asyncio
async def test_suggestions_use_groq_without_anthropic_key(groq):
    from app.core.config import Settings
    from app.schemas.scene_suggest import SceneSuggestRequest
    from app.services.llm_service import LLMService

    groq["responses"] = [ok('{"suggestions": []}')]
    svc = LLMService(Settings(anthropic_api_key="", groq_api_key="k"))
    req = SceneSuggestRequest.model_validate(
        {
            "film": {"title": "T", "format": "court", "city": "Tunis"},
            "decors": [],
            "scenes": [
                {
                    "number": "1",
                    "setting": "INT",
                    "moment": "jour",
                    "decor": "Café",
                    "title": "Café",
                    "characters": [],
                    "estimated_hours": 1,
                    "summary": "Yacine entre.",
                }
            ],
        }
    )
    res = await svc.suggest_scenes(req)
    assert res.suggestions == []
    assert groq["requests"][0]["model"] == "openai/gpt-oss-120b"
    assert svc.model == "openai/gpt-oss-120b"
