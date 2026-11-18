from fastapi import APIRouter

from app.routes import festivals, health, shot_spec, subtitles

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(shot_spec.router)
api_router.include_router(festivals.router)
api_router.include_router(subtitles.router)
