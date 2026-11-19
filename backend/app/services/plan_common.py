from app.schemas.rule import Rule
from app.schemas.shot_spec import RuleRef


def rule_ref(rule: Rule) -> RuleRef:
    return RuleRef(
        id=rule.id,
        title_fr=rule.title_fr,
        confidence=rule.confidence.value,
        sources=[s.model_dump(mode="json") for s in rule.sources],
    )


def rules_for(rule_ids: list[str], by_id: dict[str, Rule]) -> list[RuleRef]:
    """Les règles citées avec leurs sources, sans doublon, dans l'ordre."""
    return [rule_ref(by_id[rid]) for rid in dict.fromkeys(rule_ids)]


def cites_known_rules(rule_ids: list[str], by_id: dict[str, Rule]) -> bool:
    """Au moins une règle citée, et toutes existent (sinon le plan est refusé)."""
    return bool(rule_ids) and all(rid in by_id for rid in rule_ids)
