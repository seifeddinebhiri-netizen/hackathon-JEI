import json
from collections.abc import Iterable
from functools import lru_cache
from pathlib import Path

import structlog
from pydantic import TypeAdapter, ValidationError

from app.schemas.rule import Category, Measure, Rule

log = structlog.get_logger()

RULES_PATH = Path(__file__).resolve().parent.parent.parent / "rules" / "rules.json"
_adapter = TypeAdapter(list[Rule])


class RulesLoadError(Exception):
    pass


def load_rules_from_file(path: Path) -> list[Rule]:
    """Charge et valide un fichier de règles ; lève RulesLoadError avec un message clair."""
    if not path.exists():
        raise RulesLoadError(
            f"Fichier de règles introuvable : {path}. "
            "Il est produit après validation et relecture humaine (voir rules/README.md)."
        )
    try:
        rules = _adapter.validate_python(json.loads(path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise RulesLoadError(f"Fichier de règles invalide ({path}) : {exc}") from exc
    ids = [r.id for r in rules]
    dups = sorted({i for i in ids if ids.count(i) > 1})
    if dups:
        raise RulesLoadError(f"Ids de règles dupliqués : {', '.join(dups)}")
    return rules


@lru_cache
def get_all_rules() -> tuple[Rule, ...]:
    """Règles validées (cache). Tuple vide si rules.json est absent (avertissement loggé)."""
    try:
        rules = load_rules_from_file(RULES_PATH)
    except RulesLoadError as exc:
        log.warning("rules_unavailable", reason=str(exc))
        return ()
    log.info("rules_loaded", count=len(rules))
    return tuple(rules)


def get_rule(rule_id: str) -> Rule | None:
    return next((r for r in get_all_rules() if r.id == rule_id), None)


def select_rules(
    categories: Iterable[Category] | None = None,
    measures: Iterable[Measure] | None = None,
    tags: Iterable[str] | None = None,
) -> list[Rule]:
    # Point d'extension : aujourd'hui sans filtre = toutes les règles ; à remplacer
    # plus tard par une sélection RAG / embeddings selon le contexte du plan.
    rules = list(get_all_rules())
    if categories is not None:
        cats = set(categories)
        rules = [r for r in rules if r.category in cats]
    if measures is not None:
        ms = set(measures)
        rules = [r for r in rules if ms & set(r.measurable)]
    if tags is not None:
        ts = set(tags)
        rules = [r for r in rules if ts & set(r.applies_when)]
    return rules


def format_for_prompt(rules: Iterable[Rule]) -> str:
    """Texte compact pour un prompt LLM (sans URLs)."""
    blocks = []
    for r in rules:
        measures = ", ".join(m.value for m in r.measurable)
        blocks.append(
            f"[{r.id}] {r.title_fr}\n"
            f"Règle : {r.rule_fr}\n"
            f"Pourquoi : {r.why_fr}\n"
            f"Mesures : {measures}"
        )
    return "\n\n".join(blocks)
