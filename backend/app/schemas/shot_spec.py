"""Contrat du shot spec.

Deux niveaux :
- `ShotIntent` / `LLMMovingPlan` : ce que le LLM produit. Vocabulaire fermé (enums), aucun nombre inventé.
  Un plan fixe = un seul cadrage ; un plan en mouvement = une chronologie de passages (en secondes).
- `ShotTargets` : plages numériques calculées par le serveur (services/calibration.py),
  que le téléphone compare aux mesures en direct.
"""

from datetime import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator


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


class ShotChoices(BaseModel):
    """Le cadrage d'un plan, avec un vocabulaire fermé (aucun nombre inventé)."""

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


class ShotIntent(ShotChoices):
    """Un plan : son cadrage et les textes qui l'expliquent."""

    label_fr: str
    why_fr: str
    rule_ids: list[str]
    advice_fr: list[str]  # conseils non mesurables (hauteur caméra, son, etc.)


# --- Ce que produit le LLM : un prompt et un schéma par type de scène ---


class LLMStaticPlan(BaseModel):
    """Plan fixe : UN seul plan."""

    shot: ShotIntent


class LLMSegment(BaseModel):
    """Un passage d'un plan en mouvement. Les secondes se comptent depuis le début de la prise."""

    start_s: float
    end_s: float
    description_fr: str  # ce qui se passe et comment la caméra bouge pendant ce passage
    at_start: ShotChoices
    # Si le cadrage évolue en douceur pendant le passage (ex. caméra de la contre-plongée à la
    # plongée, sujet de la droite vers la gauche) : le cadrage à la fin. Sinon null.
    at_end: ShotChoices | None = None


class LLMMovingPlan(BaseModel):
    """Plan en mouvement : UNE prise décrite par des passages qui couvrent toute la durée."""

    label_fr: str
    why_fr: str
    how_fr: str  # comment la scène sera filmée, en français, avec les secondes
    advice_fr: list[str]
    rule_ids: list[str]
    segments: list[LLMSegment]


# --- Requête / réponse de l'API ---


class TimeOfDay(StrEnum):
    jour = "jour"
    nuit = "nuit"
    aube = "aube"
    heure_doree = "heure_doree"


class Support(StrEnum):
    handheld = "handheld"
    tripod = "tripod"
    unknown = "unknown"


Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class Motion(StrEnum):
    unknown = "unknown"
    fixed = "fixed"  # plan fixe
    moving = "moving"  # plan en mouvement (panoramique, tilt, travelling)


class ShotSpecRequest(BaseModel):
    """Une scène et tout ce qui aide l'IA à proposer un meilleur plan.

    Seule `description` est obligatoire. Les autres champs sont des étiquettes facultatives :
    plus elles sont renseignées, plus le plan est adapté.
    """

    description: str = Field(min_length=10, max_length=2000)
    scene_id: str | None = Field(default=None, max_length=64)
    setting: SceneSetting = SceneSetting.unknown
    moment: TimeOfDay | None = None
    location: str | None = Field(default=None, max_length=200)
    characters: list[Tag] = Field(default_factory=list, max_length=8)
    mood: list[Tag] = Field(default_factory=list, max_length=5)  # ambiance : tendue, intime...
    visual_style: str | None = Field(default=None, max_length=120)  # documentaire, onirique...
    intention: str | None = Field(
        default=None, max_length=400
    )  # ce que le spectateur doit ressentir
    light: str | None = Field(default=None, max_length=200)  # lumière disponible
    support: Support = Support.unknown  # à main levée ou trépied
    motion: Motion = Motion.unknown  # plan fixe ou en mouvement
    # Durée estimée de la scène, en secondes : sert aux plans en mouvement (les passages se comptent
    # depuis le début de la prise). Ignorée pour un plan fixe.
    duration_s: float | None = Field(default=None, ge=2, le=120)

    @model_validator(mode="after")
    def _moving_needs_a_duration(self):
        if self.motion == Motion.moving and self.duration_s is None:
            raise ValueError("Pour un plan en mouvement, indique la durée estimée de la scène.")
        return self

    @field_validator("setting", mode="before")
    @classmethod
    def _accept_front_values(cls, v):
        """Le front écrit INT / EXT (contrat des scènes) ; on les accepte."""
        return {"INT": "interior", "EXT": "exterior"}.get(v, v) if isinstance(v, str) else v


class Range(BaseModel):
    min: float
    max: float


class ShotTargets(BaseModel):
    """Plages numériques cibles. Valeurs v0 à calibrer sur le terrain."""

    roll_abs_deg: Range  # valeur absolue de l'inclinaison de l'horizon
    # Plan en mouvement : pas de cadrage fixe à viser (pitch, sujet, tremblement = None).
    pitch_deg: Range | None  # + = caméra vers le haut, - = vers le bas
    subject_h: Range | None  # hauteur du sujet / hauteur de l'image
    center_x: Range | None
    center_y: Range | None
    headroom: Range | None
    luma: Range
    contrast: Range
    backlight_ratio_max: float | None
    sun_offset_abs_deg: Range | None  # écart absolu (0-180) cap caméra vs azimut du soleil
    shake_max: float | None  # vitesse de rotation RMS du gyroscope (rad/s)


class RuleRef(BaseModel):
    id: str
    title_fr: str
    confidence: str
    sources: list[dict]


class TimelineSegment(BaseModel):
    """Un passage de la chronologie, avec les cibles chiffrées au début (et à la fin s'il évolue)."""

    id: str
    start_s: float
    end_s: float
    description_fr: str
    at_start: ShotChoices
    at_end: ShotChoices | None
    targets_start: ShotTargets
    targets_end: ShotTargets | None


class Timeline(BaseModel):
    duration_s: float
    how_fr: str
    segments: list[TimelineSegment]


class Shot(BaseModel):
    id: str
    intent: ShotIntent  # plan en mouvement : le cadrage du premier passage
    targets: ShotTargets  # plan en mouvement : les cibles du premier passage
    rules: list[RuleRef]
    timeline: Timeline | None = None  # seulement pour un plan en mouvement


class ShotSpec(BaseModel):
    scene_id: str
    status: str = "Brouillon IA : à valider"
    calibration: str = "v0-default"
    model: str
    generated_at: datetime
    shots: list[Shot]
