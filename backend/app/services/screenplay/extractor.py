"""Extraction sans IA des personnages qui parlent, et des lieux à partir des en-têtes."""

import re
from dataclasses import dataclass, field

from app.services.screenplay.chunker import Chunk, display_name, norm_key, parse_heading

# Extensions techniques après un nom : on les retire. Les autres parenthèses (« (JEUNE) »,
# « (ENFANT) ») sont gardées : ce sont souvent des rôles différents à distribuer.
_EXTENSION = re.compile(
    r"\(\s*(v\.?\s*o\.?|o\.?\s*s\.?|o\.?\s*c\.?|off|hors[- ]champ|h\.?\s*c\.?|voix[- ]off|v\.?\s*f\.?|"
    r"cont'?d|cont\.?|suite|continued|au t[ée]l[ée]phone|t[ée]l[ée]phone|filtr[ée]e?|"
    r"sous-titr[ée]e?|en arabe|en fran[cç]ais|chuchot[ée]|en derja)\s*\)",
    re.IGNORECASE,
)
_TRANSITION = re.compile(
    r"^(cut to|coupe|cut|fondu|fade|encha[iî]n|smash|match cut|dissolve|noir|fin|the end|titre|carton|"
    r"g[ée]n[ée]rique|super|insert|flash ?back|fin du flash|retour|back to|montage|s[ée]rie de plans|"
    r"intercut|over black|silence|plus tard|later|ellipse|musique|off|suite|cont)\b",
    re.IGNORECASE,
)
_CUE_CHARS = re.compile(r"^[A-ZÀ-ÖØ-Þ0-9][A-ZÀ-ÖØ-Þ0-9'’ .#&-]*$")
_INLINE_CUE = re.compile(
    r"^(?P<name>[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’ .-]{1,28}?)\s*(?:\([^)]*\))?\s*[:：]\s+\S"
)


def _clean_cue(line: str) -> str | None:
    s = line.strip()
    s = s.removeprefix("@")  # personnage forcé (Fountain)
    s = s.rstrip("^ ").strip()
    s = _EXTENSION.sub("", s).strip()
    base = re.sub(r"\([^)]*\)", "", s).strip()
    if not base or len(base) > 30 or len(base.split()) > 4:
        return None
    if not _CUE_CHARS.match(base) or not any(c.isalpha() for c in base):
        return None
    if base != base.upper() or base.endswith((".", ":")) or _TRANSITION.match(base):
        return None
    return s


def speaking_characters(chunk: Chunk) -> list[str]:
    """Noms en capitales placés juste au-dessus d'une réplique, dans l'ordre d'apparition."""
    lines = chunk.body_lines
    found: list[str] = []
    for j, raw in enumerate(lines):
        line = raw.strip()
        if not line or parse_heading(line):
            continue
        nxt = next((ln.strip() for ln in lines[j + 1 : j + 2]), "")
        name = None
        if (
            nxt
            and not parse_heading(nxt)
            and (line.startswith("@") or line.isupper() or "(" in line)
        ):
            name = _clean_cue(line)
            # Une ligne d'action entièrement en capitales suivie d'une autre ligne en capitales
            # (« BOUM. » / « LE TÉLÉPHONE SONNE ») n'est pas une réplique.
            if name and nxt.isupper() and not nxt.startswith("("):
                name = None
        if name is None and (m := _INLINE_CUE.match(line)):
            name = _clean_cue(m.group("name"))
        if name:
            pretty = display_name(name)
            if pretty not in found:
                found.append(pretty)
    return found


@dataclass
class LocationDraft:
    key: str
    name: str
    rooms: list[str] = field(default_factory=list)
    settings: list[str] = field(default_factory=list)
    scene_numbers: list[str] = field(default_factory=list)


def group_locations(chunks: list[Chunk], numbers: list[str]) -> dict[str, LocationDraft]:
    """Un lieu de tournage par lieu principal ; les pièces (« - CUISINE ») sont rangées dedans."""
    out: dict[str, LocationDraft] = {}
    for chunk, number in zip(chunks, numbers, strict=True):
        key = norm_key(chunk.place) or "lieu a preciser"
        loc = out.setdefault(key, LocationDraft(key=key, name=display_name(chunk.place)))
        if chunk.room:
            room = display_name(chunk.room)
            if room not in loc.rooms:
                loc.rooms.append(room)
        if chunk.setting not in loc.settings:
            loc.settings.append(chunk.setting)
        loc.scene_numbers.append(number)
    return out


def first_action_line(chunk: Chunk, characters: list[str]) -> str:
    """Première ligne d'action (ni réplique, ni didascalie), pour un résumé sans IA."""
    lines = [ln.strip() for ln in chunk.body_lines]
    cue_keys = {norm_key(c) for c in characters}
    skip_next = False
    for j, line in enumerate(lines):
        if not line:
            skip_next = False
            continue
        if skip_next:
            continue
        cue = _clean_cue(line)
        if cue and norm_key(display_name(cue)) in cue_keys and j + 1 < len(lines) and lines[j + 1]:
            skip_next = True  # on saute la réplique qui suit
            continue
        if line.startswith("(") or _TRANSITION.match(line) or _INLINE_CUE.match(line):
            continue
        return line
    return ""
