from fastapi import APIRouter

from app.routes import (
    callsheets,
    health,
    planner,
    projects,
    scenario,
    scouting,
    screenplay,
    shot_spec,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(shot_spec.router)
api_router.include_router(scenario.router)
api_router.include_router(scouting.router)
api_router.include_router(planner.router)
api_router.include_router(projects.router)
api_router.include_router(callsheets.router)
api_router.include_router(screenplay.router)
