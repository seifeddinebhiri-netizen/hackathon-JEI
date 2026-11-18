from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# Niveau de confiance affiché au relecteur (ASCII, comme dans le contrat front).
Confidence = Literal["elevee", "moyenne", "faible"]

SRT_TIME = r"^\d{2}:\d{2}:\d{2},\d{3}$"


# --- Transcription -----------------------------------------------------------------
class Word(BaseModel):
    """Un mot (ou un espace) renvoyé par la transcription, temps en secondes."""

    text: str
    start: float
    end: float
    logprob: float = 0.0
    speaker_id: str | None = None
    type: Literal["word", "spacing"] = "word"


class Transcript(BaseModel):
    words: list[Word]
    language_code: str | None = None  # langue détectée par le service, si renvoyée


# --- Découpage ---------------------------------------------------------------------
class Cue(BaseModel):
    """Sous-titre découpé, avant traduction."""

    id: str
    start: str = Field(pattern=SRT_TIME)
    end: str = Field(pattern=SRT_TIME)
    source: str
    speaker: str | None = None
    asr_confidence: float = Field(ge=0, le=1)


# --- Glossaire ---------------------------------------------------------------------
class GlossaryEntry(BaseModel):
    id: str
    variants: list[str]
    literal: str
    meaning: str
    fr: list[str]
    en: list[str]
    note: str = ""
    a_relire: bool = False


# --- Traduction --------------------------------------------------------------------
class TranslationContext(BaseModel):
    """Contexte envoyé au LLM avec un lot de lignes."""

    previous: str | None = None  # ligne juste avant le lot
    next: str | None = None  # ligne juste après le lot
    characters: list[str] = []
    glossary: list[GlossaryEntry] = []


class TranslatedLine(BaseModel):
    """Sortie imposée au LLM, une par ligne du lot."""

    id: str
    fr: str
    en: str
    confidence: Confidence
    note: str | None = None
    glossary_used: list[str] = []


class TranslationBatch(BaseModel):
    lines: list[TranslatedLine]


# --- Brouillon (contrat front) -----------------------------------------------------
class SubtitleWarning(BaseModel):
    rule: str  # ex. "lecture_rapide", "ligne_trop_longue"
    detail: str


class SubtitleLine(BaseModel):
    id: str
    start: str = Field(pattern=SRT_TIME)
    end: str = Field(pattern=SRT_TIME)
    source: str
    fr: str = ""
    en: str | None = None
    confidence: Confidence = "faible"
    note: str | None = None
    validated: bool = False
    # Champs optionnels, en plus du contrat initial
    speaker: str | None = None
    warnings: list[SubtitleWarning] = []
    glossary_used: list[str] = []


class SubtitleProcessing(BaseModel):
    """Traçabilité des outils utilisés (repris par le Passeport IA)."""

    transcriber: str  # ex. "elevenlabs/scribe_v2"
    translator: str  # ex. "gemini/gemini-3.8-flash"
    created_at: datetime


class SubtitleDraft(BaseModel):
    project_id: str
    source_lang: str
    lines: list[SubtitleLine]
    processing: SubtitleProcessing | None = None


class SubtitleSaveRequest(BaseModel):
    lines: list[SubtitleLine] = Field(max_length=5000)
