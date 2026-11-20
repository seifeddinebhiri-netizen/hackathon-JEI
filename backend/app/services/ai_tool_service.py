import asyncpg

from app.core.auth import CurrentUser
from app.core.config import get_settings
from app.core.errors import AppError
from app.repositories import ai_tool_repository as repo
from app.schemas.ai_tool import Fact, ResolveResponse, RunOut, Tool
from app.services.tool_names import normalize_name


def _tool(row: dict, facts: list[dict]) -> Tool:
    return Tool(
        **{k: row[k] for k in (
            "id", "slug", "name", "vendor", "official_site", "categories", "terms_url",
            "privacy_url", "terms_updated", "status", "review_state", "research_state",
            "note_fr", "checked_at", "reviewed_by", "reviewed_at",
        )},
        facts=[
            Fact(**{k: f[k] for k in (
                "id", "field", "plan", "value_fr", "quote", "source_url", "source_kind",
                "quote_verified", "human_confirmed", "retrieved_at",
            )})
            for f in facts
        ],
    )  # fmt: skip


async def search_tools(pool, q: str) -> list[Tool]:
    rows = await repo.search(pool, q)
    facts = await repo.facts_for(pool, [r["id"] for r in rows])
    return [_tool(r, facts.get(r["id"], [])) for r in rows]


async def get_tool(pool, slug: str) -> Tool:
    row = await repo.get_by_slug(pool, slug)
    if row is None:
        raise AppError("Outil introuvable.", status_code=404, code="introuvable")
    facts = await repo.facts_for(pool, [row["id"]])
    return _tool(row, facts.get(row["id"], []))


async def resolve(pool, runner, user: CurrentUser, name: str) -> ResolveResponse:
    """Outil connu : on le renvoie. Outil absent : une recherche guidée est lancée sur le serveur
    (le client reçoit un numéro de recherche à relire, il ne peut ni la configurer ni la forcer)."""
    norm = normalize_name(name)
    if len(norm) < 2:
        raise AppError("Nom d'outil invalide.", status_code=422, code="nom_invalide")
    row = await repo.find_by_alias(pool, norm)
    if row is not None:
        facts = await repo.facts_for(pool, [row["id"]])
        return ResolveResponse(state="found", tool=_tool(row, facts.get(row["id"], [])))

    if runner is None:
        raise AppError("Recherche indisponible.", status_code=503, code="recherche_indisponible")
    if await repo.count_runs_today(pool) >= get_settings().tool_research_daily_limit:
        raise AppError(
            "Limite quotidienne de recherches atteinte. Réessaie demain ou choisis un outil du catalogue.",
            status_code=429,
            code="trop_de_requetes",
        )
    run, created = await repo.create_run(pool, norm, user.id)
    if created:
        runner.start(run["id"], name.strip())
    return ResolveResponse(state="researching", run_id=run["id"])


async def get_run(pool, user: CurrentUser, run_id: str) -> RunOut:
    try:
        run = await repo.get_run(pool, run_id)
    except (ValueError, asyncpg.DataError):  # identifiant qui n'est pas un uuid
        run = None
    # Même message pour « n'existe pas » et « pas à toi » : on ne révèle rien.
    if run is None or run["requested_by"] != user.id:
        raise AppError("Recherche introuvable.", status_code=404, code="introuvable")
    return RunOut(
        id=run["id"], state=run["state"], tool_slug=run.get("tool_slug"), error=run["error"]
    )
