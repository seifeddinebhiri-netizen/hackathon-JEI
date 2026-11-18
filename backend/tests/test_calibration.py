import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import shot_spec as sp
from app.services import calibration as cal
from app.services.calibration_service import build_calibration
from app.services.vocabulary import FIELDS
from scripts.export_targets_fixture import build

FIXTURE = Path(__file__).parent / "fixtures" / "targets_cases.json"


def test_endpoint_is_public_and_complete():
    with TestClient(app) as client:
        r = client.get("/calibration")
    assert r.status_code == 200
    body = r.json()
    assert body["version"] == cal.CALIBRATION_VERSION
    assert set(body["tables"]) >= {"subject_h", "headroom", "center_x", "pitch", "roll_abs", "luma"}
    assert [f["key"] for f in body["vocabulary"]] == [k for k, _, _ in FIELDS]


def test_every_enum_value_has_a_french_label_and_a_table_entry():
    enums = {
        "size": sp.ShotSize, "subject_kind": sp.SubjectKind, "subject_view": sp.SubjectView,
        "subject_position": sp.SubjectPosition, "camera_angle": sp.CameraAngle, "tilt": sp.Tilt,
        "light_contrast": sp.Contrast, "exposure": sp.Exposure, "backlight": sp.Backlight,
        "sun_relative": sp.SunRelative, "stability": sp.Stability, "movement": sp.Movement,
    }  # fmt: skip
    for key, _, labels in FIELDS:
        assert {v.value for v in labels} == {v.value for v in enums[key]}, key
        assert all(label.strip() for label in labels.values()), key
    tables = build_calibration()["tables"]
    for table, enum in {
        "subject_h": sp.ShotSize, "headroom": sp.ShotSize, "center_x": sp.SubjectPosition,
        "pitch": sp.CameraAngle, "roll_abs": sp.Tilt, "luma": sp.Exposure,
        "contrast": sp.Contrast, "backlight_ratio_max": sp.Backlight, "shake_max": sp.Stability,
    }.items():  # fmt: skip
        assert set(tables[table]) == {v.value for v in enum}, table


def test_fixture_is_up_to_date_with_calibration_py():
    """Si ce test échoue : `uv run python -m scripts.export_targets_fixture` (puis relance Vitest)."""
    assert json.loads(FIXTURE.read_text(encoding="utf-8")) == json.loads(json.dumps(build()))


def test_a_moving_shot_keeps_all_its_targets_except_the_shake():
    from app.schemas.shot_spec import ShotChoices
    from app.services.calibration import compute_targets

    base = {
        "size": "MS", "subject_kind": "person", "subject_view": "front",
        "subject_position": "left_third", "camera_angle": "eye_level", "tilt": "level",
        "light_contrast": "medium", "exposure": "balanced", "backlight": "avoid",
        "sun_relative": "not_applicable", "stability": "handheld",
    }  # fmt: skip
    fixed = compute_targets(ShotChoices(**base, movement="static"))
    assert fixed.shake_max is not None
    for movement in ("pan", "tilt", "tracking"):
        t = compute_targets(ShotChoices(**base, movement=movement))
        # tout est suivi comme dans un plan fixe : c'est la chronologie qui fait varier les cibles
        assert (t.pitch_deg, t.subject_h, t.center_x, t.headroom) == (
            fixed.pitch_deg, fixed.subject_h, fixed.center_x, fixed.headroom,
        )  # fmt: skip
        # la rotation voulue d'un panoramique ne doit pas être signalée comme un tremblement
        assert t.shake_max is None
