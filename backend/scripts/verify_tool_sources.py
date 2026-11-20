"""Vérifie le registre des sources connues (data/ai_tool_sources.json) avec le lecteur du pipeline.

    uv run python -m scripts.verify_tool_sources            # affiche l'état de chaque adresse
    uv run python -m scripts.verify_tool_sources --write    # ne garde que les pages lisibles et juridiques
    ... --browser   lit aussi les pages dont le texte est chargé par JavaScript (extra « browser »)

Une adresse n'est gardée que si la page : se lit sans blocage, contient assez de texte (pas une coquille
JavaScript), n'est pas la page d'accueil déguisée, et parle bien de conditions ou de confidentialité.
Les sites qui refusent la lecture automatique (403) sont signalés et écartés : on ne les contourne pas."""

import asyncio
import json
import re
import sys
from datetime import date
from pathlib import Path

from app.services.research.browser import BrowserReader
from app.services.research.fetcher import FetchBlocked, FetchError, Page
from app.services.research.pipeline import MIN_PAGE_CHARS
from app.services.research.reader import PageReader

FILE = Path(__file__).resolve().parent.parent / "data" / "ai_tool_sources.json"
LEGAL = re.compile(
    r"terms|privacy|policy|conditions|agreement|licen[cs]e|confidentialit", re.IGNORECASE
)


def _squash(text: str) -> str:
    return " ".join(text.split())


async def _read(url: str, read=None) -> tuple[Page | None, str]:
    try:
        return await (read or PageReader())(url), "ok"
    except FetchBlocked as exc:
        return None, f"BLOQUÉ ({exc})"
    except FetchError as exc:
        return None, f"INTROUVABLE ({exc})"


def judge(page: Page | None, status: str, home_text: str | None, seen: set[str]) -> str:
    if page is None:
        return status
    text = _squash(page.text)
    if len(text) < MIN_PAGE_CHARS:
        return "COQUILLE (contenu chargé par JavaScript)"
    if home_text is not None and text == _squash(home_text):
        return "FAUSSE PAGE (renvoie l'accueil)"
    if text in seen:
        return "DOUBLON (même texte qu'une autre adresse)"
    if not LEGAL.search(text[:20000]):
        return "PAS JURIDIQUE (ni conditions ni confidentialité)"
    seen.add(text)
    return "ok"


async def main(write: bool, use_browser: bool = False) -> None:
    browser = BrowserReader() if use_browser else None
    read = PageReader(browser)
    data = json.loads(FILE.read_text(encoding="utf-8"))
    kept = []
    for tool in data["tools"]:
        home, _ = await _read(tool["site"], read)
        home_text = home.text if home else None
        seen: set[str] = set()
        good = []
        print(f"\n{tool['name']}  ({tool['site']})" + ("" if home else "  [accueil illisible]"))
        results = await asyncio.gather(*(_read(u, read) for u in tool["pages"]))
        for url, (page, status) in zip(tool["pages"], results, strict=True):
            verdict = judge(page, status, home_text, seen)
            if verdict.startswith(("COQUILLE", "INTROUVABLE")):
                # Une lecture ratée ne doit pas retirer une bonne adresse : on réessaie une fois.
                page, status = await _read(url, read)
                verdict = judge(page, status, home_text, seen)
            print(f"   {'✓' if verdict == 'ok' else '✗'} {verdict:44} {url}")
            if verdict == "ok":
                good.append(page.url if page else url)
        if good:
            kept.append(
                {
                    **tool,
                    "pages": list(dict.fromkeys(good)),
                    "verified_on": date.today().isoformat(),
                }
            )
        else:
            print("   -> aucune page exploitable : outil retiré du registre")
    if browser:
        await browser.close()
    print(f"\n{len(kept)} outils gardés sur {len(data['tools'])}.")
    if write:
        data["tools"] = kept
        FILE.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"Écrit dans {FILE.name}.")
    else:
        print("Rien n'a été écrit (ajoute --write pour ne garder que les pages vérifiées).")


if __name__ == "__main__":
    asyncio.run(main("--write" in sys.argv, "--browser" in sys.argv))
