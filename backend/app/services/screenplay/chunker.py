"""Découpage d'un scénario en scènes, sans IA.

Une scène commence à chaque en-tête (« slugline ») :
    INT. CAFÉ DE LA MÉDINA - JOUR
    12. EXT. PORT DE LA GOULETTE – NUIT
    INT./EXT. VOITURE DE SLIM - CONTINU
    SÉQUENCE 4 - TERRASSE - CRÉPUSCULE
    .FLASHBACK DANS LA CUISINE          (en-tête forcé Fountain)
    داخلي. مقهى - ليل                   (en-têtes en arabe)

Le texte de chaque scène est conservé mot pour mot : l'IA ne réécrit jamais le scénario,
elle ne fait qu'annoter des morceaux déjà découpés.
"""

import re
import unicodedata
from dataclasses import dataclass, field

# --- En-têtes -----------------------------------------------------------------

_NUM = r"(?:(?P<num>\d{1,4}[A-Z]?)\s*[.)\-–—:]?\s+)?"
_SETTING = (
    r"(?P<setting>INT\.?\s*/\s*EXT|EXT\.?\s*/\s*INT|I\s*/\s*E|"
    r"INT[ÉE]RIEUR|EXT[ÉE]RIEUR|INT|EXT)"
)
HEADING_RE = re.compile(
    rf"^\s*{_NUM}{_SETTING}(?:[.\s/:–—-]+)(?P<rest>.+?)\s*(?:#(?P<num2>[\w.-]+)#)?\s*$",
    re.IGNORECASE,
)
SEQUENCE_RE = re.compile(
    r"^\s*(?:SC[ÈE]NE|S[ÉE]QUENCE|S[ÉE]Q\.?)\s*(?P<num>\d{1,4}[A-Z]?)\s*[.:\-–—]?\s*(?P<rest>.*)$",
    re.IGNORECASE,
)
FORCED_RE = re.compile(r"^\.(?P<rest>[^.\s].*)$")  # Fountain
ARABIC_RE = re.compile(
    r"^\s*(?P<num>\d{1,4}\s*[.)\-–—]?\s*)?(?P<setting>داخلي|خارجي)\s*[.\-–—/:]?\s*(?P<rest>.+)$"
)

PART_SPLIT = re.compile(r"\s+[-–—]+\s+|\s*[–—]\s*|\s+/\s+|\s*\|\s*")

# --- Moments ------------------------------------------------------------------
# L'ordre compte : « fin d'après-midi » avant « après-midi », « soir tard » avant « soir ».
_MOMENTS: list[tuple[str, str]] = [
    (r"soir tard|tard le soir|minuit|nuit|night|midnight|ليل|ليلا", "nuit"),
    (r"aube|lever du (jour|soleil)|petit matin|dawn|sunrise|daybreak|فجر|الفجر", "aube"),
    (
        (
            r"cr[ée]puscule|coucher du soleil|fin d.apr[eè]s.midi|heure dor[ée]e|golden hour|"
            r"magic hour|dusk|sunset|evening|soir[ée]?e?|غروب|مساء|عشية"
        ),
        "heure_doree",
    ),
    (
        r"jour|journ[ée]e|matin[ée]?e?|midi|apr[eè]s.midi|day|morning|afternoon|noon|نهار|صباح|ظهر",
        "jour",
    ),
]
_MOMENT_RES = [(re.compile(rf"(?<!\w)(?:{p})(?!\w)", re.IGNORECASE), m) for p, m in _MOMENTS]
_CONTINUITY = re.compile(
    r"(?<!\w)(continu(ous|e|ité)?|plus tard|suite|m[êe]me moment|later|moments? later|"
    r"same time|instants? plus tard|peu apr[eè]s)(?!\w)",
    re.IGNORECASE,
)

# Mots qui signalent un extérieur quand l'en-tête ne dit pas INT/EXT.
_OUTDOOR = re.compile(
    r"(?<!\w)(rue|ruelle|route|plage|mer|port|jardin|parc|for[êe]t|montagne|d[ée]sert|champ|"
    r"terrasse|toit|place|march[ée]|souk|cour|quai|pont|parking|stade|oasis|colline|corniche|"
    r"street|beach|garden|park|road|roof|شارع|بحر|شاطئ)(?!\w)",
    re.IGNORECASE,
)


def detect_moment(text: str) -> str | None:
    for rx, moment in _MOMENT_RES:
        if rx.search(text):
            return moment
    return None


_TIME_FILLER = {
    "de",
    "du",
    "d",
    "la",
    "le",
    "l",
    "en",
    "au",
    "a",
    "tres",
    "tard",
    "tot",
    "fin",
    "debut",
    "plein",
    "pleine",
    "the",
    "early",
    "late",
    "same",
    "meme",
    "moment",
    "jour",
    "j",
}


def _is_time_part(part: str) -> bool:
    """Vrai si le morceau ne contient QUE des mots de moment (« NUIT », « PLUS TARD »).

    « PLAGE DE NUIT » est un lieu : il reste « plage » une fois les mots de moment retirés.
    """
    p = part.strip(" .")
    if not p or not (_CONTINUITY.search(p) or detect_moment(p)):
        return False
    rest = _CONTINUITY.sub(" ", p)
    for rx, _ in _MOMENT_RES:
        rest = rx.sub(" ", rest)
    words = unicodedata.normalize("NFKD", rest.lower())
    words = "".join(c for c in words if not unicodedata.combining(c))
    return all(w in _TIME_FILLER for w in re.findall(r"\w+", words))


@dataclass
class Chunk:
    index: int
    number: str
    heading: str
    setting: str  # "INT" | "EXT"
    setting_guessed: bool
    place: str  # lieu principal, brut (capitales d'origine)
    room: str | None
    moment: str | None  # None = absent ou « continu » → hérité de la scène précédente
    moment_raw: str
    interior_exterior: bool  # INT./EXT.
    start_line: int  # 1-indexé, ligne de l'en-tête
    body_lines: list[str] = field(default_factory=list)

    @property
    def body(self) -> str:
        return "\n".join(self.body_lines).strip()


def _setting_of(raw: str | None, place_text: str) -> tuple[str, bool, bool]:
    """→ (setting, deviné ?, int/ext ?)."""
    if raw:
        r = re.sub(r"[\s.]", "", raw.upper())
        if "/" in r:
            return "EXT", False, True  # intérieur/extérieur : dépend de la météo, donc EXT
        if r.startswith("EXT") or raw == "خارجي":
            return "EXT", False, False
        return "INT", False, False
    return ("EXT" if _OUTDOOR.search(place_text) else "INT"), True, False


def parse_heading(line: str) -> dict | None:
    s = line.strip()
    if not s or len(s) > 140:
        return None
    m = HEADING_RE.match(s) or ARABIC_RE.match(s)
    setting_raw = None
    if m:
        setting_raw = m.group("setting")
        rest = m.group("rest")
        num = (m.groupdict().get("num") or m.groupdict().get("num2") or "").strip(" .)-–—")
        # « INT » suivi d'un mot ordinaire en minuscules (« Interdit de... ») : pas un en-tête
        # En minuscules (« Intérieur de la maison, Amira pleure. »), on n'accepte que la forme
        # abrégée courte : « Int. cuisine - jour ».
        if m.re is HEADING_RE and not setting_raw.isupper():
            abbrev = re.match(r"^(\d+\W*\s*)?(int|ext|i\s*/\s*e)\s*[./]", s, re.IGNORECASE)
            if not abbrev or len(s.split()) > 10:
                return None
    elif (m := SEQUENCE_RE.match(s)) and (s.split()[0].isupper()):
        rest, num = m.group("rest"), m.group("num")
    elif m := FORCED_RE.match(s):
        rest, num = m.group("rest"), ""
        inner = HEADING_RE.match(rest)
        if inner:
            return parse_heading(rest)
    else:
        return None

    # « INT. JOUR - CUISINE » ou « INT. CUISINE. JOUR » : on classe chaque morceau.
    rest = re.sub(r"\([^)]*\)", " ", rest)  # « (FLASHBACK) », « (RÊVE) » : pas un lieu
    parts = [p.strip(" .") for p in PART_SPLIT.split(rest) if p.strip(" .")]
    parts = [{"J": "JOUR", "N": "NUIT"}.get(p.upper(), p) for p in parts]
    if len(parts) == 1:
        tail = re.match(r"^(?P<place>.+?)[.,]\s*(?P<time>[^.,]+)$", parts[0])
        if tail and _is_time_part(tail.group("time")):
            parts = [tail.group("place"), tail.group("time")]
    time_parts = [p for p in parts if _is_time_part(p)]
    place_parts = [p for p in parts if p not in time_parts]
    if not place_parts:
        place_parts = ["Lieu à préciser"]
    place, room = place_parts[0], (" - ".join(place_parts[1:]) or None)
    moment_raw = " ".join(time_parts)
    setting, guessed, int_ext = _setting_of(setting_raw, place)
    return {
        "number": num,
        "setting": setting,
        "setting_guessed": guessed,
        "interior_exterior": int_ext,
        "place": place,
        "room": room,
        "moment": detect_moment(moment_raw) if moment_raw else None,
        "moment_raw": moment_raw,
    }


def split_scenes(text: str) -> list[Chunk]:
    """Découpe sur les en-têtes. Le texte avant le premier en-tête (page de titre) est ignoré."""
    chunks: list[Chunk] = []
    for i, line in enumerate(text.splitlines(), start=1):
        h = parse_heading(line)
        if h:
            chunks.append(Chunk(index=len(chunks), heading=line.strip(), start_line=i, **h))
        elif chunks:
            chunks[-1].body_lines.append(line)
    return chunks


def chunks_from_boundaries(text: str, boundaries: list[dict]) -> list[Chunk]:
    """Découpe un texte libre (sans en-têtes) à partir de bornes de lignes proposées par l'IA.

    `boundaries` : [{start_line, setting, place, moment}], déjà validées et triées.
    """
    lines = text.splitlines()
    chunks = []
    for k, b in enumerate(boundaries):
        start = b["start_line"]
        end = boundaries[k + 1]["start_line"] if k + 1 < len(boundaries) else len(lines) + 1
        chunks.append(
            Chunk(
                index=k,
                number="",
                heading="",
                setting=b["setting"],
                setting_guessed=True,
                place=b["place"] or "Lieu à préciser",
                room=None,
                moment=b["moment"],
                moment_raw="",
                interior_exterior=False,
                start_line=start,
                body_lines=lines[start - 1 : end - 1],
            )
        )
    return chunks


def whole_text_chunk(text: str) -> Chunk:
    return Chunk(
        index=0,
        number="1",
        heading="",
        setting=_setting_of(None, text[:400])[0],
        setting_guessed=True,
        place="Lieu à préciser",
        room=None,
        moment=detect_moment(text[:400]),
        moment_raw="",
        interior_exterior=False,
        start_line=1,
        body_lines=text.splitlines(),
    )


# --- Normalisation des noms ---------------------------------------------------

_SMALL = {
    "de",
    "du",
    "des",
    "la",
    "le",
    "les",
    "et",
    "à",
    "au",
    "aux",
    "en",
    "sur",
    "sous",
    "d",
    "l",
    "un",
    "une",
}


def display_name(raw: str) -> str:
    """« MAISON D'AMIRA » → « Maison d'Amira » ; l'arabe et les minuscules restent tels quels."""
    s = re.sub(r"\s+", " ", raw.strip())
    if not s or not s.isupper():
        return s
    tokens = re.split(r"(\s+|-|'|’|\(|\))", s.lower())
    out = []
    first = True
    in_paren = False
    for t in tokens:
        if t in ("(", ")"):
            in_paren = t == "("
        if not t or re.fullmatch(r"\s+|-|'|’|\(|\)", t):
            out.append(t)
            continue
        if in_paren or (not first and t in _SMALL):  # « Amira (jeune) »
            out.append(t)
        elif re.fullmatch(r"[ivx]+", t) and not first:
            out.append(t.upper())  # chiffres romains
        else:
            out.append(t[0].upper() + t[1:])
        first = False
    return "".join(out)


def norm_key(s: str) -> str:
    """Clé de comparaison : sans accents, minuscules, sans article initial ni ponctuation."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[’'`]", "'", s)
    s = re.sub(r"^(le |la |les |l'|the |un |une )", "", s.strip())
    s = re.sub(r"[^\w' ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()
