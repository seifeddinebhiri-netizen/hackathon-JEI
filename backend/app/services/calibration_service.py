"""Expose les tables de calibration en JSON : le client recalcule les cibles chiffrées HORS LIGNE
quand l'utilisateur modifie le plan (même calcul que `compute_targets`). Les tables Python de
`calibration.py` restent l'unique source."""

from typing import Any

from app.schemas.shot_spec import SubjectKind
from app.services import calibration as c
from app.services.vocabulary import FIELDS


def _pairs(table: dict) -> dict[str, list[float]]:
    return {k.value: list(v) for k, v in table.items()}


def _scalars(table: dict) -> dict[str, float | None]:
    return {k.value: v for k, v in table.items()}


def build_calibration() -> dict[str, Any]:
    return {
        "version": c.CALIBRATION_VERSION,
        "third_tol": c.THIRD_TOL,
        # Quels sujets ont un visage / une tête (donc un espace au-dessus de la tête).
        "rules": {
            "no_subject": [SubjectKind.none.value],
            "has_head": [SubjectKind.person.value, SubjectKind.face.value],
            "moving": [m.value for m in c.MOVING_MOVEMENTS],
        },
        "tables": {
            "subject_h": _pairs(c.SUBJECT_H),
            "headroom": _pairs(c.HEADROOM),
            "center_x": _scalars(c.CENTER_X),
            "pitch": _pairs(c.PITCH),
            "roll_abs": _pairs(c.ROLL_ABS),
            "luma": _pairs(c.LUMA),
            "contrast": _pairs(c.CONTRAST),
            "backlight_ratio_max": _scalars(c.BACKLIGHT_RATIO_MAX),
            "sun_offset_abs": _pairs(c.SUN_OFFSET_ABS),
            "shake_max": _scalars(c.SHAKE_MAX),
        },
        "vocabulary": [
            {
                "key": key,
                "label_fr": label,
                "options": [{"value": str(v.value), "label_fr": lab} for v, lab in options.items()],
            }
            for key, label, options in FIELDS
        ],
    }
