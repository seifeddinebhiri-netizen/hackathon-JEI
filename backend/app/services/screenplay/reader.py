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
    text = "\n".join(pages)
    if len(text.strip()) < 20:
        raise AppError(
            "Ce PDF ne contient pas de texte lisible (scan ?). Colle le texte ou envoie un fichier texte.",
            status_code=422,
            code="no_text_layer",
        )
    return text


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


def clean(text: str) -> str:
    text = unicodedata.normalize("NFC", text).replace(" ", " ").replace("\t", "    ")
    lines = [ln.rstrip() for ln in text.splitlines()]
    lines = [ln for ln in lines if not _NOISE.match(ln)]
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
