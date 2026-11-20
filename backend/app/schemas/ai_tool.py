from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

FactField = Literal[
    "training_data",  # sur quoi le modèle est entraîné (déclaration du fournisseur)
    "input_training_use",  # tes contenus servent-ils à entraîner ? opt-out ?
    "output_rights",  # propriété des sorties, usage commercial
    "provenance",  # marquage des sorties (C2PA, filigrane)
    "indemnity",  # qui indemnise qui en cas de litige de droits
    "voice_likeness",  # consentement pour voix / visage
]
SourceKind = Literal["terms", "privacy", "policy", "help", "model_card", "marketing"]
ToolStatus = Literal["documente", "partiel", "non_divulgue"]

# Les trois questions auxquelles un fournisseur doit répondre pour être « documenté ».
CORE_FIELDS: tuple[FactField, ...] = ("training_data", "input_training_use", "output_rights")

FIELD_LABELS_FR: dict[str, str] = {
    "training_data": "Données d'entraînement",
    "input_training_use": "Tes contenus et l'entraînement",
    "output_rights": "Droits sur les sorties",
    "provenance": "Marquage des sorties",
    "indemnity": "Indemnisation",
    "voice_likeness": "Voix et visage",
}
STATUS_LABELS_FR: dict[str | None, str] = {
    "documente": "Documenté",
    "partiel": "Partiel",
    "non_divulgue": "Non divulgué",
    None: "Non évalué",
}

ToolName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]


class Fact(BaseModel):
    id: str | None = None
    field: FactField
    plan: str = Field(default="all", max_length=40)
    value_fr: str = Field(min_length=1, max_length=600)
    quote: str = Field(min_length=1, max_length=500)
    source_url: str
    source_kind: SourceKind = "terms"
    quote_verified: bool = False
    human_confirmed: bool = False
    retrieved_at: str | None = None


class Tool(BaseModel):
    id: str
    slug: str
    name: str
    vendor: str
    official_site: str | None = None
    categories: list[str] = []
    terms_url: str | None = None
    privacy_url: str | None = None
    terms_updated: str | None = None
    status: ToolStatus | None = None
    review_state: Literal["a_verifier", "verifie"]
    research_state: Literal["none", "incomplete_access", "complete"]
    note_fr: str = ""
    checked_at: str | None = None
    reviewed_by: str | None = None
    reviewed_at: str | None = None
    facts: list[Fact] = []


class ResolveRequest(BaseModel):
    name: ToolName


class ResolveResponse(BaseModel):
    # found : déjà au catalogue ; researching : recherche lancée sur le serveur, à relire plus tard
    state: Literal["found", "researching"]
    tool: Tool | None = None
    run_id: str | None = None


class RunOut(BaseModel):
    id: str
    state: Literal["queued", "running", "done", "failed"]
    tool_slug: str | None = None
    error: str | None = None


# --- Sorties demandées au modèle pendant la recherche (jamais enregistrées telles quelles) ---
class LLMFact(BaseModel):
    field: FactField
    plan: str = Field(description="all, free, paid, consumer, api ou enterprise")
    value_fr: str = Field(description="Ce que dit la page, en une ou deux phrases en français.")
    quote: str = Field(description="Phrase copiée MOT POUR MOT de la page, 400 caractères au plus.")
    source_url: str = Field(description="URL de la page d'où vient la phrase.")
    source_kind: SourceKind


class LLMExtraction(BaseModel):
    vendor: str
    terms_updated: str | None = Field(
        default=None, description="Date lue sur la page, telle quelle."
    )
    categories: list[str]
    facts: list[LLMFact]


class LLMDiscovery(BaseModel):
    vendor: str
    official_site: str
    # Pages officielles probables (conditions, confidentialité, aide, fiche du modèle).
    page_urls: list[str]
