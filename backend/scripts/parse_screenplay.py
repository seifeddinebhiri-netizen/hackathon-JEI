"""Découpe un scénario en ligne de commande, pour tester sans lancer le serveur.

uv run python -m scripts.parse_screenplay chemin/scenario.fountain          # règles seules
uv run python -m scripts.parse_screenplay chemin/scenario.pdf --ai          # + IA (clé dans .env)
uv run python -m scripts.parse_screenplay chemin/scenario.docx --json > out.json
"""

import argparse
import asyncio
import sys
from pathlib import Path

from app.core.config import get_settings
from app.services.screenplay.llm import ScreenplayLLM
from app.services.screenplay.pipeline import parse_screenplay
from app.services.screenplay.reader import read_screenplay

MOMENTS = {
    "jour": "Jour",
    "nuit": "Nuit",
    "aube": "Lever du soleil",
    "heure_doree": "Lumière du soir",
}


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("path", type=Path)
    ap.add_argument("--ai", action="store_true", help="annoter avec le LLM (ANTHROPIC_API_KEY)")
    ap.add_argument("--json", action="store_true", help="sortie JSON (contrat de /planner/parse)")
    args = ap.parse_args()

    text = read_screenplay(filename=args.path.name, data=args.path.read_bytes())
    llm = ScreenplayLLM(get_settings()) if args.ai else None
    result = asyncio.run(parse_screenplay(text, llm))

    if args.json:
        sys.stdout.write(result.model_dump_json(indent=2) + "\n")
        return

    locs = {loc.id: loc for loc in result.locations}
    print(
        f"{len(result.scenes)} scènes · {len(result.locations)} lieux · "
        f"{len(result.characters)} personnages · IA : {'oui' if result.ai_used else 'non'}\n"
    )
    for s in result.scenes:
        loc = locs[s.location_id]
        room = f" › {s.room}" if s.room else ""
        guess = " (moment deviné)" if s.moment_guessed else ""
        print(
            f"[{s.number}] {s.setting} · {loc.name}{room} · {MOMENTS[s.moment]}{guess} · "
            f"{s.page_eighths}/8 p. · ~{s.estimated_hours} h"
        )
        print(f"     {s.title}")
        if s.characters:
            print(f"     Personnages : {', '.join(s.characters)}")
        if s.location_brief:
            print(f"     Lieu recherché : {s.location_brief}")
    print("\nLieux :")
    for loc in result.locations:
        extra = f" — {loc.kind_fr}" if loc.kind_fr else ""
        print(
            f"  - {loc.name}{extra} ({', '.join(loc.settings)}) scènes {', '.join(loc.scene_numbers)}"
        )
        if loc.rooms:
            print(f"      pièces : {', '.join(loc.rooms)}")
        if loc.brief_fr:
            print(f"      à trouver : {loc.brief_fr}")
    print("\nPersonnages : " + ", ".join(result.characters))
    print("\nAvertissements :")
    for w in result.warnings:
        print(f"  ! {w}")


if __name__ == "__main__":
    main()
