"""Lance la recherche guidée sur UN outil, comme le fait le serveur, et affiche le résultat.

    uv run python -m scripts.research_tool "Kimi K2"                 # n'écrit rien
    uv run python -m scripts.research_tool "Kimi K2" --save          # l'enregistre « à vérifier »
    uv run python -m scripts.research_tool "Kimi K2" --browser       # lit aussi les sites en JavaScript
    uv run python -m scripts.research_tool "Kimi K2" --no-registry   # sans le registre des sources connues

Même chemin que le serveur : registre des sources connues, sinon recherche web, liens du site,
lecture des pages, extraction, vérification de chaque citation. Un site qui refuse la lecture
automatique est signalé, jamais contourné."""

import asyncio
import sys

from app.core.config import get_settings
from app.db.postgres import create_pool
from app.repositories import ai_tool_repository as repo
from app.services.llm_service import research_service
from app.services.research import sources
from app.services.research.browser import BrowserReader
from app.services.research.pipeline import ResearchFailed, run_research
from app.services.research.reader import PageReader


async def main(name: str, save: bool, browser: bool, registry: bool) -> int:
    llm = research_service(get_settings())
    reader_browser = BrowserReader() if browser else None
    try:
        result = await run_research(
            name,
            llm,
            read=PageReader(reader_browser),
            known_lookup=sources.lookup if registry else (lambda _n: None),
        )
    except ResearchFailed as exc:
        print(f"ÉCHEC PROPRE : {exc}")
        return 2
    finally:
        if reader_browser:
            await reader_browser.close()
    print(
        f"OK · {result.name} ({result.vendor}) · site {result.official_site} · trouvé par : {result.how}"
    )
    print(
        f"statut={result.status} · pages lues={len(result.pages_read)} · faits vérifiés={len(result.facts)} · rejetés={result.rejected}"
    )
    for page in result.pages_read:
        print(f"   page : {page}")
    for f in result.facts:
        print(f"   [{f.field}/{f.plan}] « {f.quote[:90]} »")
    if save:
        pool = await create_pool(get_settings())
        if pool is None:
            print("Base injoignable : rien n'a été enregistré.")
            return 1
        try:
            await repo.save_tool(
                pool, slug=result.slug, name=result.name, vendor=result.vendor,
                official_site=result.official_site, categories=result.categories,
                terms_url=result.terms_url, privacy_url=result.privacy_url,
                terms_updated=result.terms_updated, status=result.status,
                review_state="a_verifier", research_state="complete",
                note_fr="Recherche automatique : à relire avant de s'y fier.",
                aliases=result.aliases, facts=result.facts,
            )  # fmt: skip
            print("Enregistré « à vérifier » (relecture : scripts.review_ai_tools).")
        finally:
            await pool.close()
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(
            'Usage : python -m scripts.research_tool "Nom de l\'outil" [--save] [--browser] [--no-registry]'
        )
    sys.exit(
        asyncio.run(
            main(
                args[0],
                "--save" in sys.argv,
                "--browser" in sys.argv,
                "--no-registry" not in sys.argv,
            )
        )
    )
