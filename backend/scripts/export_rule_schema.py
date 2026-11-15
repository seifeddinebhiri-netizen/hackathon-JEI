"""Exporte le JSON Schema du modèle Rule vers rules/schema/rule.schema.json.

Usage : uv run python -m scripts.export_rule_schema
"""

import json
from pathlib import Path

from app.schemas.rule import Rule

OUT = Path(__file__).resolve().parent.parent / "rules" / "schema" / "rule.schema.json"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    schema = Rule.model_json_schema()
    OUT.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Schéma écrit : {OUT}")


if __name__ == "__main__":
    main()
