import asyncio

import structlog

from app.core.errors import AppError
from app.repositories import ai_tool_repository as repo
from app.services.llm_service import LLMUnavailable
from app.services.research.pipeline import ResearchFailed, run_research

log = structlog.get_logger()


class ResearchRunner:
    """Lance la recherche d'un outil absent du catalogue, DANS le serveur.

    Aucune route n'expose ce lanceur : seul `ai_tool_service.resolve` l'appelle, quand un outil est
    absent. Au plus `concurrency` recherches en même temps ; une seule par nom (index unique en base)."""

    def __init__(self, pool, llm, concurrency: int = 2):
        self._pool = pool
        self._llm = llm
        self._sem = asyncio.Semaphore(max(1, concurrency))
        self._tasks: set[asyncio.Task] = set()

    def start(self, run_id: str, name: str) -> None:
        task = asyncio.create_task(self._work(run_id, name))
        self._tasks.add(task)  # référence forte : sinon la tâche peut être ramassée en route
        task.add_done_callback(self._tasks.discard)

    async def _work(self, run_id: str, name: str) -> None:
        async with self._sem:
            try:
                await repo.update_run(self._pool, run_id, "running")
                result = await run_research(name, self._llm)
                tool = await repo.save_tool(
                    self._pool,
                    slug=result.slug,
                    name=result.name,
                    vendor=result.vendor,
                    official_site=result.official_site,
                    categories=result.categories,
                    terms_url=result.terms_url,
                    privacy_url=result.privacy_url,
                    terms_updated=result.terms_updated,
                    status=result.status,
                    review_state="a_verifier",  # jamais « vérifié » sans relecture humaine
                    research_state="complete",
                    note_fr="Recherche automatique : à relire avant de s'y fier.",
                    aliases=result.aliases,
                    facts=result.facts,
                )
                await repo.update_run(self._pool, run_id, "done", tool_id=tool["id"])
                log.info(
                    "tool_research_done",
                    slug=result.slug,
                    facts=len(result.facts),
                    rejected=result.rejected,
                    pages=len(result.pages_read),
                )
            except ResearchFailed as exc:
                await self._fail(run_id, str(exc))
            except (LLMUnavailable, AppError) as exc:
                log.warning("tool_research_unavailable", reason=str(exc))
                await self._fail(run_id, "Le service d'IA est indisponible, réessaie plus tard.")
            except Exception:
                log.exception("tool_research_error")
                await self._fail(run_id, "Erreur interne pendant la recherche.")

    async def _fail(self, run_id: str, message: str) -> None:
        try:
            await repo.update_run(self._pool, run_id, "failed", error=message)
        except Exception:
            log.exception("tool_research_fail_update")
