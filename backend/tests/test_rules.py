import json
from pathlib import Path

import pytest

from app.schemas.rule import Category, Measure, Rule
from app.services import rules_service
from scripts.validate_rules import validate_file

# FIXTURE DE TEST UNIQUEMENT : règles fictives, sans valeur cinématographique.
# Les URLs sont des placeholders. Ne jamais copier dans rules/.


def make_rule(**over) -> dict:
    base = {
        "id": "R-001",
        "category": "framing",
        "title_fr": "Règle fictive A",
        "rule_fr": "Texte fictif de test.",
        "why_fr": "Raison fictive de test.",
        "measurable": ["center_x"],
        "numeric_hint": None,
        "applies_when": ["portrait"],
        "confidence": "low",
        "sources": [
            {
                "title": "Source fictive",
                "author": None,
                "url": "https://example.com/x",
                "type": "article",
            }
        ],
        "notes": None,
    }
    return base | over


FAKE = [
    make_rule(),
    make_rule(
        id="R-002", category="light", measurable=["luma", "contrast"], applies_when=["interior"]
    ),
]


@pytest.fixture
def loaded(monkeypatch, tmp_path):
    f = tmp_path / "rules.json"
    f.write_text(json.dumps(FAKE))
    monkeypatch.setattr(rules_service, "RULES_PATH", f)
    rules_service.get_all_rules.cache_clear()
    yield
    rules_service.get_all_rules.cache_clear()


def test_valid_rule():
    assert Rule.model_validate(make_rule()).id == "R-001"


def test_rule_without_source_rejected():
    with pytest.raises(ValueError):
        Rule.model_validate(make_rule(sources=[]))


def test_bad_id_and_extra_field_rejected():
    with pytest.raises(ValueError):
        Rule.model_validate(make_rule(id="R-1"))
    with pytest.raises(ValueError):
        Rule.model_validate(make_rule(inconnu=1))


def test_duplicate_id_rejected(tmp_path: Path):
    f = tmp_path / "c.json"
    f.write_text(json.dumps([make_rule(), make_rule()]))
    _, errors = validate_file(f)
    assert any("R-001" in e and "dupliqué" in e for e in errors)


def test_missing_file_is_empty_not_crash(monkeypatch, tmp_path):
    monkeypatch.setattr(rules_service, "RULES_PATH", tmp_path / "absent.json")
    rules_service.get_all_rules.cache_clear()
    assert rules_service.get_all_rules() == ()
    rules_service.get_all_rules.cache_clear()


def test_select_and_get(loaded):
    assert len(rules_service.select_rules()) == 2
    assert [r.id for r in rules_service.select_rules(categories=[Category.light])] == ["R-002"]
    assert [r.id for r in rules_service.select_rules(measures=[Measure.center_x])] == ["R-001"]
    assert [r.id for r in rules_service.select_rules(tags=["interior"])] == ["R-002"]
    assert rules_service.get_rule("R-001") is not None
    assert rules_service.get_rule("R-999") is None


def test_format_for_prompt(loaded):
    text = rules_service.format_for_prompt(rules_service.select_rules())
    assert "[R-001] Règle fictive A" in text
    assert "Mesures : luma, contrast" in text
    assert "http" not in text
