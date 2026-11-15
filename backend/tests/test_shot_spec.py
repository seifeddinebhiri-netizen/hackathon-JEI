from fastapi.testclient import TestClient

from app.main import app
from app.schemas.shot_spec import LLMShotSpec
from app.services.llm_service import LLMUnavailable

SCENE = {"description": "Un vieil homme boit le thé dans un café de la médina, de dos."}


def _intent(rule_ids):
    return {
        "label_fr": "Plan moyen de dos",
        "size": "MS",
        "subject_kind": "person",
        "subject_view": "back",
        "subject_position": "left_third",
        "camera_angle": "eye_level",
        "tilt": "level",
        "light_contrast": "medium_low",
        "exposure": "balanced",
        "backlight": "avoid",
        "sun_relative": "not_applicable",
        "stability": "handheld",
        "movement": "static",
        "why_fr": "Le dos garde le mystère du personnage.",
        "rule_ids": rule_ids,
        "advice_fr": [],
    }


class FakeLLM:
    model = "fake-model"

    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.calls = 0

    async def generate_shots(self, rules_text, description, setting):
        self.calls += 1
        out = self.outputs.pop(0)
        if isinstance(out, Exception):
            raise out
        return LLMShotSpec.model_validate({"shots": [_intent(ids) for ids in out]})


def _post(llm):
    with TestClient(app) as client:
        app.state.llm = llm
        return client.post("/shot-spec", json=SCENE)


def test_valid_spec_has_targets_and_rule_sources():
    r = _post(FakeLLM([[["R-008"]]]))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "Brouillon IA : à valider"
    shot = body["shots"][0]
    assert shot["targets"]["roll_abs_deg"] == {"min": 0.0, "max": 2.0}
    assert shot["rules"][0]["id"] == "R-008"
    assert shot["rules"][0]["sources"]


def test_unknown_rule_id_is_retried_then_accepted():
    llm = FakeLLM([[["R-999"]], [["R-008"]]])
    assert _post(llm).status_code == 200
    assert llm.calls == 2


def test_unknown_rule_id_twice_gives_502():
    llm = FakeLLM([[["R-999"]], [["R-999"]]])
    r = _post(llm)
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "invalid_model_output"


def test_llm_unavailable_gives_503():
    r = _post(FakeLLM([LLMUnavailable("ANTHROPIC_API_KEY non configurée.")]))
    assert r.status_code == 503


def test_description_too_short_is_rejected():
    with TestClient(app) as client:
        assert client.post("/shot-spec", json={"description": "court"}).status_code == 422
