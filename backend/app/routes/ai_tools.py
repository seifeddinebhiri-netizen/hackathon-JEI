from fastapi import APIRouter, Depends

from app.controllers import ai_tool_controller as c
from app.core.rate_limit import limit_tool_resolve
from app.schemas.ai_tool import ResolveResponse, RunOut, Tool

router = APIRouter(prefix="/ai-tools", tags=["ai-tools"])

# Pas de route qui lance la recherche directement : `resolve` est la seule porte d'entrée, et elle ne
# lance une recherche que si l'outil est absent du catalogue.
router.add_api_route("", c.list_tools, methods=["GET"], response_model=list[Tool])
router.add_api_route(
    "/resolve",
    c.resolve_tool,
    methods=["POST"],
    response_model=ResolveResponse,
    dependencies=[Depends(limit_tool_resolve)],
)
router.add_api_route("/runs/{run_id}", c.get_run, methods=["GET"], response_model=RunOut)
router.add_api_route("/{slug}", c.get_tool, methods=["GET"], response_model=Tool)
