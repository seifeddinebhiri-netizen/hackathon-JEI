"""Kit Festival : brouillon de sous-titres.

Flux : fichier audio/vidéo → transcription → découpage → traduction FR + EN (par lots,
avec glossaire derja) → confiance finale → règles de sous-titrage → brouillon à relire.

Vie privée : le fichier reçu est écrit dans un dossier temporaire supprimé dans un
`finally`, en cas de succès comme d'erreur. L'audio n'est jamais stocké. Les logs ne
contiennent ni le texte des répliques ni les clés : seulement durée, nombre de lignes,
fournisseurs et temps de traitement.

Stockage : table `subtitle_drafts` (Supabase Postgres) quand DATABASE_URL est configurée,
sinon un dict en mémoire (perdu au redémarrage), comme le repli des festivals.
"""

import asyncio
import json
import shutil
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import asyncpg
import structlog
from fastapi import UploadFile

from app.core.errors import AppError
from app.schemas.subtitle import (
    Confidence,
    Cue,
    SubtitleDraft,
    SubtitleLine,
    SubtitleProcessing,
    TranslatedLine,
    TranslationContext,
)
from app.services import glossary_service, subtitle_rules
from app.services.subtitle_segmentation import segment
from app.services.transcription_service import DERJA_LANGUAGE_CODE, Transcriber
from app.services.translation_service import (
    BATCH_SIZE,
    Translator,
    set_deadline,
    track_models,
    used_translator_name,
)

log = structlog.get_logger()

DEFAULT_SOURCE_LANG = "derja"
LOW_ASR_CONFIDENCE = 0.6
_CHUNK = 1024 * 1024
_LEVELS: list[Confidence] = ["faible", "moyenne", "elevee"]


# --- Confiance finale --------------------------------------------------------------
def final_confidence(
    llm: Confidence, asr_confidence: float, note: str | None, glossary_used: list[str]
) -> Confidence:
    """Part du LLM, baisse d'un cran par signal de doute ; jamais au-dessus du LLM."""
    level = _LEVELS.index(llm)
    if asr_confidence < LOW_ASR_CONFIDENCE:
        level -= 1
    if note and not glossary_used:  # tournure signalée par le LLM, absente du glossaire
        level -= 1
    return _LEVELS[max(0, level)]


# --- Stockage ----------------------------------------------------------------------
_memory: dict[str, SubtitleDraft] = {}
_memory_logged = False


def _use_memory(pool: asyncpg.Pool | None) -> bool:
    global _memory_logged
    if pool is None:
        # Une seule fois par processus : le repli en mémoire ne doit pas être silencieux.
        if not _memory_logged:
            log.warning("subtitles_storage_memory", reason="base non configurée ou injoignable")
            _memory_logged = True
        return True
    return False


def _from_row(row: Any) -> SubtitleDraft:
    data = dict(row)
    for key in ("lines", "processing"):
        if isinstance(data.get(key), str):  # jsonb renvoyé en texte par asyncpg
            data[key] = json.loads(data[key])
    return SubtitleDraft.model_validate(data)


async def load_draft(pool: asyncpg.Pool | None, project_id: str) -> SubtitleDraft | None:
    if _use_memory(pool):
        draft = _memory.get(project_id)
        return draft.model_copy(deep=True) if draft else None
    try:
        row = await pool.fetchrow(
            "select project_id, source_lang, lines, processing "
            "from public.subtitle_drafts where project_id = $1",
            project_id,
        )
    except Exception as exc:
        log.error("subtitles_query_failed", error=type(exc).__name__)
        raise AppError(
            "Impossible de charger les sous-titres pour le moment.", 503, "subtitles_unavailable"
        ) from exc
    return _from_row(row) if row else None


async def save_draft(pool: asyncpg.Pool | None, draft: SubtitleDraft) -> SubtitleDraft:
    if _use_memory(pool):
        _memory[draft.project_id] = draft.model_copy(deep=True)
        return draft
    lines = json.dumps([line.model_dump(mode="json") for line in draft.lines], ensure_ascii=False)
    processing = draft.processing.model_dump_json() if draft.processing else None
    try:
        await pool.execute(
            "insert into public.subtitle_drafts "
            "(project_id, source_lang, lines, processing, updated_at) "
            "values ($1, $2, $3::jsonb, $4::jsonb, now()) "
            "on conflict (project_id) do update set source_lang = excluded.source_lang, "
            "lines = excluded.lines, processing = excluded.processing, updated_at = now()",
            draft.project_id,
            draft.source_lang,
            lines,
            processing,
        )
    except Exception as exc:
        log.error("subtitles_save_failed", error=type(exc).__name__)
        raise AppError(
            "Impossible d'enregistrer les sous-titres pour le moment.",
            503,
            "subtitles_unavailable",
        ) from exc
    return draft


# --- Lecture / enregistrement ------------------------------------------------------
async def get_draft(pool: asyncpg.Pool | None, project_id: str) -> SubtitleDraft:
    draft = await load_draft(pool, project_id)
    return draft or SubtitleDraft(project_id=project_id, source_lang=DEFAULT_SOURCE_LANG, lines=[])


async def save_lines(
    pool: asyncpg.Pool | None, project_id: str, lines: list[SubtitleLine]
) -> SubtitleDraft:
    """PUT : remplace la liste complète. Avertissements recalculés, temps non modifiés."""
    ids = [line.id for line in lines]
    if len(ids) != len(set(ids)):
        raise AppError("Deux lignes ont le même identifiant.", 422, "duplicate_line_id")
    existing = await load_draft(pool, project_id)
    draft = SubtitleDraft(
        project_id=project_id,
        source_lang=existing.source_lang if existing else DEFAULT_SOURCE_LANG,
        lines=subtitle_rules.apply_rules(lines, autofix=False),
        processing=existing.processing if existing else None,
    )
    return await save_draft(pool, draft)


# --- Brouillon automatique ---------------------------------------------------------
async def _write_upload(upload: UploadFile, dest: Path, max_bytes: int) -> int:
    size = 0
    with dest.open("wb") as out:
        while chunk := await upload.read(_CHUNK):
            size += len(chunk)
            if size > max_bytes:
                raise AppError(
                    f"Fichier trop volumineux (maximum {max_bytes // (1024 * 1024)} Mo).",
                    413,
                    "file_too_large",
                )
            out.write(chunk)
    if size == 0:
        raise AppError("Le fichier envoyé est vide.", 422, "empty_file")
    return size


async def _translate(
    translator: Translator, cues: list[Cue], characters: list[str]
) -> list[TranslatedLine]:
    out: list[TranslatedLine] = []
    for i in range(0, len(cues), BATCH_SIZE):
        batch = cues[i : i + BATCH_SIZE]
        glossary: dict[str, Any] = {}
        for cue in batch:
            for entry in glossary_service.find_entries(cue.source):
                glossary[entry.id] = entry
        context = TranslationContext(
            previous=cues[i - 1].source if i > 0 else None,
            next=cues[i + BATCH_SIZE].source if i + BATCH_SIZE < len(cues) else None,
            characters=characters,
            glossary=list(glossary.values()),
        )
        out.extend(await translator.translate(batch, context))
    return out


def _source_lang(requested: str | None, detected: str | None) -> str:
    code = (requested or detected or "").lower()
    return DEFAULT_SOURCE_LANG if code in ("", "aeb", "derja", DERJA_LANGUAGE_CODE) else code


async def create_draft(
    pool: asyncpg.Pool | None,
    transcriber: Transcriber,
    translator: Translator | None,
    project_id: str,
    upload: UploadFile,
    max_upload_mb: int,
    language_code: str | None = None,
    keyterms: list[str] | None = None,
    characters: list[str] | None = None,
    timeout_s: float | None = None,
) -> SubtitleDraft:
    """Brouillon complet, borné par timeout_s : au-delà (transcription trop lente : la
    traduction, elle, s'arrête avant le budget), 504. Le fichier temporaire est
    supprimé par le `finally` de _build_draft ; rien n'est enregistré."""
    started = time.monotonic()
    set_deadline(timeout_s)  # Gemini s'arrête avant : lignes « faible » plutôt qu'un 504
    try:
        async with asyncio.timeout(timeout_s) as deadline:
            return await _build_draft(
                pool,
                transcriber,
                translator,
                project_id,
                upload,
                max_upload_mb,
                language_code,
                keyterms,
                characters,
            )
    except TimeoutError as exc:
        if not deadline.expired():
            raise
        log.error(
            "subtitles_draft_timeout",
            timeout_s=timeout_s,
            total_s=round(time.monotonic() - started, 1),
        )
        raise AppError(
            f"Le brouillon prend trop de temps (plus de {round(timeout_s or 0)} s) : "
            "le service de transcription ou de traduction est lent. Réessaie dans quelques minutes.",
            504,
            "draft_timeout",
        ) from exc


async def _build_draft(
    pool: asyncpg.Pool | None,
    transcriber: Transcriber,
    translator: Translator | None,
    project_id: str,
    upload: UploadFile,
    max_upload_mb: int,
    language_code: str | None,
    keyterms: list[str] | None,
    characters: list[str] | None,
) -> SubtitleDraft:
    # Vérifie les deux fournisseurs AVANT d'envoyer l'audio (une transcription est payante).
    if not getattr(transcriber, "available", True):
        raise AppError(
            "La transcription n'est pas configurée sur ce serveur.",
            503,
            "transcription_unavailable",
        )
    if translator is None or not translator.available:
        raise AppError(
            "La traduction n'est pas configurée sur ce serveur.", 503, "translation_unavailable"
        )
    max_bytes = max_upload_mb * 1024 * 1024
    if upload.size is not None and upload.size > max_bytes:
        raise AppError(
            f"Fichier trop volumineux (maximum {max_upload_mb} Mo).", 413, "file_too_large"
        )

    started = time.monotonic()
    filename = Path(upload.filename or "").name or "audio"
    tmp_dir = Path(tempfile.mkdtemp(prefix="encadre-subtitles-"))
    try:
        path = tmp_dir / "upload"
        size = await _write_upload(upload, path, max_bytes)
        transcript = await transcriber.transcribe(path, filename, language_code, keyterms or [])
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
    transcribed_at = time.monotonic()

    cues = segment(transcript.words)
    if not cues:
        raise AppError("Aucune parole détectée dans ce fichier.", 422, "no_speech")
    used_models = track_models()
    translations = await _translate(translator, cues, characters or [])
    translator_name = used_translator_name(translator, used_models)

    lines = [
        SubtitleLine(
            id=cue.id,
            start=cue.start,
            end=cue.end,
            source=cue.source,
            fr=tr.fr,
            en=tr.en,
            confidence=final_confidence(
                tr.confidence, cue.asr_confidence, tr.note, tr.glossary_used
            ),
            note=tr.note,
            validated=False,
            speaker=cue.speaker,
            glossary_used=tr.glossary_used,
        )
        for cue, tr in zip(cues, translations, strict=True)
    ]
    draft = SubtitleDraft(
        project_id=project_id,
        source_lang=_source_lang(language_code, transcript.language_code),
        lines=subtitle_rules.apply_rules(lines),
        processing=SubtitleProcessing(
            transcriber=transcriber.name,
            translator=translator_name,
            created_at=datetime.now(UTC),
        ),
    )
    await save_draft(pool, draft)

    words = [w for w in transcript.words if w.type == "word"]
    log.info(
        "subtitles_draft_created",
        audio_s=round(words[-1].end, 1) if words else 0,
        upload_mb=round(size / (1024 * 1024), 1),
        lines=len(draft.lines),
        warnings=sum(len(line.warnings) for line in draft.lines),
        low_confidence=sum(1 for line in draft.lines if line.confidence == "faible"),
        transcriber=transcriber.name,
        translator=translator_name,
        transcription_s=round(transcribed_at - started, 1),
        total_s=round(time.monotonic() - started, 1),
    )
    return draft
