from unittest.mock import AsyncMock

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import AppError
from app.schemas.scenario import ScenarioAnalysis
from app.schemas.scouting import Interpretation
from app.services.llm_service import LLMService
from app.services.ollama_service import OllamaService
from tests.test_scenario import fixture


@pytest.mark.asyncio
async def test_scenario_provider_ollama_preserves_existing_schema_without_anthropic_key():
    service = LLMService(Settings(scenario_provider="ollama", anthropic_api_key=""))
    output = ScenarioAnalysis.model_validate(fixture())
    service._ollama.structured = AsyncMock(return_value=output)
    result = await service.analyze_scenario("INT. CAFÉ - JOUR\nUn personnage entre.")
    assert result == output
    assert service._ollama.structured.call_args.args[0] is ScenarioAnalysis


@pytest.mark.asyncio
async def test_scenario_provider_groq_uses_structured_json_schema(monkeypatch):
    real_client = httpx.AsyncClient
    output = fixture()

    def handler(request):
        import json

        payload = json.loads(request.content)
        assert payload["response_format"]["type"] == "json_schema"
        assert payload["response_format"]["json_schema"]["schema"] == ScenarioAnalysis.model_json_schema()
        assert request.headers["authorization"] == "Bearer test-groq-key"
        assert payload["model"] == "test-model"
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": json.dumps(output)}}]},
        )

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    service = LLMService(
        Settings(
            scenario_provider="groq",
            groq_api_key="test-groq-key",
            groq_scenario_model="test-model",
        )
    )
    result = await service.analyze_scenario("INT. CAFÉ - JOUR\nYacine entre.")
    assert result == ScenarioAnalysis.model_validate(output)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "kind,status", [("valid", 200), ("malformed", 502), ("offline", 503), ("truncated", 502)]
)
async def test_ollama_structured_http_contract(monkeypatch, kind, status):
    real_client = httpx.AsyncClient

    def handler(request):
        import json

        payload = json.loads(request.content)
        assert payload["format"] == Interpretation.model_json_schema()
        assert payload["stream"] is False
        if kind == "offline":
            raise httpx.ConnectError("sensitive provider details", request=request)
        return httpx.Response(
            200,
            json={
                "done": True,
                "done_reason": "length" if kind == "truncated" else "stop",
                "message": {
                    "content": "not json"
                    if kind == "malformed"
                    else json.dumps(
                        {
                            "category": "cafe",
                            "keywords": ["café"],
                            "explanation": "Le décor est un café.",
                        }
                    )
                },
            },
        )

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    adapter = OllamaService(Settings())
    if status == 200:
        result = await adapter.structured(
            Interpretation, "Interprète le décor.", {"scene": "INT. CAFÉ"}
        )
        assert result.category == "cafe"
    else:
        with pytest.raises(AppError) as exc:
            await adapter.structured(Interpretation, "Interprète le décor.", {"scene": "INT. CAFÉ"})
        assert exc.value.status_code == status
        assert "sensitive provider details" not in exc.value.message
