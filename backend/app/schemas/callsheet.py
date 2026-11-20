"""Convocations (feuilles de service) envoyées par e-mail aux membres de l'équipe.

Contrat : web/src/api/types.ts (section « Convocations »). Le serveur compose lui-même les
e-mails à partir des données du planning : le navigateur n'envoie jamais de HTML, seulement
l'objet et le message personnel modifiés par le réalisateur.
"""

import re
from datetime import date
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

MAX_RECIPIENTS = 50  # destinataires par appel
MAX_SCENES = 1_000
EMAIL_RE = re.compile(r"^[^@\s<>\"',;]+@[^@\s<>\"',;]+\.[A-Za-z]{2,}$")

Moment = Literal["jour", "nuit", "aube", "heure_doree"]
MemberRole = Literal["acteur", "technicien"]
Hhmm = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]


def is_valid_email(value: str) -> bool:
    return bool(EMAIL_RE.match(value.strip())) and len(value) <= 254


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class Member(_Base):
    """Membre de l'équipe (stocké dans le projet, champ `members`)."""

    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(default="", max_length=254)
    role: MemberRole
    # Acteurs : noms de personnages issus du découpage
    characters: list[str] = Field(default_factory=list, max_length=50)
    email_consent: bool = False
    # Pour la liste de l'équipe seulement : jamais mis dans les e-mails
    phone: str = Field(default="", max_length=40)
    job: str = Field(default="", max_length=80)


class CallsheetProject(_Base):
    title: str = Field(min_length=1, max_length=200)
    director_name: str = Field(default="", max_length=120)
    reply_to: str = Field(default="", max_length=254)
    timezone: str = Field(default="Africa/Tunis", max_length=64)

    @field_validator("timezone")
    @classmethod
    def _known_timezone(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("fuseau horaire inconnu") from None
        return v


class CallsheetLocation(_Base):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(max_length=200)
    address: str = Field(default="", max_length=500)


class PlannedScene(_Base):
    id: str = Field(min_length=1, max_length=64)
    number: str = Field(max_length=20)
    title: str = Field(default="", max_length=300)
    date: date
    call_time: Hhmm  # heure de rendez-vous
    start: Hhmm | None = None
    end: Hhmm | None = None
    location_id: str = Field(default="", max_length=64)
    moment: Moment = "jour"
    characters: list[str] = Field(default_factory=list, max_length=100)
    notes: str = Field(default="", max_length=2_000)
    # Texte de la scène : envoyé par le front seulement si un membre doit le recevoir
    text: str | None = Field(default=None, max_length=5_000)

    @field_validator("start", "end", mode="before")
    @classmethod
    def _empty_is_none(cls, v):
        return v or None


class CallsheetRequest(_Base):
    project: CallsheetProject
    scenes: list[PlannedScene] = Field(max_length=MAX_SCENES)
    locations: list[CallsheetLocation] = Field(default_factory=list, max_length=500)
    members: list[Member] = Field(max_length=200)
    # Par défaut, aucun texte de scène dans les e-mails
    include_scene_text: bool = False
    # Membres qui reçoivent le texte de LEURS scènes (en plus de include_scene_text)
    include_scene_text_for: list[str] = Field(default_factory=list, max_length=200)


class DraftScene(BaseModel):
    number: str
    title: str
    date: date
    call_time: str
    start: str | None
    end: str | None
    location_name: str
    address: str
    moment_label: str
    characters: list[str]
    notes: str
    text: str | None


class CallsheetDraft(BaseModel):
    member_id: str
    name: str
    role: MemberRole
    to: str
    subject: str
    # Message personnel, modifiable par le réalisateur
    message: str
    # Planning du membre, généré : ajouté sous le message
    schedule_text: str
    # E-mail complet (message + planning)
    text: str
    html: str
    scenes: list[DraftScene]
    ics: str
    ics_filename: str
    include_scene_text: bool
    # Raison pour laquelle l'envoi sera refusé (sans e-mail valide, sans consentement)
    blocked_reason: str | None = None


class NotConcerned(BaseModel):
    member_id: str
    name: str
    reason: str


class PreviewResponse(BaseModel):
    drafts: list[CallsheetDraft]
    not_concerned: list[NotConcerned]
    # False : pas de RESEND_API_KEY, l'envoi sera un essai
    email_configured: bool


class DraftEdit(_Base):
    """Brouillon validé par le réalisateur. Les absents de la liste ne reçoivent rien."""

    member_id: str = Field(min_length=1, max_length=64)
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(max_length=10_000)
    include_scene_text: bool = False


class SendRequest(CallsheetRequest):
    drafts: list[DraftEdit] = Field(min_length=1, max_length=MAX_RECIPIENTS)


SendStatus = Literal["envoye", "essai", "ignore", "erreur"]


class SendResult(BaseModel):
    member_id: str
    name: str
    to: str
    status: SendStatus
    reason: str | None = None
    subject: str | None = None  # en mode essai : ce qui aurait été envoyé


class SendResponse(BaseModel):
    dry_run: bool
    results: list[SendResult]
    sent: int
    skipped: int
    failed: int
