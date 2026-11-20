"""Relecture humaine du catalogue des outils d'IA (aucune route : réservé à l'équipe).

    uv run python -m scripts.review_ai_tools list
    uv run python -m scripts.review_ai_tools show claude
    uv run python -m scripts.review_ai_tools confirm claude <fact-id>   # tu as lu la page : le fait est exact
    uv run python -m scripts.review_ai_tools reject  claude <fact-id>   # fait faux ou douteux : supprimé
    uv run python -m scripts.review_ai_tools approve claude --reviewer "Prénom Nom"
    uv run python -m scripts.review_ai_tools reopen  claude

Une fiche « vérifiée » porte le nom de son relecteur. `approve` refuse tant qu'un fait n'est ni
retrouvé dans la page par le serveur, ni confirmé par une personne."""

import argparse
import asyncio
import sys

from app.core.config import get_settings
from app.db.postgres import create_pool
from app.services import ai_tool_review_service as review

LABELS = {
    "training_data": "Données d'entraînement",
    "input_training_use": "Tes contenus et l'entraînement",
    "output_rights": "Droits sur les sorties",
    "provenance": "Marquage des sorties",
    "indemnity": "Indemnisation",
    "voice_likeness": "Voix et visage",
}


def _mark(f) -> str:
    if f.human_confirmed:
        return "CONFIRMÉ PAR UNE PERSONNE"
    return "phrase retrouvée dans la page" if f.quote_verified else "NON VÉRIFIÉ"


async def run(args: argparse.Namespace) -> int:
    pool = await create_pool(get_settings())
    if pool is None:
        print("Base de données injoignable (DATABASE_URL) : rien n'a été modifié.")
        return 1
    try:
        if args.cmd == "list":
            rows = await review.pending(pool)
            if not rows:
                print("Aucune fiche à relire.")
            for r in rows:
                print(
                    f"{r['slug']:18} {r['name']:18} faits={r['facts']:2} à trancher={r['unconfirmed']}  statut={r['status']}"
                )
        elif args.cmd == "show":
            tool, facts = await review.show(pool, args.slug)
            print(
                f"{tool['name']} ({tool['vendor']})  statut={tool['status']}  relecture={tool['review_state']}"
            )
            print(
                f"Conditions : {tool['terms_url']}\nConfidentialité : {tool['privacy_url']}\n{tool['note_fr']}\n"
            )
            for f in facts:
                print(f"[{f.id}] {LABELS[f.field]} · offre={f.plan} · {_mark(f)}")
                print(
                    f"    Résumé  : {f.value_fr}\n    Phrase  : « {f.quote} »\n    Source  : {f.source_url}\n"
                )
        elif args.cmd == "confirm":
            await review.confirm_fact(pool, args.slug, args.fact_id)
            print("Fait confirmé.")
        elif args.cmd == "reject":
            status = await review.reject_fact(pool, args.slug, args.fact_id)
            print(f"Fait supprimé. Nouveau statut : {status}")
        elif args.cmd == "approve":
            status = await review.approve(pool, args.slug, args.reviewer)
            print(f"Fiche vérifiée par {args.reviewer}. Statut : {status}")
        elif args.cmd == "reopen":
            await review.reopen(pool, args.slug)
            print("Fiche remise « à vérifier ».")
        return 0
    except review.ReviewError as exc:
        print(f"Refusé : {exc}")
        return 2
    finally:
        await pool.close()


def parse(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Relecture des fiches d'outils d'IA")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    for name in ("show", "reopen"):
        sub.add_parser(name).add_argument("slug")
    for name in ("confirm", "reject"):
        sp = sub.add_parser(name)
        sp.add_argument("slug")
        sp.add_argument("fact_id")
    ap = sub.add_parser("approve")
    ap.add_argument("slug")
    ap.add_argument("--reviewer", required=True)
    return p.parse_args(argv)


if __name__ == "__main__":
    sys.exit(asyncio.run(run(parse(sys.argv[1:]))))
