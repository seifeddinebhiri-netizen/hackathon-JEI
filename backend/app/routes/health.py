from fastapi import APIRouter

from app.controllers import health_controller
from app.schemas.health import LiveResponse, ReadyResponse

router = APIRouter(tags=["health"])

router.add_api_route(
    "/health", health_controller.live, methods=["GET"], response_model=LiveResponse
)
router.add_api_route(
    "/health/ready", health_controller.ready, methods=["GET"], response_model=ReadyResponse
)
