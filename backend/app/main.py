from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.db.postgres import create_pool
from app.db.supabase import create_supabase
from app.middleware import register_middleware
from app.repositories import ai_tool_repository
from app.routes import api_router
from app.services.llm_service import LLMService
from app.services.research.runner import ResearchRunner
from app.services.rules_service import get_all_rules
from app.services.transcription_service import ElevenLabsTranscriber
from app.services.translation_service import create_translator


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging(settings.log_level, json_logs=settings.is_production)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.db_pool = await create_pool(settings)
        app.state.supabase = await create_supabase(settings)
        app.state.llm = LLMService(settings)
        app.state.tool_runner = None
        if app.state.db_pool is not None:
            try:
                await ai_tool_repository.mark_stale_runs_failed(app.state.db_pool)
            except Exception:  # noqa: BLE001 - migration 0009 pas encore exécutée
                structlog.get_logger().warning("ai_tools_tables_missing")
            app.state.tool_runner = ResearchRunner(
                app.state.db_pool, app.state.llm, settings.tool_research_concurrency
            )
        app.state.rules = get_all_rules()  # vide + avertissement si rules.json absent
        app.state.transcriber = ElevenLabsTranscriber(settings)
        app.state.translator = create_translator(settings)
        yield
        if app.state.db_pool is not None:
            await app.state.db_pool.close()

    app = FastAPI(
        title="Premier Plan API",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )
    register_middleware(app, settings)
    register_error_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
