"""Sécurité démo : copie un brouillon de sous-titres réussi vers le projet de démonstration.

Usage : uv run python -m scripts.seed_demo_subtitles SOURCE_PROJECT_ID [--target demo-maree-basse]

Copie lignes, source_lang et processing de SOURCE_PROJECT_ID (table subtitle_drafts) vers
TARGET (par défaut demo-maree-basse), en remplaçant le brouillon existant. Refuse un
brouillon vide ou sans aucune ligne traduite. N'affiche que des compteurs : jamais le texte
des répliques ni les clés. À lancer seulement après relecture des traductions.
"""

import argparse
import asyncio
import sys
from collections import Counter

from app.core.config import get_settings
from app.db.postgres import create_pool
from app.services import subtitle_service

DEMO_PROJECT_ID = "demo-maree-basse"


async def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("source", help="project_id du brouillon réussi (ex. essai-tarek-v2)")
    p.add_argument("--target", default=DEMO_PROJECT_ID)
    args = p.parse_args()
    if args.source == args.target:
        print("La source et la cible sont identiques.")
        return 1

    pool = await create_pool(get_settings())
    if pool is None:
        print("Base indisponible (DATABASE_URL) : rien n'est copié.")
        return 1
    try:
        draft = await subtitle_service.load_draft(pool, args.source)
        if draft is None or not draft.lines:
            print(f"Aucun brouillon (ou brouillon vide) pour {args.source}.")
            return 1
        translated = sum(1 for li in draft.lines if li.fr.strip() and li.en.strip())
        if not translated:
            print(f"{args.source} n'a aucune ligne traduite : rien n'est copié.")
            return 1
        copy = draft.model_copy(deep=True, update={"project_id": args.target})
        await subtitle_service.save_draft(pool, copy)
    finally:
        await pool.close()

    levels = Counter(li.confidence for li in copy.lines)
    print(
        f"Copié {args.source} → {args.target} : {len(copy.lines)} lignes, "
        f"{translated} traduites, confiance {dict(levels)}, "
        f"traducteur {copy.processing.translator if copy.processing else '?'}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
