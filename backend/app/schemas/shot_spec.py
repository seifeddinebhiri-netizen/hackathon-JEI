"""Contrat du shot spec.

Deux niveaux :
- `ShotIntent` : ce que le LLM produit. Vocabulaire fermé (enums), aucun nombre inventé.
- `ShotTargets` : plages numériques calculées par le serveur (services/calibration.py),
  que le téléphone compare aux mesures en direct.
"""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class ShotSize(StrEnum):
    ECU = "ECU"  # très gros plan
    CU = "CU"  # gros plan
    MCU = "MCU"  # plan rapproché
    MS = "MS"  # plan moyen
    MWS = "MWS"  # plan américain / mi-large
    WS = "WS"  # plan large


class SubjectKind(StrEnum):
    person = "person"
    face = "face"
    hands = "hands"
    object = "object"
    none = "none"


class SubjectView(StrEnum):
    front = "front"
    side = "side"
    back = "back"
    not_applicable = "not_applicable"


class SubjectPosition(StrEnum):
    left_third = "left_third"
    center = "center"
    right_third = "right_third"


class CameraAngle(StrEnum):
    eye_level = "eye_level"
    low = "low"
    high = "high"


class Tilt(StrEnum):
    level = "level"
    dutch = "dutch"


class Contrast(StrEnum):
    low = "low"
    medium_low = "medium_low"
    medium = "medium"
    high = "high"


class Exposure(StrEnum):
    dark = "dark"
    balanced = "balanced"
    bright = "bright"


class Backlight(StrEnum):
    avoid = "avoid"
    accept = "accept"
    intentional = "intentional"


class SunRelative(StrEnum):
    front = "front"  # soleil derrière la caméra, face au sujet
    side = "side"
    behind = "behind"  # soleil derrière le sujet
    not_applicable = "not_applicable"


class Stability(StrEnum):
    tripod = "tripod"
    handheld = "handheld"


class Movement(StrEnum):
    static = "static"
    pan = "pan"
    tilt = "tilt"
    tracking = "tracking"


class SceneSetting(StrEnum):
    interior = "interior"
    exterior = "exterior"
    unknown = "unknown"


class ShotIntent(BaseModel):
    """Un plan, décrit avec un vocabulaire fermé. Sortie du LLM."""

    label_fr: str
    size: ShotSize
    subject_kind: SubjectKind
    subject_view: SubjectView
    subject_position: SubjectPosition
    camera_angle: CameraAngle
    tilt: Tilt
    light_contrast: Contrast
    exposure: Exposure
    backlight: Backlight
    sun_relative: SunRelative
    stability: Stability
    movement: Movement
    why_fr: str
    rule_ids: list[str]
    advice_fr: list[str]  # conseils non mesurables (hauteur caméra, son, etc.)


class LLMShotSpec(BaseModel):
    shots: list[ShotIntent]


# --- Requête / réponse de l'API ---


class ShotSpecRequest(BaseModel):
    description: str = Field(min_length=10, max_length=2000)
    scene_id: str | None = Field(default=None, max_length=64)
    setting: SceneSetting = SceneSetting.unknown


class Range(BaseModel):
    min: float
    max: float


class ShotTargets(BaseModel):
    """Plages numériques cibles. Valeurs v0 à calibrer sur le terrain."""

    roll_abs_deg: Range  # valeur absolue de l'inclinaison de l'horizon
    pitch_deg: Range  # + = caméra vers le haut, - = vers le bas
    subject_h: Range | None  # hauteur du sujet / hauteur de l'image
    center_x: Range | None
    center_y: Range | None
    headroom: Range | None
    luma: Range
    contrast: Range
    backlight_ratio_max: float | None
    sun_offset_abs_deg: Range | None  # écart absolu (0-180) cap caméra vs azimut du soleil
    shake_max: float  # vitesse de rotation RMS du gyroscope (rad/s)


class RuleRef(BaseModel):
    id: str
    title_fr: str
    confidence: str
    sources: list[dict]


class Shot(BaseModel):
    id: str
    intent: ShotIntent
    targets: ShotTargets
    rules: list[RuleRef]


class ShotSpec(BaseModel):
    scene_id: str
    status: str = "Brouillon IA : à valider"
    calibration: str = "v0-default"
    model: str
    generated_at: datetime
    shots: list[Shot]
