from fastapi import APIRouter

from app.routes import health, planner, shot_spec

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(shot_spec.router)
api_router.include_router(planner.router)
