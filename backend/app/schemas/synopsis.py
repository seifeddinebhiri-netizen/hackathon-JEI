from typing import Literal

from pydantic import BaseModel, Field

SynopsisKind = Literal["phrase", "court", "long"]


class SynopsisTranslateRequest(BaseModel):
    """POST /synopsis/translate : même forme que le mock du front (+ limit_chars optionnel)."""

    kind: SynopsisKind
    text: str = Field(max_length=10000)
    target_lang: Literal["en"]
    limit_chars: int | None = Field(default=None, ge=1, le=10000)


class SynopsisTranslation(BaseModel):
    """Réponse, et aussi la sortie JSON demandée au LLM."""

    text: str
