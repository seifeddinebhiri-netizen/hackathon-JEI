import re
from enum import StrEnum
from typing import Annotated

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator

SnakeTag = Annotated[str, Field(pattern=r"^[a-z0-9]+(_[a-z0-9]+)*$")]


class Category(StrEnum):
    shot_size = "shot_size"
    framing = "framing"
    horizon = "horizon"
    angle = "angle"
    light = "light"
    continuity = "continuity"
    movement = "movement"
    smartphone = "smartphone"
    sound = "sound"
    documentary = "documentary"


class Measure(StrEnum):
    roll = "roll"
    pitch = "pitch"
    subject_h = "subject_h"
    center_x = "center_x"
    center_y = "center_y"
    headroom = "headroom"
    luma = "luma"
    contrast = "contrast"
    backlight = "backlight"
    sun_heading = "sun_heading"
    blur = "blur"
    shake = "shake"
    audio_level = "audio_level"
    none = "none"


class Confidence(StrEnum):
    high = "high"
    medium = "medium"
    low = "low"


class SourceType(StrEnum):
    book = "book"
    article = "article"
    official_doc = "official_doc"
    course = "course"
    encyclopedia = "encyclopedia"


class Source(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    author: str | None = None
    url: AnyHttpUrl
    type: SourceType


class NumericHint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    measure: str = Field(min_length=1)
    value: float
    unit: str = Field(min_length=1)


class Rule(BaseModel):
    """Règle de cinématographie. Sans source, la règle est refusée."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^R-\d{3}$")
    category: Category
    title_fr: str = Field(min_length=1)
    rule_fr: str = Field(min_length=1)
    why_fr: str = Field(min_length=1)
    measurable: list[Measure] = Field(min_length=1)
    numeric_hint: NumericHint | None = None
    applies_when: list[SnakeTag]
    confidence: Confidence
    sources: list[Source] = Field(min_length=1)
    notes: str | None = None

    @field_validator("id")
    @classmethod
    def _id_format(cls, v: str) -> str:
        if not re.fullmatch(r"R-\d{3}", v):
            raise ValueError("id doit respecter le format R-001")
        return v
