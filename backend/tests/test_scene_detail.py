import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.scene_detail import LLMSceneDetail, SceneDetailRequest
from app.services.llm_service import LLMUnavailable, build_detail_prompt

pytestmark = pytest.mark.usefixtures("signed_in")

BODY = {
    "film": {"title": "Marée basse", "format": "court", "city": "Tunis", "genre": "Drame"},
    "scene": {
        "number": "3",
        "title": "Dispute au frigo",
        "setting": "INT",
        "moment": "nuit",
        "decor": "Appartement d'Amira",
        "summary": "Slim et Amira se disputent.",
        "characters": ["Slim", "Amira"],
        "excerpt": "Slim et Amira se disputent dans la cuisine. La lumière du frigo éclaire.",
    },
}

RAW = {
    "what_happens": " Slim reproche à Amira de vouloir sauver le café seule. Elle refuse. ",
    "on_screen": "Cuisine de nuit, éclairée par le frigo.",
    "props": ["Frigo", "frigo", " ", "Enveloppe."],
    "costumes": [],
    "extras": "",
    "sound": ["Dialogue", "Ronronnement du frigo"],
    "special": ["aucun"],
    "watch_out": ["Lumière faible", "Son du frigo", "Raccord", "Continuité", "Un de trop"],
}


class FakeLLM:
    suggest_model = "fake-model"

    def __init__(self, raw=None, error=None):
        self.raw = raw or RAW
        self.error = error
        self.calls = []

    async def detail_scene(self, req):
        self.calls.append(req)
        if self.error:
            raise self.error
        return LLMSceneDetail.model_validate(self.raw)


def _post(llm, body=BODY):
    with TestClient(app) as client:
        app.state.llm = llm
        return client.post("/planner/scenes/detail", json=body)


def test_returns_a_cleaned_sheet():
    r = _post(FakeLLM())
    assert r.status_code == 200
    d = r.json()
    assert d["what_happens"].startswith("Slim reproche")
    assert d["props"] == ["Frigo", "Enveloppe"]  # doublons, vides et point final retirés
    assert d["special"] == []  # « aucun » n'est pas un élément
    assert len(d["watch_out"]) == 4
    assert d["model"] == "fake-model"


def test_llm_unavailable_gives_503_in_french():
    r = _post(FakeLLM(error=LLMUnavailable("x")))
    assert r.status_code == 503
    assert "indisponible" in r.json()["message"]


def test_empty_sheet_is_refused():
    r = _post(FakeLLM(raw={**RAW, "what_happens": "  "}))
    assert r.status_code == 502


def test_requires_login():
    app.dependency_overrides.clear()
    with TestClient(app) as client:
        assert client.post("/planner/scenes/detail", json=BODY).status_code == 401


def test_prompt_keeps_scene_text_between_tags():
    prompt = build_detail_prompt(SceneDetailRequest.model_validate(BODY))
    assert "<scene>" in prompt and "</scene>" in prompt
    assert "La lumière du frigo éclaire." in prompt
    assert "Genre : Drame" in prompt
