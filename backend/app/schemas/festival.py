from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

# Politique IA telle qu'écrite dans le règlement du festival.
# - acceptee : l'IA est explicitement autorisée
# - a_declarer : l'IA est autorisée mais doit être déclarée
# - interdite : l'IA générative est refusée
# - section_dediee : les films faits entièrement par IA vont dans une section à part
# - non_precisee : le règlement ne dit rien (statut honnête, pas une autorisation)
AiPolicy = Literal["acceptee", "a_declarer", "interdite", "section_dediee", "non_precisee"]

RequirementKind = Literal[
    "sous_titres",
    "synopsis",
    "photos",
    "affiche",
    "bande_annonce",
    "bio",
    "declaration_ia",
    "droits_musique",
    "format",
]

# Calculé à la lecture, jamais stocké (sinon il devient faux le lendemain de la date limite).
DeadlineStatus = Literal["ouverte", "passee", "a_confirmer"]


class FestivalRequirement(BaseModel):
    kind: RequirementKind
    detail: str
    limit_chars: int | None = None


class Festival(BaseModel):
    id: str
    name: str
    country: str
    city: str | None = None
    edition: str | None = None
    deadline: date | None = None
    deadline_status: DeadlineStatus
    deadline_note: str | None = None
    fee: str
    max_duration_min: int | None = None
    subtitle_langs: list[str] = Field(default_factory=list)
    ai_policy: AiPolicy = "non_precisee"
    ai_policy_detail: str | None = None
    eligibility: str | None = None
    requirements: list[FestivalRequirement] = Field(default_factory=list)
    source_url: str
    checked_at: date


class FilmProfile(BaseModel):
    """Ce qu'on sait du film pour le comparer aux critères des festivals."""

    duration_min: int | None = Field(default=None, ge=1, le=600)
    language: str | None = None
    genre: str | None = None
    declared_ai_departments: int = Field(default=0, ge=0, le=20)


class FestivalFilters(BaseModel):
    q: str | None = None
    country: str | None = None
    max_duration_min: int | None = Field(default=None, ge=1)
    fee: Literal["gratuit", "payant"] | None = None
    deadline_before: date | None = None
    subtitle_lang: str | None = None
    ai_policy: AiPolicy | None = None
    open_only: bool = False


class FestivalMatchRequest(BaseModel):
    """Corps de POST /festivals/match : le film + les mêmes filtres que GET /festivals."""

    film: FilmProfile
    filters: FestivalFilters = Field(default_factory=FestivalFilters)


class FestivalMatch(BaseModel):
    festival: Festival
    # Compatibilité avec les critères du festival. Ne prédit PAS la sélection.
    score: int = Field(ge=1, le=5)
    reasons: list[str]
    warnings: list[str]
