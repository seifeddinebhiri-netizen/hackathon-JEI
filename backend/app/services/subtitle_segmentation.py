"""Sous-titres, étape 2 : découpage des mots horodatés en sous-titres (fonctions pures).

Un nouveau sous-titre commence si :
- la pause entre deux mots dépasse PAUSE_BREAK_S ;
- la personne qui parle change ;
- le mot précédent finit par . ? ! et la pause dépasse PUNCT_PAUSE_S ;
- le texte ne tiendrait plus sur MAX_LINES lignes de MAX_LINE_CHARS caractères.
"""

import math

from app.schemas.subtitle import Cue, Word

PAUSE_BREAK_S = 0.6
PUNCT_PAUSE_S = 0.3
MAX_LINE_CHARS = 42
MAX_LINES = 2
_STRONG_PUNCT = (".", "?", "!", "؟")


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


def _make_cue(index: int, words: list[Word], labels: dict[str, str]) -> Cue:
    confidence = sum(math.exp(min(0.0, w.logprob)) for w in words) / len(words)
    return Cue(
        id=f"l{index}",
        start=srt_time(words[0].start),
        end=srt_time(words[-1].end),
        source=" ".join(w.text.strip() for w in words),
        speaker=_speaker_label(words[0].speaker_id, labels),
        asr_confidence=round(confidence, 3),
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
