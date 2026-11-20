from typing import Literal

from pydantic import BaseModel


class VerifiedTool(BaseModel):
    slug: str
    status: str | None = None
    reviewed: bool = False


class PdfVerification(BaseModel):
    """Résultat de la vérification d'un PDF de Passeport déposé par un festival. Rien n'est conservé."""

    # none : aucune signature C2PA · invalid : fichier modifié ou signature cassée ·
    # valid : intact (signataire inconnu de la liste de confiance publique) · trusted : intact et de confiance
    state: Literal["none", "invalid", "valid", "trusted"]
    # Signé par NOTRE certificat (et pas par quelqu'un qui aurait copié nos informations).
    issued_by_us: bool = False
    signer: str | None = None
    issuer: str | None = None
    signing_mode: Literal["test", "production"] | None = None
    badge_code: str | None = None
    film_title: str | None = None
    issued_at: str | None = None
    tools: list[VerifiedTool] = []
    problems: list[str] = []
    # Le Passeport actuel correspond-il à celui du PDF ? None : impossible à dire (code inconnu...).
    matches_passport: bool | None = None
    reasons: list[str] = []
