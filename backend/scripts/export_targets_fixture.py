"""Génère le jeu d'essai commun entre le backend (Python) et le front (TypeScript).

Il contient la calibration (comme `GET /calibration`) et une liste de cas « plan en mots -> cibles
chiffrées » calculés par `compute_targets`. Python et TypeScript doivent donner les mêmes nombres :
le test pytest compare le fichier à un recalcul, le test Vitest compare le calcul du front.
Si tu modifies `calibration.py`, relance :  uv run python -m scripts.export_targets_fixture
"""

import json
import random
from pathlib import Path

from app.schemas.shot_spec import ShotIntent
from app.services.calibration import compute_targets
from app.services.calibration_service import build_calibration
from app.services.vocabulary import FIELDS

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS = [
    ROOT / "tests" / "fixtures" / "targets_cases.json",
    ROOT.parent / "web" / "src" / "features" / "coach" / "plan" / "fixtures" / "targets_cases.json",
]

BASE = {
    "size": "MS", "subject_kind": "person", "subject_view": "front", "subject_position": "center",
    "camera_angle": "eye_level", "tilt": "level", "light_contrast": "medium", "exposure": "balanced",
    "backlight": "avoid", "sun_relative": "not_applicable", "stability": "handheld",
    "movement": "static",
}  # fmt: skip


def intent(closed: dict[str, str]) -> ShotIntent:
    return ShotIntent(label_fr="x", why_fr="x", rule_ids=["R-001"], advice_fr=[], **closed)


def cases() -> list[dict]:
    options = {key: [o.value for o in vals] for key, _, vals in FIELDS}
    combos = [dict(BASE)]
    for key, values in options.items():  # chaque valeur de chaque champ, au moins une fois
        combos += [{**BASE, key: v} for v in values]
    rng = random.Random(42)
    combos += [{k: rng.choice(v) for k, v in options.items()} for _ in range(60)]
    return [
        {"intent": c, "targets": compute_targets(intent(c)).model_dump(mode="json")} for c in combos
    ]


def build() -> dict:
    return {"calibration": build_calibration(), "cases": cases()}


def main() -> None:
    text = json.dumps(build(), indent=2, ensure_ascii=False) + "\n"
    for path in OUTPUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print(f"écrit : {path.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
