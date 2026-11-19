"""Sous-titres : glossaire derja (data/glossaire_derja.json), recherche sans IA.

Le texte est normalisé (minuscules, sans ponctuation, chiffres arabizi 3/7/9/5 gardés)
puis comparé à chaque variante avec rapidfuzz, sur une fenêtre de même nombre de mots.
Le fichier est écrit et validé par l'équipe : les entrées « a_relire » ne sont pas encore relues.
"""

import json
import unicodedata
from functools import lru_cache
from pathlib import Path

from rapidfuzz import fuzz

from app.schemas.subtitle import GlossaryEntry

GLOSSARY_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "glossaire_derja.json"
MAX_MATCHES = 3
MIN_SCORE = 85
# En dessous de cette longueur, une variante doit correspondre exactement (évite les faux amis).
SHORT_VARIANT_CHARS = 5


def normalize(text: str) -> str:
    """Minuscules, ponctuation retirée, diacritiques arabes retirés ; chiffres gardés."""
    text = unicodedata.normalize("NFKC", text).lower()
    out = []
    for c in text:
        cat = unicodedata.category(c)
        if cat.startswith(("P", "S")):
            out.append(" ")
        elif cat == "Mn":  # harakat, accents
            continue
        else:
            out.append(c)
    return " ".join("".join(out).split())


@lru_cache
def load_glossary(path: Path = GLOSSARY_PATH) -> tuple[GlossaryEntry, ...]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return tuple(GlossaryEntry.model_validate(e) for e in raw)


def _best_window(variant: str, tokens: list[str]) -> tuple[float, int, int]:
    """Meilleure fenêtre de même nombre de mots que la variante : (score, début, fin)."""
    size = len(variant.split())
    best = (0.0, 0, 0)
    for i in range(len(tokens) - size + 1):
        window = " ".join(tokens[i : i + size])
        if len(variant) < SHORT_VARIANT_CHARS:
            score = 100.0 if window == variant else 0.0
        else:
            score = fuzz.ratio(variant, window)
        if score > best[0]:
            best = (score, i, i + size)
    return best


def find_entries(
    text: str, glossary: tuple[GlossaryEntry, ...] | None = None
) -> list[GlossaryEntry]:
    """0 à 3 entrées du glossaire présentes dans la ligne.

    Si deux entrées visent les mêmes mots (« bessa7a » contre « ya3tik essa7a »),
    la plus longue l'emporte, puis la plus proche.
    """
    glossary = load_glossary() if glossary is None else glossary
    tokens = normalize(text).split()
    if not tokens:
        return []
    candidates: list[tuple[float, int, int, GlossaryEntry]] = []
    for entry in glossary:
        score, start, end = max(
            (_best_window(normalize(v), tokens) for v in entry.variants), default=(0.0, 0, 0)
        )
        if score >= MIN_SCORE:
            candidates.append((score, start, end, entry))
    candidates.sort(key=lambda c: (-(c[2] - c[1]), -c[0]))
    taken: set[int] = set()
    out: list[GlossaryEntry] = []
    for _, start, end, entry in candidates:
        span = set(range(start, end))
        if span & taken:
            continue
        taken |= span
        out.append(entry)
    return out[:MAX_MATCHES]
