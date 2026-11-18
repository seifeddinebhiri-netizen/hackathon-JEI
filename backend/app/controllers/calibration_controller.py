from typing import Any

from app.services.calibration_service import build_calibration


async def get_calibration() -> dict[str, Any]:
    return build_calibration()
