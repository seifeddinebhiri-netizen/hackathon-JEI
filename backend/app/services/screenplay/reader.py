"""Lecture d'un scénario : fichier (TXT, Fountain, PDF, DOCX, FDX) ou texte collé → texte brut."""

import io
import re
import unicodedata
import xml.etree.ElementTree as ET

from app.core.errors import AppError

MAX_BYTES = 5 * 1024 * 1024
MAX_CHARS = 400_000  # ~ 200 pages : au-delà, on refuse plutôt que de facturer un appel énorme

TEXT_EXT = (".txt", ".fountain", ".spmd", ".md")


def _decode(data: bytes) -> str:
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1")


def _pdf(data: bytes) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:  # fichier corrompu ou chiffré
        raise AppError(
            "Impossible de lire ce PDF.", status_code=422, code="unreadable_file"
        ) from exc
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text(extraction_mode="layout") or "")
        except Exception:  # noqa: BLE001 — pypdf lève des erreurs variées en mode layout
            pages.append(page.extract_text() or "")
    text = tidy_pdf_text("\n".join(_drop_page_margins(pages)))
    if len(text.strip()) < 20:
        raise AppError(
            "Ce PDF ne contient pas de texte lisible (scan ?). Colle le texte ou envoie un fichier texte.",
            status_code=422,
            code="no_text_layer",
        )
    return text


def _drop_page_margins(pages: list[str]) -> list[str]:
    """Retire l'en-tête et le pied de page d'un PDF : première ou dernière ligne d'une page qui
    revient (au numéro de page près) sur au moins deux pages et la moitié d'entre elles."""
    if len(pages) < 2:
        return pages

    def edges(page: str) -> list[str]:
        lines = [ln for ln in page.splitlines() if ln.strip()]
        return [lines[0], lines[-1]] if lines else []

    def key(ln: str) -> str:
        return re.sub(r"\s+", " ", _PAGE_NUMBER_EDGE.sub("", ln.strip()))

    counts: dict[str, int] = {}
    for page in pages:
        for k in {key(ln) for ln in edges(page)}:
            if k:
                counts[k] = counts.get(k, 0) + 1
    # Un en-tête de scène (INT./EXT.) n'est jamais un en-tête de page
    noise = {
        k
        for k, n in counts.items()
        if n >= max(2, len(pages) // 2) and not _TRAILING_NUMBER.match(k + "    1")
    }
    if not noise:
        return pages
    out = []
    for page in pages:
        lines = page.splitlines()
        idx = [i for i, ln in enumerate(lines) if ln.strip()]
        drop = {i for i in (idx[:1] + idx[-1:]) if key(lines[i]) in noise}
        out.append("\n".join(ln for i, ln in enumerate(lines) if i not in drop))
    return out


# Numéro de scène répété dans la marge de droite : « 12   INT. CAFÉ - JOUR      12 »
_RIGHT_NUMBER = re.compile(r"^(?P<num>\d{1,4}[A-Z]?)\.?\s+(?P<head>\S.*?\S)\s{2,}(?P=num)\.?$")
# En-tête suivi seulement d'un numéro de marge : « INT. CAFÉ - JOUR      12 »
_TRAILING_NUMBER = re.compile(
    r"^(?P<head>(?:INT|EXT|I/E)\b.*?\S)\s{3,}\d{1,4}[A-Z]?\.?$", re.IGNORECASE
)
# Mot coupé en fin de ligne : « rou- » puis « ge » en minuscule au début de la ligne suivante
_HYPHEN_END = re.compile(r"[A-Za-zÀ-ÿ]{2}-$")


def tidy_pdf_text(text: str) -> str:
    """Texte d'un PDF de scénario lu en mode « mise en page » → lignes propres.

    - retire l'indentation et les espaces doublés de la mise en page (les noms de personnages
      restent reconnus : seuls sur leur ligne, en capitales) ;
    - enlève le numéro de scène répété dans la marge de droite ;
    - recolle les mots coupés en fin de ligne.
    """
    out: list[str] = []
    for raw in text.splitlines():
        wide = raw.strip()
        m = _RIGHT_NUMBER.match(wide) or _TRAILING_NUMBER.match(wide)
        if m and m.groupdict().get("num"):
            wide = f"{m['num']} {m['head']}"
        elif m:
            wide = m["head"]
        line = re.sub(r" {2,}", " ", wide)
        if out and _HYPHEN_END.search(out[-1]) and line[:1].islower():
            out[-1] = out[-1][:-1] + line
            continue
        out.append(line)
    return "\n".join(out)


def _docx(data: bytes) -> str:
    from docx import Document

    try:
        doc = Document(io.BytesIO(data))
    except Exception as exc:
        raise AppError(
            "Impossible de lire ce fichier Word.", status_code=422, code="unreadable_file"
        ) from exc
    return "\n".join(p.text for p in doc.paragraphs)


def _fdx(data: bytes) -> str:
    """Final Draft : on reconstruit un texte de type Fountain à partir des types de paragraphes."""
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise AppError(
            "Fichier Final Draft illisible.", status_code=422, code="unreadable_file"
        ) from exc
    out: list[str] = []
    for p in root.iter("Paragraph"):
        kind = p.get("Type", "")
        text = "".join(t.text or "" for t in p.iter("Text")).strip()
        if not text:
            continue
        if kind == "Scene Heading":
            out += ["", text.upper(), ""]
        elif kind == "Character":
            out += ["", text.upper()]
        elif kind in ("Dialogue", "Parenthetical"):
            out.append(text)
        elif kind == "Transition":
            out += ["", text.upper(), ""]
        else:
            out += ["", text]
    return "\n".join(out)


# Bruit de mise en page des PDF de scénario : numéros de page, (SUITE), (MORE), CONTINUED...
_NOISE = re.compile(
    r"^\s*(\d{1,4}\.?|page \d+( sur \d+)?|\((suite|more|à suivre|cont'd|continued)\)|"
    r"(continued|suite)\s*:?|\d{1,4}\s+continued:?)\s*$",
    re.IGNORECASE,
)


_PAGE_NUMBER_EDGE = re.compile(
    r"^(?:page\s+)?\d{1,4}\.?\s+|\s+(?:page\s+)?\d{1,4}\.?$", re.IGNORECASE
)


def _drop_running_headers(lines: list[str]) -> list[str]:
    """Retire l'en-tête ou le pied de page répété d'un PDF (titre du récit sur chaque page).

    Une ligne courte, répétée au moins 3 fois, sans ponctuation finale et pas en capitales
    (« AMIRA » est un nom de personnage qui revient, pas un en-tête). Le numéro de page qui
    change à chaque page est ignoré : « Marée basse - v2 3. » compte comme « Marée basse - v2 ».
    """

    def key(ln: str) -> str:
        return _PAGE_NUMBER_EDGE.sub("", ln.strip())

    counts: dict[str, int] = {}
    for ln in lines:
        k = key(ln)
        if k:
            counts[k] = counts.get(k, 0) + 1
    noise = {
        k
        for k, n in counts.items()
        if n >= 3
        and len(k) <= 60
        and not k.isupper()
        and not k.endswith((".", "!", "?", "…", ":", "»"))
        and not k.startswith(("—", "-", "(", "«"))
    }
    return [ln for ln in lines if key(ln) not in noise]


def clean(text: str) -> str:
    text = unicodedata.normalize("NFC", text).replace(" ", " ").replace("\t", "    ")
    lines = [ln.rstrip() for ln in text.splitlines()]
    lines = [ln for ln in lines if not _NOISE.match(ln)]
    lines = _drop_running_headers(lines)
    return re.sub(r"\n{4,}", "\n\n\n", "\n".join(lines)).strip()


def read_screenplay(
    *, text: str | None = None, filename: str | None = None, data: bytes | None = None
) -> str:
    if text and text.strip():
        raw = text
    elif data is not None:
        if len(data) > MAX_BYTES:
            raise AppError(
                "Fichier trop lourd (5 Mo maximum).", status_code=413, code="file_too_large"
            )
        name = (filename or "").lower()
        if name.endswith(".pdf"):
            raw = _pdf(data)
        elif name.endswith(".docx"):
            raw = _docx(data)
        elif name.endswith(".fdx"):
            raw = _fdx(data)
        elif name.endswith(TEXT_EXT) or not name:
            raw = _decode(data)
        else:
            raise AppError(
                "Format non pris en charge. Formats acceptés : PDF, DOCX, TXT, Fountain, Final Draft (.fdx).",
                status_code=415,
                code="unsupported_format",
            )
    else:
        raise AppError("Aucun scénario reçu.", status_code=400, code="empty_input")

    cleaned = clean(raw)
    if not cleaned:
        raise AppError("Le scénario est vide.", status_code=400, code="empty_input")
    if len(cleaned) > MAX_CHARS:
        raise AppError(
            "Scénario trop long pour une seule analyse.", status_code=413, code="too_long"
        )
    return cleaned
