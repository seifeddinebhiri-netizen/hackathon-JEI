from fastapi import APIRouter

from app.routes import (
    ai_tools,
    calibration,
    festivals,
    health,
    passports,
    projects,
    shot_spec,
    subtitles,
    synopsis,
    verify,
    workspaces,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(calibration.router)
api_router.include_router(projects.router)
api_router.include_router(shot_spec.router)
api_router.include_router(workspaces.router)
api_router.include_router(festivals.router)
api_router.include_router(subtitles.router)
api_router.include_router(synopsis.router)
api_router.include_router(ai_tools.router)
api_router.include_router(passports.router)
api_router.include_router(verify.router)
