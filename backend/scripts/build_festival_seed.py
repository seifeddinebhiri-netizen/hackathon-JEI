"""Génère supabase/seed_festivals.sql depuis data/festivals.json (source de vérité).

Usage : uv run python -m scripts.build_festival_seed
Le SQL produit fait un upsert : on peut le relancer après chaque mise à jour du JSON.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "festivals.json"
OUT = ROOT / "supabase" / "seed_festivals.sql"

COLS = [
    "id",
    "name",
    "country",
    "city",
    "edition",
    "deadline",
    "deadline_note",
    "fee",
    "max_duration_min",
    "subtitle_langs",
    "ai_policy",
    "ai_policy_detail",
    "eligibility",
    "requirements",
    "source_url",
    "checked_at",
]


def lit(v, col: str) -> str:
    if v is None:
        return "null"
    if col == "subtitle_langs":
        return "array[" + ", ".join(lit(x, "") for x in v) + "]::text[]" if v else "'{}'::text[]"
    if col == "requirements":
        return lit(json.dumps(v, ensure_ascii=False), "") + "::jsonb"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def main() -> None:
    rows = json.loads(SRC.read_text(encoding="utf-8"))
    values = ",\n".join("  (" + ", ".join(lit(r.get(c), c) for c in COLS) + ")" for r in rows)
    updates = ",\n  ".join(f"{c} = excluded.{c}" for c in COLS if c != "id")
    sql = (
        "-- Généré par scripts/build_festival_seed.py : ne pas modifier à la main.\n"
        f"insert into public.festivals ({', '.join(COLS)}) values\n{values}\n"
        f"on conflict (id) do update set\n  {updates};\n"
    )
    OUT.write_text(sql, encoding="utf-8")
    print(f"{len(rows)} festivals -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
