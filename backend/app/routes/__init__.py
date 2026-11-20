from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.routes import (
    ai_tools,
    calibration,
    callsheets,
    festivals,
    health,
    planner,
    passports,
    projects,
    scenario,
    scouting,
    screenplay,
    shot_spec,
    subtitles,
    synopsis,
    verify,
    workspaces,
)

api_router = APIRouter()
# Routes du Planner : connexion exigée (jeton Supabase ou connexion de démo).
_private = [Depends(get_current_user)]
api_router.include_router(health.router)
api_router.include_router(calibration.router)
api_router.include_router(projects.router)
api_router.include_router(shot_spec.router)
api_router.include_router(scenario.router, dependencies=_private)
api_router.include_router(scouting.router, dependencies=_private)
api_router.include_router(planner.router, dependencies=_private)
api_router.include_router(callsheets.router)
api_router.include_router(screenplay.router, dependencies=_private)
api_router.include_router(workspaces.router)
api_router.include_router(festivals.router)
api_router.include_router(subtitles.router)
api_router.include_router(synopsis.router)
api_router.include_router(ai_tools.router)
api_router.include_router(passports.router)
api_router.include_router(verify.router)
