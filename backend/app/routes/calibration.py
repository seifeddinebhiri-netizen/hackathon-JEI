from typing import Any

from fastapi import APIRouter

from app.controllers import calibration_controller

router = APIRouter(tags=["calibration"])

# Publique : tables de conversion (mots -> nombres) et libellés, identiques pour tout le monde.
router.add_api_route(
    "/calibration",
    calibration_controller.get_calibration,
    methods=["GET"],
    response_model=dict[str, Any],
)
