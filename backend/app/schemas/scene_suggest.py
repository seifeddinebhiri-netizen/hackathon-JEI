"""Suggestions de TOURNAGE sur les scènes du scénario (jamais d'écriture).

L'IA ne touche ni à l'histoire, ni aux dialogues, ni aux personnages : elle propose de préciser
INT/EXT ou le moment, de regrouper deux décors, d'alléger une scène coûteuse à tourner, ou signale
une information manquante. L'auteur accepte ou refuse chaque suggestion ; une suggestion acceptée
peut modifier la scène dans le plan (champs `change_*`, vocabulaire fermé).
"""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.location_suggest import FilmContext

SuggestionKind = Literal[
    "preciser_int_ext", "preciser_moment", "regrouper_decors", "alleger_scene", "info_manquante"
]
Moment = Literal["jour", "nuit", "aube", "heure_doree"]


class SceneForSuggest(BaseModel):
    number: str = Field(max_length=20)
    title: str = Field(default="", max_length=300)
    setting: Literal["INT", "EXT"]
    moment: Moment
    decor: str = Field(default="", max_length=200)
    summary: str = Field(default="", max_length=2000)
    characters: list[str] = Field(default_factory=list, max_length=40)
    estimated_hours: float = Field(default=1, ge=0, le=48)
    excerpt: str | None = Field(default=None, max_length=1200)


class SceneSuggestRequest(BaseModel):
    film: FilmContext
    scenes: list[SceneForSuggest] = Field(min_length=1, max_length=120)
    decors: list[str] = Field(default_factory=list, max_length=60)


class LLMSceneSuggestion(BaseModel):
    scene_numbers: list[str] = Field(description="Numéros des scènes concernées (existants).")
    kind: SuggestionKind
    message: str = Field(description="Une ou deux phrases simples, pour un scénariste.")
    source: str = Field(
        description="Ce qui, dans le texte, justifie la suggestion (courte citation ou fait)."
    )
    change_setting: Literal["INT", "EXT"] | None = Field(
        description="Seulement pour preciser_int_ext, sinon null."
    )
    change_moment: Moment | None = Field(description="Seulement pour preciser_moment, sinon null.")
    change_decor: str | None = Field(
        description="Seulement pour regrouper_decors : nom EXACT d'un décor de la liste, sinon null."
    )


class LLMSceneSuggestions(BaseModel):
    suggestions: list[LLMSceneSuggestion]


class SceneSuggestion(LLMSceneSuggestion):
    id: str


class SceneSuggestResponse(BaseModel):
    status: Literal["Brouillon IA : à valider"] = "Brouillon IA : à valider"
    suggestions: list[SceneSuggestion]
    model: str
