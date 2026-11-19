"""Sous-titres, étape 2 : découpage des mots horodatés en sous-titres (fonctions pures).

Un nouveau sous-titre commence si :
- la pause entre deux mots dépasse PAUSE_BREAK_S ;
- la personne qui parle change ;
- le mot précédent finit par . ? ! et la pause dépasse PUNCT_PAUSE_S ;
- le texte ne tiendrait plus sur MAX_LINES lignes de MAX_LINE_CHARS caractères.

Chaque sous-titre note aussi ses mots douteux : probabilité ASR < LOW_WORD_PROB, ou mot
isolé dans une autre écriture que ses voisins (arabe / latin) avec une probabilité
< SUSPECT_SWITCH_PROB (ex. un mot espagnol transcrit au milieu de la derja).
"""

import math
import re

from app.schemas.subtitle import Cue, Word

PAUSE_BREAK_S = 0.6
PUNCT_PAUSE_S = 0.3
MAX_LINE_CHARS = 42
MAX_LINES = 2
_STRONG_PUNCT = (".", "?", "!", "؟")
LOW_WORD_PROB = 0.5
SUSPECT_SWITCH_PROB = 0.8
_ARABIC = re.compile(r"[\u0600-\u06FF]")
_LATIN = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]")
_EDGE_PUNCT = ".,;:!?؟،«»\"'()…-"


def srt_time(seconds: float) -> str:
    """12.4 → "00:00:12,400"."""
    ms = max(0, round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def parse_srt_time(value: str) -> float:
    """Convertit "00:00:12,400" en 12.4."""
    hms, ms = value.split(",")
    h, m, s = (int(x) for x in hms.split(":"))
    return h * 3600 + m * 60 + s + int(ms) / 1000


def wrap(text: str, width: int = MAX_LINE_CHARS) -> list[str]:
    """Retour à la ligne glouton, sans couper un mot."""
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}" if current else word
        if current and len(candidate) > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def fits(text: str, max_lines: int = MAX_LINES, width: int = MAX_LINE_CHARS) -> bool:
    lines = wrap(text, width)
    return len(lines) <= max_lines and all(len(line) <= width for line in lines)


def _speaker_label(speaker_id: str | None, labels: dict[str, str]) -> str | None:
    """speaker_0, speaker_1… → S1, S2… dans l'ordre d'apparition."""
    if speaker_id is None:
        return None
    if speaker_id not in labels:
        labels[speaker_id] = f"S{len(labels) + 1}"
    return labels[speaker_id]


def _prob(word: Word) -> float:
    return math.exp(min(0.0, word.logprob))


def _script(text: str) -> str | None:
    """« arabe », « latin » ou None (chiffres, ponctuation). L'arabizi compte comme latin."""
    arabic, latin = len(_ARABIC.findall(text)), len(_LATIN.findall(text))
    if not arabic and not latin:
        return None
    return "arabe" if arabic >= latin else "latin"


def doubtful_words(words: list[Word]) -> tuple[list[str], list[str]]:
    """(mots incertains, mots isolés dans une autre écriture), sans doublon."""
    uncertain: list[str] = []
    mixed: list[str] = []
    scripts = [_script(w.text) for w in words]
    for i, word in enumerate(words):
        text = word.text.strip().strip(_EDGE_PUNCT)
        if not text:
            continue
        prob = _prob(word)
        if prob < LOW_WORD_PROB:
            if text not in uncertain:
                uncertain.append(text)
            continue
        own = scripts[i]
        neighbors = [scripts[j] for j in (i - 1, i + 1) if 0 <= j < len(words) and scripts[j]]
        isolated = own is not None and neighbors and all(n != own for n in neighbors)
        if isolated and prob < SUSPECT_SWITCH_PROB and text not in mixed:
            mixed.append(text)
    return uncertain, mixed


def _make_cue(index: int, words: list[Word], labels: dict[str, str]) -> Cue:
    confidence = sum(_prob(w) for w in words) / len(words)
    uncertain, mixed = doubtful_words(words)
    return Cue(
        id=f"l{index}",
        start=srt_time(words[0].start),
        end=srt_time(words[-1].end),
        source=" ".join(w.text.strip() for w in words),
        speaker=_speaker_label(words[0].speaker_id, labels),
        asr_confidence=round(confidence, 3),
        uncertain_words=uncertain,
        mixed_words=mixed,
    )


def _should_break(current: list[Word], word: Word) -> bool:
    last = current[-1]
    pause = word.start - last.end
    if pause > PAUSE_BREAK_S:
        return True
    if word.speaker_id != last.speaker_id:
        return True
    if last.text.rstrip().endswith(_STRONG_PUNCT) and pause > PUNCT_PAUSE_S:
        return True
    text = " ".join(w.text.strip() for w in [*current, word])
    return not fits(text)


def segment(words: list[Word]) -> list[Cue]:
    """Mots (et espaces) → sous-titres numérotés l1, l2…"""
    cues: list[Cue] = []
    labels: dict[str, str] = {}
    current: list[Word] = []
    for word in words:
        if word.type != "word" or not word.text.strip():
            continue
        if current and _should_break(current, word):
            cues.append(_make_cue(len(cues) + 1, current, labels))
            current = []
        current.append(word)
    if current:
        cues.append(_make_cue(len(cues) + 1, current, labels))
    return cues
