from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Department = Literal[
    "scenario", "image", "montage", "son_voix", "musique", "vfx", "sous_titres", "affiche_promo"
]
UsageLevel = Literal["assistance", "generation_partielle", "generation_complete"]

DEPARTMENT_LABELS: dict[str, str] = {
    "scenario": "Scénario",
    "image": "Image",
    "montage": "Montage",
    "son_voix": "Son et voix",
    "musique": "Musique",
    "vfx": "Effets visuels",
    "sous_titres": "Sous-titres",
    "affiche_promo": "Affiche et promotion",
}
LEVEL_LABELS: dict[str, str] = {
    "assistance": "Assistance",
    "generation_partielle": "Génération partielle",
    "generation_complete": "Génération complète",
}
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1500)]

# Mention obligatoire sur tout passeport (README) : jamais « légal » ni « sûr ».
DISCLAIMER_FR = "Déclaration fondée sur la documentation publique. Ce n'est pas un avis juridique."


class Declaration(BaseModel):
    """Ce que le cinéaste déclare pour un département (même forme que le front)."""

    department: Department
    used_ai: bool
    tool_slug: str | None = Field(default=None, max_length=60)  # outil du catalogue
    custom_tool: str | None = Field(default=None, max_length=80)  # outil absent du catalogue
    what: Text = ""
    level: UsageLevel | None = None
    human_decisions: Text = ""


class PassportDocument(BaseModel):
    """Tout ce qu'il faut pour fabriquer le PDF. Les fiches d'outils sont passées à part, lues dans
    le catalogue : le PDF montre toujours l'état du catalogue au moment de l'émission."""

    passport_id: str = Field(min_length=1, max_length=64)
    badge_code: str = Field(min_length=1, max_length=40)
    film_title: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
    ]
    director: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    issued_at: datetime
    verify_url: str | None = Field(default=None, max_length=300)
    # Empreinte SHA-256 du film (facultatif) : un festival peut vérifier que SON fichier est celui déclaré.
    film_sha256: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    declarations: list[Declaration] = Field(min_length=1, max_length=8)
