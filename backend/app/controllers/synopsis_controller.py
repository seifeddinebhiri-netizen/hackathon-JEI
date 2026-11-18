from fastapi import Request

from app.schemas.synopsis import SynopsisTranslateRequest, SynopsisTranslation
from app.services import synopsis_service


async def translate_synopsis(
    body: SynopsisTranslateRequest, request: Request
) -> SynopsisTranslation:
    """POST /synopsis/translate : version anglaise du texte de l'auteur (brouillon IA)."""
    return await synopsis_service.translate(request.app.state.translator, body)
