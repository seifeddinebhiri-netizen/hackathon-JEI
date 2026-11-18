"""Contrat de POST /planner/parse.

Les champs `Scene`, `Location` et `ParseScreenplayResult` reprennent exactement les types du front
(`web/src/api/types.ts`). Les champs en plus (`page_eighths`, `location_brief`, `rooms`...) sont
ignorés par le schéma zod du front et servent au module de suggestion de lieux (RAG).
"""

from enum import StrEnum

from pydantic import BaseModel, Field


class SceneMoment(StrEnum):
    jour = "jour"
    nuit = "nuit"
    aube = "aube"
    heure_doree = "heure_doree"


class SceneSetting(StrEnum):
    INT = "INT"
    EXT = "EXT"


class Location(BaseModel):
    id: str
    name: str
    address: str = ""
    forbidden_days: list[str] = Field(default_factory=list)
    permit: str = "non_necessaire"
    notes: str | None = None
    # --- extras backend (RAG lieux) ---
    rooms: list[str] = Field(
        default_factory=list, description="Pièces / sous-lieux vus dans les en-têtes"
    )
    settings: list[SceneSetting] = Field(default_factory=list)
    scene_numbers: list[str] = Field(default_factory=list)
    kind_fr: str | None = Field(None, description="Type de lieu proposé par l'IA (ex. « café »)")
    brief_fr: str | None = Field(
        None, description="À quoi le lieu doit ressembler : requête pour la base de lieux (RAG)"
    )


class Scene(BaseModel):
    id: str
    number: str
    title: str
    setting: SceneSetting
    moment: SceneMoment
    location_id: str
    characters: list[str]
    estimated_hours: float
    summary: str
    source: str = "import_ia"
    validated: bool = False
    # --- extras backend ---
    heading: str = Field("", description="En-tête d'origine, tel qu'écrit")
    room: str | None = None
    speaking_characters: list[str] = Field(default_factory=list)
    page_eighths: int = Field(0, description="Longueur en huitièmes de page (convention plateau)")
    location_brief: str | None = Field(None, description="Description du lieu pour le RAG")
    moment_guessed: bool = Field(False, description="Moment absent ou ambigu dans l'en-tête")


class ParseScreenplayResult(BaseModel):
    scenes: list[Scene]
    locations: list[Location]
    characters: list[str]
    warnings: list[str]
    ai_used: bool = False


# ---------------------------------------------------------------------------
# Sorties structurées demandées au LLM (jamais renvoyées telles quelles)
# ---------------------------------------------------------------------------


class LLMSceneInfo(BaseModel):
    number: str = Field(description="Numéro de scène, recopié tel quel depuis l'entrée")
    title_fr: str = Field(description="Titre court (≤ 8 mots) qui dit ce qui se passe")
    summary_fr: str = Field(description="Résumé factuel en 1 à 2 phrases, sans interprétation")
    silent_characters: list[str] = Field(
        description="Personnages présents dans la scène sans y parler, écrits comme dans le texte"
    )
    location_brief_fr: str = Field(
        description=(
            "Ce que le lieu doit montrer à l'image pour cette scène (ambiance, éléments visibles, "
            "taille), en une phrase. Jamais d'adresse ni de lieu réel inventé."
        )
    )


class LLMCharacterGroup(BaseModel):
    canonical: str = Field(description="Nom retenu, pris parmi les noms fournis")
    aliases: list[str] = Field(
        description="Autres graphies du MÊME personnage, prises parmi les noms fournis"
    )


class LLMLocationInfo(BaseModel):
    key: str = Field(description="Clé du lieu, recopiée telle quelle depuis l'entrée")
    kind_fr: str = Field(description="Type de lieu en 1 à 3 mots (ex. « café », « plage »)")
    brief_fr: str = Field(
        description="Ce qu'il faut trouver comme lieu réel pour tourner, en une phrase"
    )


class LLMScreenplayAnalysis(BaseModel):
    scenes: list[LLMSceneInfo]
    character_groups: list[LLMCharacterGroup]
    locations: list[LLMLocationInfo]


class LLMBoundary(BaseModel):
    start_line: int = Field(
        description="Numéro de la première ligne de la scène (numérotation fournie)"
    )
    setting: SceneSetting
    place: str = Field(description="Lieu, en quelques mots, tel que le texte le suggère")
    moment: SceneMoment


class LLMSegmentation(BaseModel):
    scenes: list[LLMBoundary]
