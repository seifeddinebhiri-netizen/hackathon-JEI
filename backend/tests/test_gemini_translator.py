"""GeminiTranslator : délais, relances et modèle de secours (faux client, aucun réseau)."""

import asyncio
import json
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from google.genai import errors
from structlog.testing import capture_logs

from app.core.config import Settings, get_settings
from app.main import app
from app.schemas.subtitle import Cue, TranslationContext
from app.services import subtitle_service, translation_service
from app.services.subtitle_segmentation import srt_time
from app.services.translation_service import (
    FALLBACK_NOTE,
    GeminiTranslator,
    set_deadline,
    thinking_level_for,
    track_models,
    used_translator_name,
)
from tests.test_subtitles import FakeTranscriber, post_draft

HANG = "hang"
OK = json.dumps(
    {"lines": [{"id": "l1", "fr": "Ça va ?", "en": "You okay?", "confidence": "elevee"}]}
)


def unavailable(code=503):
    return errors.ServerError(code, {"error": {"code": code, "status": "UNAVAILABLE"}})


class FakeModels:
    """Joue un script : texte JSON, exception, ou HANG (ne répond jamais)."""

    def __init__(self, script):
        self.script = list(script)
        self.calls: list[str] = []
        self.configs = []

    async def generate_content(self, model, contents, config):
        self.calls.append(model)
        self.configs.append(config)
        step = self.script.pop(0)
        if step == HANG:
            await asyncio.Event().wait()
        if isinstance(step, Exception):
            raise step
        return SimpleNamespace(text=step)


def gemini(script, timeout_s=0.05):
    models = FakeModels(script)
    settings = Settings(
        _env_file=None,
        gemini_api_key="test-key",
        gemini_model="principal",
        gemini_fallback_model="secours",
        gemini_timeout_s=timeout_s,
    )
    client = SimpleNamespace(aio=SimpleNamespace(models=models))
    return GeminiTranslator(settings, client=client, retry_delays=(0, 0)), models


def cue(i=1):
    return Cue(id=f"l{i}", start=srt_time(0), end=srt_time(2), source="Labes", asr_confidence=0.9)


async def run(tr):
    used = track_models()
    out = await tr.translate([cue()], TranslationContext())
    return out, used_translator_name(tr, used)


def test_call_that_never_answers_respects_the_timeout():
    tr, models = gemini([HANG, OK])
    started = time.monotonic()
    out, name = asyncio.run(run(tr))
    assert time.monotonic() - started < 2
    assert out[0].fr == "Ça va ?"
    assert models.calls == ["principal", "principal"]
    assert name == "gemini/principal"
    # Délai aussi transmis au SDK, en millisecondes.
    assert models.configs[0].http_options.timeout == 50


def test_503_then_success_on_main_model():
    tr, models = gemini([unavailable(), OK])
    with capture_logs() as logs:
        out, name = asyncio.run(run(tr))
    assert out[0].en == "You okay?"
    assert models.calls == ["principal", "principal"]
    assert name == "gemini/principal"
    ok = next(e for e in logs if e["event"] == "gemini_call_ok")
    assert ok["attempts"] == 2 and ok["model"] == "principal" and "duration_s" in ok
    assert "Labes" not in json.dumps(logs, default=str) and "test-key" not in str(logs)


def test_503_everywhere_then_fallback_model():
    tr, models = gemini([unavailable(), unavailable(429), HANG, OK])
    out, name = asyncio.run(run(tr))
    assert out[0].fr == "Ça va ?"
    assert models.calls == ["principal", "principal", "principal", "secours"]
    assert name == "gemini/secours"


def test_durable_error_skips_retries_but_tries_fallback():
    tr, models = gemini([errors.ClientError(400, {"error": {"code": 400}}), OK])
    out, _ = asyncio.run(run(tr))
    assert out[0].fr == "Ça va ?"
    assert models.calls == ["principal", "secours"]


def test_everything_fails_gives_low_confidence_lines():
    tr, models = gemini([unavailable()] * 4)
    out, name = asyncio.run(run(tr))
    assert out[0].fr == "" and out[0].en == ""
    assert out[0].confidence == "faible" and out[0].note == FALLBACK_NOTE
    # Une seule cascade : pas de nouvelle série de relances par-dessus.
    assert models.calls == ["principal", "principal", "principal", "secours"]
    assert name == "gemini/principal"


# --- Endpoint ------------------------------------------------------------------------
@pytest.fixture
def client():
    with TestClient(app) as c:
        app.state.db_pool = None
        app.state.transcriber = FakeTranscriber()
        subtitle_service._memory.clear()
        yield c
    subtitle_service._memory.clear()


def test_draft_returns_200_when_gemini_fails_everywhere(client):
    app.state.translator, _ = gemini([unavailable()] * 8)
    r = post_draft(client)
    assert r.status_code == 200, r.text
    d = r.json()
    assert all(li["fr"] == "" and li["confidence"] == "faible" for li in d["lines"])
    assert d["processing"]["translator"] == "gemini/principal"


def test_draft_reports_fallback_model_in_processing(client):
    two = json.dumps(
        {
            "lines": [
                {"id": "l1", "fr": "Merci.", "en": "Thanks.", "confidence": "elevee"},
                {"id": "l2", "fr": "Ça va ?", "en": "You okay?", "confidence": "elevee"},
            ]
        }
    )
    app.state.translator, _ = gemini([unavailable()] * 3 + [two])
    r = post_draft(client)
    assert r.status_code == 200
    assert r.json()["processing"]["translator"] == "gemini/secours"


def test_slow_transcription_over_global_timeout_returns_504(client, monkeypatch):
    class SlowTranscriber(FakeTranscriber):
        async def transcribe(self, *args):
            await asyncio.Event().wait()

    monkeypatch.setattr(get_settings(), "subtitle_draft_timeout_s", 0.1)
    app.state.transcriber = SlowTranscriber()
    app.state.translator, _ = gemini([OK])
    r = post_draft(client)
    assert r.status_code == 504
    err = r.json()["error"]
    assert err["code"] == "draft_timeout" and "trop de temps" in err["message"]
    assert client.get("/subtitles/demo").json()["lines"] == []  # rien d'enregistré


def test_504_and_deadline_exceeded_are_transient():
    deadline = errors.ServerError(504, {"error": {"code": 504, "status": "DEADLINE_EXCEEDED"}})
    tr, models = gemini([unavailable(504), deadline, OK])
    out, name = asyncio.run(run(tr))
    assert out[0].fr == "Ça va ?"
    assert models.calls == ["principal", "principal", "principal"]  # pas de bascule
    assert name == "gemini/principal"


def test_thinking_level_minimal_and_floor():
    tr, models = gemini([OK])
    asyncio.run(run(tr))
    assert models.configs[0].thinking_config.thinking_level == "MINIMAL"
    assert thinking_level_for("gemini-3.8-flash", "minimal") == "low"
    assert thinking_level_for("gemini-3.1-flash-lite", "minimal") == "minimal"
    assert thinking_level_for("x", "") is None


def test_call_timeout_is_capped_by_remaining_budget(monkeypatch):
    monkeypatch.setattr(translation_service, "BUDGET_MARGIN_S", 0.1)
    monkeypatch.setattr(translation_service, "MIN_REMAINING_S", 0.5)
    tr, models = gemini([HANG, OK, OK, OK], timeout_s=5)

    async def scenario():
        set_deadline(1.0)
        return await run(tr)

    started = time.monotonic()
    out, _ = asyncio.run(scenario())
    assert time.monotonic() - started < 1.0  # ~0,9 s : jamais les 5 s de GEMINI_TIMEOUT_S
    assert models.calls == ["principal"]  # il restait < 0,5 s : pas de nouvel essai
    assert models.configs[0].http_options.timeout == pytest.approx(900, abs=30)
    assert out[0].confidence == "faible"


def test_almost_exhausted_budget_gives_200_with_low_lines(client, monkeypatch):
    monkeypatch.setattr(translation_service, "BUDGET_MARGIN_S", 0.1)
    monkeypatch.setattr(translation_service, "MIN_REMAINING_S", 0.5)
    monkeypatch.setattr(get_settings(), "subtitle_draft_timeout_s", 1.0)
    app.state.translator, models = gemini([HANG] * 8, timeout_s=0.6)
    r = post_draft(client)
    assert r.status_code == 200, r.text
    assert all(li["fr"] == "" and li["confidence"] == "faible" for li in r.json()["lines"])
    assert models.calls == ["principal"]  # un seul essai, puis budget jugé insuffisant
