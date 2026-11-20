from typing import Annotated

from fastapi import File, Form, Request, UploadFile

from app.core.config import get_settings
from app.schemas.screenplay import ParseScreenplayResult
from app.services.screenplay.llm import ScreenplayLLM
from app.services.screenplay.pipeline import parse_screenplay
from app.services.screenplay.reader import MAX_BYTES, read_screenplay


def _llm(request: Request) -> ScreenplayLLM:
    """Client créé à la première utilisation, puis partagé."""
    llm = getattr(request.app.state, "screenplay_llm", None)
    if llm is None:
        llm = ScreenplayLLM(get_settings())
        request.app.state.screenplay_llm = llm
    return llm


async def parse(
    request: Request,
    file: Annotated[UploadFile | None, File()] = None,
    text: Annotated[str | None, Form()] = None,
    use_ai: Annotated[bool, Form()] = True,
) -> ParseScreenplayResult:
    """Fichier (PDF, DOCX, TXT, Fountain, FDX) ou texte collé → scènes, lieux, personnages.

    Le texte du scénario n'est ni journalisé ni stocké.
    """
    data = await file.read(MAX_BYTES + 1) if file is not None else None
    content = read_screenplay(text=text, filename=file.filename if file else None, data=data)
    return await parse_screenplay(content, _llm(request) if use_ai else None)
