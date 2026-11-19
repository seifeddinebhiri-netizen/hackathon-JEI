from typing import Annotated

from fastapi import Depends

from app.core.auth import Caller, get_caller
from app.core.config import get_settings
from app.schemas.callsheet import CallsheetRequest, PreviewResponse, SendRequest, SendResponse
from app.services import callsheet

# Connexion obligatoire : sans elle, la route servirait à envoyer des e-mails à n'importe qui.
CallerDep = Annotated[Caller, Depends(get_caller)]


async def preview_callsheets(body: CallsheetRequest, caller: CallerDep) -> PreviewResponse:
    return callsheet.preview(body, get_settings())


async def send_callsheets(body: SendRequest, caller: CallerDep) -> SendResponse:
    return await callsheet.send(body, get_settings())
