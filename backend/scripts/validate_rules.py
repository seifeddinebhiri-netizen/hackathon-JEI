"""Valide un fichier JSON de règles.

Usage : uv run python -m scripts.validate_rules [chemin]   (défaut : rules/raw/candidates.json)
Code de sortie 0 si valide, 1 sinon.
"""

import json
import sys
from collections import Counter
from pathlib import Path

from pydantic import ValidationError

from app.schemas.rule import Rule

DEFAULT = Path(__file__).resolve().parent.parent / "rules" / "raw" / "candidates.json"


def validate_file(path: Path) -> tuple[list[Rule], list[str]]:
    errors: list[str] = []
    if not path.exists():
        return [], [f"Fichier introuvable : {path}"]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [], [f"JSON invalide : {exc}"]
    if not isinstance(data, list):
        return [], ["Le fichier doit contenir une liste de règles."]

    rules: list[Rule] = []
    for i, item in enumerate(data):
        rid = item.get("id", f"#{i}") if isinstance(item, dict) else f"#{i}"
        try:
            rules.append(Rule.model_validate(item))
        except ValidationError as exc:
            for e in exc.errors():
                loc = ".".join(str(p) for p in e["loc"])
                errors.append(f"[{rid}] {loc}: {e['msg']}")
    counts = Counter(r.id for r in rules)
    errors += [f"[{rid}] id dupliqué ({n} fois)" for rid, n in counts.items() if n > 1]
    return rules, errors


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else DEFAULT
    rules, errors = validate_file(path)
    print(f"Fichier : {path}")
    print(f"Règles valides : {len(rules)}")
    for title, counter in (
        ("Par catégorie", Counter(r.category.value for r in rules)),
        ("Par confiance", Counter(r.confidence.value for r in rules)),
    ):
        print(f"\n{title} :")
        for k, n in sorted(counter.items()):
            print(f"  {k}: {n}")
    if errors:
        print(f"\n{len(errors)} erreur(s) :")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nOK : fichier valide.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
