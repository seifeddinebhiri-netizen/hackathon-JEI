from fastapi import APIRouter

from app.controllers import synopsis_controller
from app.schemas.synopsis import SynopsisTranslation

router = APIRouter(prefix="/synopsis", tags=["synopsis"])

router.add_api_route(
    "/translate",
    synopsis_controller.translate_synopsis,
    methods=["POST"],
    response_model=SynopsisTranslation,
)
