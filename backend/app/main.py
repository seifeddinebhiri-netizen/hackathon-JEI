from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.db.postgres import create_pool
from app.db.supabase import create_supabase
from app.middleware import register_middleware
from app.routes import api_router
from app.services.llm_service import LLMService
from app.services.rules_service import get_all_rules
from app.services.scouting_service import ScoutingService


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging(settings.log_level, json_logs=settings.is_production)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.db_pool = await create_pool(settings)
        app.state.supabase = await create_supabase(settings)
        app.state.llm = LLMService(settings)
        app.state.scouting = ScoutingService(settings)
        app.state.rules = get_all_rules()  # vide + avertissement si rules.json absent
        yield
        await app.state.scouting.client.aclose()
        if app.state.db_pool is not None:
            await app.state.db_pool.close()

    app = FastAPI(
        title="Encadré API",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )
    register_middleware(app, settings)
    register_error_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
