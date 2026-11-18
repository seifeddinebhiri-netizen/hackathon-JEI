from fastapi import APIRouter

from app.routes import (
    calibration,
    festivals,
    health,
    projects,
    shot_spec,
    subtitles,
    synopsis,
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
