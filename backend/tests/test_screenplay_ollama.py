"""Client Ollama du découpage, testé contre un faux serveur (httpx.MockTransport)."""

import json

import httpx
import pytest

from app.core.config import Settings
from app.schemas.screenplay import LLMSegmentation
from app.services.llm_service import LLMUnavailable
from app.services.screenplay import llm as llm_module
from app.services.screenplay.enrich import segment
from app.services.screenplay.llm import ScreenplayLLM

REAL_CLIENT = httpx.AsyncClient
SEG = {"scenes": [{"start_line": 1, "setting": "INT", "place": "Cinéma", "moment": "aube"}]}


def _settings(**kw) -> Settings:
    return Settings(_env_file=None, **kw)


def _patch(monkeypatch, handler):
    def factory(*a, **kw):
        kw["transport"] = httpx.MockTransport(handler)
        return REAL_CLIENT(*a, **kw)

    monkeypatch.setattr(llm_module.httpx, "AsyncClient", factory)


def test_provider_choice():
    assert ScreenplayLLM(_settings(), env={}).provider == "ollama"
    assert ScreenplayLLM(_settings(anthropic_api_key="k"), env={}).provider == "anthropic"
    forced = ScreenplayLLM(_settings(anthropic_api_key="k"), env={"SCREENPLAY_LLM": "ollama"})
    assert forced.provider == "ollama"
    o = ScreenplayLLM(
        _settings(), env={"OLLAMA_HOST": "127.0.0.1:11434", "OLLAMA_MODEL": "qwen2.5"}
    )
    assert o._base == "http://127.0.0.1:11434" and o.model == "qwen2.5"


@pytest.mark.asyncio
async def test_ollama_auto_model_schema_and_retry(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "llama3.1:8b"}]})
        body = json.loads(request.content)
        calls.append(body)
        content = "pas du json" if len(calls) == 1 else json.dumps(SEG)
        return httpx.Response(200, json={"message": {"content": content}, "eval_count": 10})

    _patch(monkeypatch, handler)
    llm = ScreenplayLLM(_settings(), env={})
    out = await llm.parse_structured(system="s", user="u", output_format=LLMSegmentation)
    assert out.scenes[0].place == "Cinéma"
    assert len(calls) == 2  # 1re réponse invalide → nouvel essai
    assert calls[0]["model"] == "llama3.1:8b"
    assert calls[0]["format"]["title"] == "LLMSegmentation"
    assert calls[0]["options"]["temperature"] == 0 and calls[0]["stream"] is False


@pytest.mark.asyncio
async def test_ollama_down_or_missing_model(monkeypatch):
    def down(request):
        raise httpx.ConnectError("refused")

    _patch(monkeypatch, down)
    llm = ScreenplayLLM(_settings(), env={"OLLAMA_MODEL": "x"})
    with pytest.raises(LLMUnavailable, match="ne répond pas"):
        await llm.parse_structured(system="s", user="u", output_format=LLMSegmentation)

    _patch(monkeypatch, lambda r: httpx.Response(404, json={"error": "model not found"}))
    with pytest.raises(LLMUnavailable, match="introuvable"):
        await llm.parse_structured(system="s", user="u", output_format=LLMSegmentation)


class WindowLLM:
    """Faux modèle à petit contexte : renvoie une scène qui commence au début de chaque passage."""

    max_batch_chars = 60
    max_concurrency = 1

    def __init__(self):
        self.users = []

    async def parse_structured(self, *, system, user, output_format, max_tokens=0):
        self.users.append(user)
        first = int(user.split("<texte>\n")[1].split(":")[0])
        place = "Cinéma" if first < 5 else "Rue"
        return output_format.model_validate(
            {"scenes": [{"start_line": first, "setting": "INT", "place": place, "moment": "jour"}]}
        )


@pytest.mark.asyncio
async def test_long_text_is_sent_in_windows_with_global_numbers():
    units = [f"Phrase numéro {i}." for i in range(1, 9)]
    llm = WindowLLM()
    bounds = await segment(llm, units)
    assert len(llm.users) > 1
    assert "La scène en cours se passe à « Cinéma »" in llm.users[1]
    # les débuts de passage dans le même lieu ne créent pas de scène
    assert [b["place"] for b in bounds] == ["Cinéma", "Rue"]
    assert bounds[0]["start_line"] == 1


def test_gemini_selected_by_key_and_schema_inlined():
    from app.services.screenplay.llm import inline_refs

    g = ScreenplayLLM(_settings(), env={"GEMINI_API_KEY": "g"})
    assert g.provider == "gemini" and g.model == "gemini-3.8-flash"
    schema = inline_refs(LLMSegmentation.model_json_schema())
    assert "$defs" not in json.dumps(schema) and "$ref" not in json.dumps(schema)
    assert "start_line" in json.dumps(schema)


@pytest.mark.asyncio
async def test_gemini_call_and_quota(monkeypatch):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        out = {"candidates": [{"content": {"parts": [{"text": json.dumps(SEG)}]}}]}
        return httpx.Response(200, json=out)

    _patch(monkeypatch, handler)
    g = ScreenplayLLM(_settings(), env={"GEMINI_API_KEY": "g", "GEMINI_MODEL": "m"})
    out = await g.parse_structured(system="s", user="u", output_format=LLMSegmentation)
    assert out.scenes[0].place == "Cinéma"
    assert seen[0].url.path.endswith("/models/m:generateContent")
    assert seen[0].headers["x-goog-api-key"] == "g"
    cfg = json.loads(seen[0].content)["generationConfig"]
    assert cfg["responseMimeType"] == "application/json"

    _patch(monkeypatch, lambda r: httpx.Response(429, json={}))
    with pytest.raises(LLMUnavailable, match="quota"):
        await g.parse_structured(system="s", user="u", output_format=LLMSegmentation)
