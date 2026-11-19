from fastapi.testclient import TestClient

from app.core.auth import CurrentUser, get_current_user
from app.core.rate_limit import shot_spec_limiter
from app.main import app
from app.schemas.shot_spec import LLMMovingPlan, LLMStaticPlan
from app.services.llm_service import LLMUnavailable

STATIC_SCENE = {"description": "Un vieil homme boit le thé dans un café de la médina, de dos."}
MOVING_SCENE = {
    "description": "Amira court dans la ruelle de la médina, la caméra la suit.",
    "motion": "moving",
    "duration_s": 10,
}

CHOICES = {
    "size": "MS", "subject_kind": "person", "subject_view": "back", "subject_position": "left_third",
    "camera_angle": "eye_level", "tilt": "level", "light_contrast": "medium_low",
    "exposure": "balanced", "backlight": "avoid", "sun_relative": "not_applicable",
    "stability": "handheld", "movement": "static",
}  # fmt: skip


def static_plan(rule_ids, movement="static"):
    return LLMStaticPlan.model_validate(
        {
            "shot": {
                **CHOICES,
                "movement": movement,
                "label_fr": "Plan moyen de dos",
                "why_fr": "Le dos garde le mystère du personnage.",
                "rule_ids": rule_ids,
                "advice_fr": [],
            }
        }
    )


def moving_plan(rule_ids, segments=None, how="Pendant 10 secondes, tu suis Amira."):
    segments = segments if segments is not None else [
        {"start_s": 0, "end_s": 3, "description_fr": "Amira au centre.", "at_start": CHOICES, "at_end": None},
        {
            "start_s": 3, "end_s": 10, "description_fr": "Elle sort du cadre, la caméra monte.",
            "at_start": {**CHOICES, "subject_kind": "none", "subject_view": "not_applicable", "camera_angle": "low", "movement": "tilt"},
            "at_end": {**CHOICES, "subject_kind": "none", "subject_view": "not_applicable", "camera_angle": "high", "movement": "tilt"},
        },
    ]  # fmt: skip
    return LLMMovingPlan.model_validate(
        {
            "label_fr": "Travelling dans la ruelle",
            "why_fr": "Suivre garde l'énergie.",
            "how_fr": how,
            "advice_fr": ["Garde une vitesse régulière."],
            "rule_ids": rule_ids,
            "segments": segments,
        }
    )


class FakeLLM:
    """Un faux LLM par type de scène : on vérifie aussi quel prompt est utilisé."""

    model = "fake-model"

    def __init__(self, static=None, moving=None):
        self.static = list(static or [])
        self.moving = list(moving or [])
        self.static_calls = 0
        self.moving_calls = 0

    async def generate_static(self, rules_text, scene):
        self.static_calls += 1
        out = self.static.pop(0)
        if isinstance(out, Exception):
            raise out
        return out

    async def generate_moving(self, rules_text, scene):
        self.moving_calls += 1
        out = self.moving.pop(0)
        if isinstance(out, Exception):
            raise out
        return out


def _post(llm, body):
    shot_spec_limiter().reset()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="u1", email=None)
    try:
        with TestClient(app) as client:
            app.state.llm = llm
            return client.post("/shot-spec", json=body)
    finally:
        app.dependency_overrides.clear()


# --- plan fixe ----------------------------------------------------------------


def test_static_scene_gives_exactly_one_plan_with_targets_and_sources():
    llm = FakeLLM(static=[static_plan(["R-008"])])
    r = _post(llm, STATIC_SCENE)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "Brouillon IA : à valider"
    assert len(body["shots"]) == 1
    shot = body["shots"][0]
    assert shot["timeline"] is None
    assert shot["targets"]["roll_abs_deg"] == {"min": 0.0, "max": 2.0}
    assert shot["rules"][0]["id"] == "R-008" and shot["rules"][0]["sources"]
    assert (llm.static_calls, llm.moving_calls) == (1, 0)


def test_static_scene_forces_a_fixed_camera_even_if_the_model_moves_it():
    r = _post(FakeLLM(static=[static_plan(["R-008"], movement="tracking")]), STATIC_SCENE)
    shot = r.json()["shots"][0]
    assert shot["intent"]["movement"] == "static"
    assert shot["targets"]["shake_max"] is not None  # un plan fixe surveille le tremblement


def test_unknown_motion_is_treated_as_static():
    llm = FakeLLM(static=[static_plan(["R-008"])])
    assert _post(llm, {**STATIC_SCENE, "motion": "unknown"}).status_code == 200
    assert (llm.static_calls, llm.moving_calls) == (1, 0)


def test_static_unknown_rule_id_is_retried_then_accepted_or_rejected():
    ok = FakeLLM(static=[static_plan(["R-999"]), static_plan(["R-008"])])
    assert _post(ok, STATIC_SCENE).status_code == 200 and ok.static_calls == 2
    bad = _post(FakeLLM(static=[static_plan(["R-999"]), static_plan([])]), STATIC_SCENE)
    assert bad.status_code == 502 and bad.json()["code"] == "invalid_model_output"


# --- plan en mouvement --------------------------------------------------------


def test_moving_scene_gives_one_plan_with_a_timeline_and_its_own_prompt():
    llm = FakeLLM(moving=[moving_plan(["R-008"])])
    r = _post(llm, MOVING_SCENE)
    assert r.status_code == 200
    body = r.json()
    assert len(body["shots"]) == 1  # un seul plan, comme pour un plan fixe
    shot = body["shots"][0]
    tl = shot["timeline"]
    assert (llm.static_calls, llm.moving_calls) == (0, 1)
    assert tl["duration_s"] == 10 and tl["how_fr"].startswith("Pendant 10 secondes")
    assert [(s["start_s"], s["end_s"]) for s in tl["segments"]] == [(0, 3), (3, 10)]
    first, second = tl["segments"]
    # tout est suivi, comme dans un plan fixe : position et angle du premier passage...
    assert first["targets_start"]["center_x"] and first["targets_start"]["pitch_deg"]
    assert first["targets_end"] is None
    # ...puis « plus de visage » et un angle qui évolue de la contre-plongée à la plongée
    assert (
        second["targets_start"]["center_x"] is None and second["targets_start"]["headroom"] is None
    )
    assert second["targets_end"]["pitch_deg"]["min"] < second["targets_start"]["pitch_deg"]["min"]
    assert (
        second["targets_start"]["pitch_deg"]["min"] > 0 > second["targets_end"]["pitch_deg"]["max"]
    )
    # le tremblement n'a pas de sens pendant un mouvement voulu
    assert (
        second["targets_start"]["shake_max"] is None
        and first["targets_start"]["shake_max"] is not None
    )
    # le plan résume le premier passage
    assert shot["targets"] == first["targets_start"]
    assert shot["intent"]["label_fr"] == "Travelling dans la ruelle"


def test_moving_scene_requires_a_duration():
    llm = FakeLLM(moving=[moving_plan(["R-008"])])
    r = _post(llm, {**MOVING_SCENE, "duration_s": None})
    assert r.status_code == 422
    assert _post(llm, {**MOVING_SCENE, "duration_s": 1}).status_code == 422  # trop court
    assert _post(llm, {**MOVING_SCENE, "duration_s": 500}).status_code == 422  # trop long
    assert llm.moving_calls == 0


def test_moving_plan_with_broken_segments_is_retried_then_rejected():
    broken = moving_plan(["R-008"], segments=[])  # aucun passage
    good = moving_plan(["R-008"])
    ok = FakeLLM(moving=[broken, good])
    assert _post(ok, MOVING_SCENE).status_code == 200 and ok.moving_calls == 2
    bad = _post(FakeLLM(moving=[broken, broken]), MOVING_SCENE)
    assert bad.status_code == 502 and bad.json()["code"] == "invalid_model_output"
    no_how = _post(
        FakeLLM(moving=[moving_plan(["R-008"], how="  "), moving_plan(["R-008"], how="")]),
        MOVING_SCENE,
    )
    assert no_how.status_code == 502  # une explication claire est obligatoire


# --- commun -------------------------------------------------------------------


def test_llm_unavailable_gives_503():
    r = _post(FakeLLM(static=[LLMUnavailable("GEMINI_API_KEY non configurée.")]), STATIC_SCENE)
    assert r.status_code == 503
    r = _post(FakeLLM(moving=[LLMUnavailable("indisponible")]), MOVING_SCENE)
    assert r.status_code == 503


def test_description_too_short_is_rejected():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="u1", email=None)
    try:
        with TestClient(app) as client:
            assert client.post("/shot-spec", json={"description": "court"}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_shot_spec_requires_auth():
    with TestClient(app) as client:
        r = client.post("/shot-spec", json=STATIC_SCENE)
        assert r.status_code == 401
        assert r.json()["code"] == "non_autorise"


def test_rate_limit_returns_429():
    limiter = shot_spec_limiter()
    limiter.reset()
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="u-rl", email=None)
    try:
        with TestClient(app) as client:
            app.state.llm = FakeLLM(static=[static_plan(["R-008"])] * (limiter.limit + 1))
            codes = [
                client.post("/shot-spec", json=STATIC_SCENE).status_code
                for _ in range(limiter.limit + 1)
            ]
        assert codes[-1] == 429 and codes[:-1] == [200] * limiter.limit
    finally:
        app.dependency_overrides.clear()
        limiter.reset()
