"""Charge le catalogue de départ des outils d'IA (data/ai_tools_seed.json).

    uv run python -m scripts.seed_ai_tools --dry-run    # lit les pages, vérifie les phrases, n'écrit rien
    uv run python -m scripts.seed_ai_tools              # écrit dans la base (migration 0009 faite)
    uv run python -m scripts.seed_ai_tools --force      # écrase aussi les fiches déjà relues par une personne
    uv run --extra browser python -m scripts.seed_ai_tools --browser   # lit aussi les pages en JavaScript (Gemini)

Chaque phrase citée est recherchée dans la page officielle rechargée par ce script : une phrase
introuvable n'est pas comptée et le résultat s'affiche. Les pages qui refusent la lecture (403)
laissent l'outil « pas évalué », jamais « non divulgué »."""

import asyncio
import json
import sys
from pathlib import Path

from app.core.config import get_settings
from app.db.postgres import create_pool
from app.repositories import ai_tool_repository as repo
from app.services.research.browser import BrowserReader
from app.services.research.fetcher import FetchError
from app.services.research.reader import PageReader
from app.services.research.seed import evaluate_seed_tool

SEED = Path(__file__).resolve().parent.parent / "data" / "ai_tools_seed.json"


async def main(dry_run: bool, force: bool = False, use_browser: bool = False) -> None:
    browser = BrowserReader() if use_browser else None
    read = PageReader(browser)
    data = json.loads(SEED.read_text(encoding="utf-8"))
    urls = sorted({f["source_url"] for t in data["tools"] for f in t["facts"]})
    pages: dict[str, str] = {}
    for url in urls:
        try:
            pages[url] = (await read(url)).text
            print(f"  lu      {url} ({len(pages[url])} car.)")
        except FetchError as exc:
            print(f"  REFUSÉ  {url} ({exc})")

    pool = None if dry_run else await create_pool(get_settings())
    if not dry_run and pool is None:
        sys.exit("DATABASE_URL absente ou base injoignable : rien n'a été écrit.")
    for tool in data["tools"]:
        if pool is not None and not force:
            existing = await repo.get_by_slug(pool, tool["slug"])
            if existing and existing["review_state"] == "verifie":
                print(
                    f"{tool['name']:18} déjà vérifié par {existing['reviewed_by']} : ignoré (--force pour écraser)"
                )
                continue
        row = evaluate_seed_tool(tool, pages)
        ok = sum(f.quote_verified for f in row["facts"])
        print(
            f"{row['name']:18} faits vérifiés {ok}/{len(row['facts'])}  statut={row['status']}  recherche={row['research_state']}"
        )
        for f in row["facts"]:
            if not f.quote_verified:
                print(f"      non vérifié : [{f.field}/{f.plan}] {f.quote[:70]}…")
        if pool is not None:
            await repo.save_tool(pool, **row)
    if browser:
        await browser.close()
    if pool is not None:
        await pool.close()
        print(
            "Écrit dans la base. Tous les outils restent « à vérifier » jusqu'à relecture humaine."
        )


if __name__ == "__main__":
    asyncio.run(main("--dry-run" in sys.argv, "--force" in sys.argv, "--browser" in sys.argv))
