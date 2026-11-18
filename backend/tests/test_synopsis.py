import json

import pytest
from fastapi.testclient import TestClient
from structlog.testing import capture_logs

from app.core.config import Settings
from app.main import app
from app.services.translation_service import GeminiTranslator, PromptTranslator

TEXT = "Dans la médina de Tunis, Amira ouvre le café de son père disparu."


# --- Faux traducteur (aucun appel réseau) ---------------------------------------------
class FakeTranslator(PromptTranslator):
    name = "fake/llm"
    available = True

    def __init__(
        self, reply='{"text": "In the Tunis medina, Amira opens her late father\'s café."}'
    ):
        self.reply = reply
        self.calls = []

    async def _complete(self, system, user, schema=None):
        self.calls.append((system, json.loads(user), schema))
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


@pytest.fixture
def client():
    with TestClient(app) as c:
        app.state.translator = FakeTranslator()
        yield c


def post(client, **body):
    return client.post(
        "/synopsis/translate", json={"kind": "court", "text": TEXT, "target_lang": "en", **body}
    )


def test_translate_returns_text_and_never_logs_it(client):
    with capture_logs() as logs:
        r = post(client)
    assert r.status_code == 200, r.text
    assert r.json() == {"text": "In the Tunis medina, Amira opens her late father's café."}

    system, user, schema = app.state.translator.calls[0]
    assert user["texte"] == TEXT and user["type"] == "synopsis court"
    assert "limite_caracteres" not in user  # le front ne l'envoie pas pour l'instant
    assert schema.__name__ == "SynopsisTranslation"
    assert "noms" in system and "N'ajoute rien" in system
    dumped = json.dumps(logs, default=str)
    assert "médina" not in dumped and "medina" not in dumped
    assert any(e["event"] == "synopsis_translated" for e in logs)


def test_limit_chars_is_optional_and_passed_to_llm(client):
    r = post(client, limit_chars=300)
    assert r.status_code == 200
    assert app.state.translator.calls[0][1]["limite_caracteres"] == 300


def test_missing_key_returns_503(client):
    app.state.translator = GeminiTranslator(
        Settings(_env_file=None, gemini_api_key="", gemini_model="gemini-3.8-flash")
    )
    r = post(client)
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "translation_unavailable"

    app.state.translator = None  # LLM_PROVIDER inconnu
    assert post(client).status_code == 503


def test_provider_error_returns_502_in_french(client):
    app.state.translator = FakeTranslator(reply=RuntimeError("quota"))
    r = post(client)
    assert r.status_code == 502
    err = r.json()["error"]
    assert err["code"] == "translation_failed" and "traduction" in err["message"]

    app.state.translator = FakeTranslator(reply="pas du JSON")
    assert post(client).status_code == 502


@pytest.mark.parametrize(
    "body",
    [
        {"text": "   "},
        {"target_lang": "de"},
        {"kind": "moyen"},
        {"limit_chars": 0},
    ],
)
def test_invalid_request_returns_422(client, body):
    r = post(client, **body)
    assert r.status_code == 422
    assert app.state.translator.calls == []
