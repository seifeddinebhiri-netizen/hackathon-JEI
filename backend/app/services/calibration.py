"""Conversion du vocabulaire fermé du LLM en plages numériques (la « grille »).

ATTENTION : ces valeurs sont des réglages v0 d'ingénierie, pas des faits issus de sources.
Elles seront calibrées sur le terrain (voir CALIBRATION_VERSION). Une seule exception
documentée par une source : yeux à ~1/3 depuis le haut et tiers à 1/3 (règles R-008 et R-010).
"""

from app.schemas.shot_spec import (
    Backlight,
    CameraAngle,
    Contrast,
    Exposure,
    Range,
    ShotIntent,
    ShotSize,
    ShotTargets,
    Stability,
    SubjectKind,
    SubjectPosition,
    SunRelative,
    Tilt,
)

CALIBRATION_VERSION = "v0-default"

THIRD_TOL = 0.06

SUBJECT_H = {  # hauteur du sujet / hauteur de l'image
    ShotSize.ECU: (0.85, 1.00),
    ShotSize.CU: (0.60, 0.85),
    ShotSize.MCU: (0.40, 0.60),
    ShotSize.MS: (0.30, 0.45),
    ShotSize.MWS: (0.20, 0.35),
    ShotSize.WS: (0.05, 0.20),
}

HEADROOM = {  # espace entre le haut de la tête et le haut de l'image
    ShotSize.ECU: (0.00, 0.05),
    ShotSize.CU: (0.03, 0.10),
    ShotSize.MCU: (0.05, 0.12),
    ShotSize.MS: (0.06, 0.14),
    ShotSize.MWS: (0.08, 0.18),
    ShotSize.WS: (0.10, 0.30),
}

CENTER_X = {
    SubjectPosition.left_third: 1 / 3,
    SubjectPosition.center: 0.5,
    SubjectPosition.right_third: 2 / 3,
}

PITCH = {
    CameraAngle.eye_level: (-4.0, 4.0),
    CameraAngle.low: (8.0, 30.0),
    CameraAngle.high: (-30.0, -8.0),
}

ROLL_ABS = {Tilt.level: (0.0, 2.0), Tilt.dutch: (8.0, 25.0)}

LUMA = {
    Exposure.dark: (0.15, 0.35),
    Exposure.balanced: (0.35, 0.60),
    Exposure.bright: (0.60, 0.85),
}

CONTRAST = {
    Contrast.low: (0.00, 0.15),
    Contrast.medium_low: (0.15, 0.30),
    Contrast.medium: (0.30, 0.50),
    Contrast.high: (0.50, 1.00),
}

BACKLIGHT_RATIO_MAX = {Backlight.avoid: 1.5, Backlight.accept: 3.0, Backlight.intentional: None}

SUN_OFFSET_ABS = {
    SunRelative.front: (0.0, 30.0),
    SunRelative.side: (60.0, 120.0),
    SunRelative.behind: (150.0, 180.0),
}

SHAKE_MAX = {Stability.tripod: 0.02, Stability.handheld: 0.12}


def _r(pair: tuple[float, float]) -> Range:
    return Range(min=pair[0], max=pair[1])


def compute_targets(shot: ShotIntent) -> ShotTargets:
    has_subject = shot.subject_kind != SubjectKind.none
    has_head = shot.subject_kind in (SubjectKind.person, SubjectKind.face)
    cx = CENTER_X[shot.subject_position]
    return ShotTargets(
        roll_abs_deg=_r(ROLL_ABS[shot.tilt]),
        pitch_deg=_r(PITCH[shot.camera_angle]),
        subject_h=_r(SUBJECT_H[shot.size]) if has_subject else None,
        center_x=Range(min=cx - THIRD_TOL, max=cx + THIRD_TOL) if has_subject else None,
        center_y=None,
        headroom=_r(HEADROOM[shot.size]) if has_head else None,
        luma=_r(LUMA[shot.exposure]),
        contrast=_r(CONTRAST[shot.light_contrast]),
        backlight_ratio_max=BACKLIGHT_RATIO_MAX[shot.backlight],
        sun_offset_abs_deg=(
            _r(SUN_OFFSET_ABS[shot.sun_relative]) if shot.sun_relative in SUN_OFFSET_ABS else None
        ),
        shake_max=SHAKE_MAX[shot.stability],
    )
