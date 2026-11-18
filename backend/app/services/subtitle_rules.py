"""Sous-titres, étape 4 : règles de sous-titrage (fonctions pures).

Corrections automatiques : chevauchement (on décale le début), durée trop courte
(on rallonge si la place existe). Le reste devient un avertissement sur la ligne,
vérifié sur le texte français et sur le texte anglais.
"""

from app.schemas.subtitle import SubtitleLine, SubtitleWarning
from app.services.subtitle_segmentation import MAX_LINE_CHARS, parse_srt_time, srt_time, wrap

MAX_CHARS_PER_LINE = MAX_LINE_CHARS  # 42
MAX_LINES = 2
MAX_CPS = 17  # caractères par seconde
MIN_DURATION_S = 1.0
MAX_DURATION_S = 7.0
MIN_GAP_S = 0.08

# Règles recalculées à chaque passage (les autres avertissements éventuels sont gardés).
RULES = {
    "lecture_rapide",
    "trop_de_lignes",
    "ligne_trop_longue",
    "duree_courte",
    "duree_longue",
    "chevauchement",
}


def _fr_num(x: float) -> str:
    return f"{x:.1f}".replace(".", ",")


def _fix_timing(lines: list[SubtitleLine]) -> None:
    prev_end: float | None = None
    for i, line in enumerate(lines):
        start, end = parse_srt_time(line.start), parse_srt_time(line.end)
        if prev_end is not None and start < prev_end + MIN_GAP_S:
            shifted = prev_end + MIN_GAP_S
            if shifted < end:  # sinon : impossible à corriger, signalé plus bas
                start = shifted
        if end - start < MIN_DURATION_S:
            limit = parse_srt_time(lines[i + 1].start) - MIN_GAP_S if i + 1 < len(lines) else None
            target = start + MIN_DURATION_S
            end = max(end, min(target, limit) if limit is not None else target)
        line.start, line.end = srt_time(start), srt_time(end)
        prev_end = end


def _text_warnings(label: str, text: str, duration: float) -> list[SubtitleWarning]:
    out: list[SubtitleWarning] = []
    text = " ".join(text.split())
    if not text:
        return out
    wrapped = wrap(text, MAX_CHARS_PER_LINE)
    if len(wrapped) > MAX_LINES:
        out.append(
            SubtitleWarning(
                rule="trop_de_lignes",
                detail=f"{label} : {len(wrapped)} lignes de {MAX_CHARS_PER_LINE} car. "
                f"(limite {MAX_LINES})",
            )
        )
    longest = max(len(w) for w in wrapped)
    if longest > MAX_CHARS_PER_LINE:
        out.append(
            SubtitleWarning(
                rule="ligne_trop_longue",
                detail=f"{label} : un mot de {longest} car. dépasse la ligne "
                f"(limite {MAX_CHARS_PER_LINE})",
            )
        )
    if duration > 0:
        cps = len(text) / duration
        if cps > MAX_CPS:
            out.append(
                SubtitleWarning(
                    rule="lecture_rapide",
                    detail=f"{label} : {round(cps)} car./s pour {_fr_num(duration)} s "
                    f"(limite {MAX_CPS})",
                )
            )
    return out


def check(lines: list[SubtitleLine]) -> None:
    """Recalcule les avertissements de règles sur chaque ligne (sans changer les temps)."""
    prev_end: float | None = None
    for line in lines:
        start, end = parse_srt_time(line.start), parse_srt_time(line.end)
        duration = end - start
        warnings = [w for w in line.warnings if w.rule not in RULES]
        if prev_end is not None and start < prev_end + MIN_GAP_S:
            warnings.append(
                SubtitleWarning(
                    rule="chevauchement",
                    detail=f"Écart de {round((start - prev_end) * 1000)} ms avec la ligne "
                    f"précédente (minimum {round(MIN_GAP_S * 1000)} ms)",
                )
            )
        if duration < MIN_DURATION_S:
            warnings.append(
                SubtitleWarning(
                    rule="duree_courte",
                    detail=f"{_fr_num(duration)} s à l'écran (minimum {_fr_num(MIN_DURATION_S)} s)",
                )
            )
        elif duration > MAX_DURATION_S:
            warnings.append(
                SubtitleWarning(
                    rule="duree_longue",
                    detail=f"{_fr_num(duration)} s à l'écran (maximum {_fr_num(MAX_DURATION_S)} s)",
                )
            )
        warnings += _text_warnings("FR", line.fr, duration)
        warnings += _text_warnings("EN", line.en or "", duration)
        line.warnings = warnings
        prev_end = end


def apply_rules(lines: list[SubtitleLine], autofix: bool = True) -> list[SubtitleLine]:
    """Corrige ce qui peut l'être (si autofix), puis ajoute les avertissements."""
    lines = [line.model_copy(deep=True) for line in lines]
    if autofix:
        _fix_timing(lines)
    check(lines)
    return lines
