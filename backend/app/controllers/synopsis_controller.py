from typing import Annotated

from fastapi import Depends, Request

from app.core.auth import CurrentUser, get_current_user
from app.schemas.synopsis import SynopsisTranslateRequest, SynopsisTranslation
from app.services import synopsis_service


async def translate_synopsis(
    body: SynopsisTranslateRequest,
    request: Request,
    user: Annotated[CurrentUser, Depends(get_current_user)],  # appel payant : jamais sans compte
) -> SynopsisTranslation:
    """POST /synopsis/translate : version anglaise du texte de l'auteur (brouillon IA)."""
    return await synopsis_service.translate(request.app.state.translator, body)
