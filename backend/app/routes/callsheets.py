from fastapi import APIRouter

from app.controllers import callsheet_controller
from app.schemas.callsheet import PreviewResponse, SendResponse

router = APIRouter(prefix="/callsheets", tags=["callsheets"])

router.add_api_route(
    "/preview",
    callsheet_controller.preview_callsheets,
    methods=["POST"],
    response_model=PreviewResponse,
)
router.add_api_route(
    "/send",
    callsheet_controller.send_callsheets,
    methods=["POST"],
    response_model=SendResponse,
)
