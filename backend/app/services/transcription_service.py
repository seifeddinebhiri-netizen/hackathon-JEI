"""Sous-titres, étape 1 : transcription audio → mots horodatés.

Implémentation ElevenLabs Scribe (POST /v1/speech-to-text). Le fichier est lu depuis
le dossier temporaire créé par le service sous-titres, qui le supprime ensuite.
On ne logge jamais le texte transcrit ni la clé.
"""

import re
from pathlib import Path
from typing import Protocol

import httpx
import structlog

from app.core.config import Settings
from app.core.errors import AppError
from app.schemas.subtitle import Transcript, Word

log = structlog.get_logger()

ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"
ELEVENLABS_MODEL = "scribe_v2"

# Limites ElevenLabs : 50 caractères et 5 mots par terme, certains caractères refusés.
# On se limite à 50 termes (au-delà de 100, ElevenLabs facture 20 s minimum).
MAX_KEYTERMS = 50
_KEYTERM_MAX_CHARS = 50
_KEYTERM_MAX_WORDS = 5
_KEYTERM_FORBIDDEN = re.compile(r"[<>{}\[\]\\]")

# Scribe accepte un code ISO-639-1 ou ISO-639-3, sans code de dialecte : « aeb » (arabe
# tunisien) est refusé (400). La derja part donc en « ara » (arabe).
DERJA_LANGUAGE_CODE = "ara"
_LANGUAGE_ALIASES = {"aeb": DERJA_LANGUAGE_CODE, "derja": DERJA_LANGUAGE_CODE}
_ERROR_DETAIL_MAX_CHARS = 300


class Transcriber(Protocol):
    name: str  # ex. "elevenlabs/scribe_v2", repris dans processing.transcriber

    async def transcribe(
        self,
        file: Path,
        filename: str,
        language_code: str | None,
        keyterms: list[str],
    ) -> Transcript: ...


def clean_keyterms(keyterms: list[str]) -> list[str]:
    """Nettoie les termes fournis par le front (noms de personnages, lieux)."""
    out: list[str] = []
    seen: set[str] = set()
    for term in keyterms:
        term = " ".join(_KEYTERM_FORBIDDEN.sub(" ", term).split())
        if not term or len(term) > _KEYTERM_MAX_CHARS:
            continue
        if len(term.split()) > _KEYTERM_MAX_WORDS:
            continue
        if term.lower() in seen:
            continue
        seen.add(term.lower())
        out.append(term)
        if len(out) == MAX_KEYTERMS:
            break
    return out


def scribe_language(code: str | None) -> str | None:
    """Code envoyé à Scribe : « aeb » / « derja » → « ara » ; vide → détection automatique."""
    code = (code or "").strip().lower()
    return _LANGUAGE_ALIASES.get(code, code) or None


def error_detail(resp: httpx.Response) -> str | None:
    """Champ d'erreur d'ElevenLabs (detail / message), tronqué. Ne reprend jamais le champ
    `input` des erreurs de validation : seulement leur emplacement et leur message."""
    try:
        data = resp.json()
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    detail = data.get("detail", data.get("message"))
    if isinstance(detail, dict):
        text = ": ".join(str(detail[k]) for k in ("status", "message") if detail.get(k))
    elif isinstance(detail, list):
        text = "; ".join(
            f"{'.'.join(map(str, d.get('loc') or []))}: {d.get('msg', '')}"
            if isinstance(d, dict)
            else str(d)
            for d in detail
        )
    elif detail is None:
        return None
    else:
        text = str(detail)
    return text[:_ERROR_DETAIL_MAX_CHARS] or None


def parse_words(payload: dict) -> list[Word]:
    """Garde les mots et les espaces ; ignore les autres types (événements audio…)."""
    words: list[Word] = []
    for raw in payload.get("words") or []:
        kind = raw.get("type", "word")
        if kind not in ("word", "spacing"):
            continue
        if raw.get("start") is None or raw.get("end") is None:
            continue
        words.append(
            Word(
                text=raw.get("text", ""),
                start=float(raw["start"]),
                end=float(raw["end"]),
                logprob=float(raw.get("logprob") or 0.0),
                speaker_id=raw.get("speaker_id"),
                type=kind,
            )
        )
    return words


class ElevenLabsTranscriber:
    name = f"elevenlabs/{ELEVENLABS_MODEL}"

    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        self._key = settings.elevenlabs_api_key.get_secret_value()
        self._client = client

    @property
    def available(self) -> bool:
        return bool(self._key)

    async def transcribe(
        self,
        file: Path,
        filename: str,
        language_code: str | None,
        keyterms: list[str],
    ) -> Transcript:
        if not self._key:
            raise AppError(
                "La transcription n'est pas configurée sur ce serveur (clé ElevenLabs absente).",
                503,
                "transcription_unavailable",
            )
        data: dict[str, str | list[str]] = {
            "model_id": ELEVENLABS_MODEL,
            "diarize": "true",
            "timestamps_granularity": "word",
            "tag_audio_events": "false",
        }
        language_code = scribe_language(language_code)
        if language_code:
            data["language_code"] = language_code
        terms = clean_keyterms(keyterms)
        if terms:
            data["keyterms"] = terms  # champ multipart répété, comme le SDK officiel

        client = self._client or httpx.AsyncClient(timeout=httpx.Timeout(600, connect=10))
        try:
            with file.open("rb") as fh:
                resp = await client.post(
                    ELEVENLABS_STT_URL,
                    headers={"xi-api-key": self._key},
                    data=data,
                    files={"file": (filename, fh)},
                )
        except httpx.HTTPError as exc:
            log.error("transcription_request_failed", error=type(exc).__name__)
            raise AppError(
                "Le service de transcription ne répond pas. Réessaie dans un moment.",
                502,
                "transcription_failed",
            ) from exc
        finally:
            if self._client is None:
                await client.aclose()

        if resp.status_code >= 400:
            # 4xx : seulement le champ d'erreur, tronqué (jamais le corps entier ni la clé).
            log.error(
                "transcription_http_error",
                status=resp.status_code,
                detail=error_detail(resp) if resp.status_code < 500 else None,
            )
            raise AppError(
                "La transcription a échoué. Vérifie le fichier (audio ou vidéo lisible) "
                "et réessaie.",
                502,
                "transcription_failed",
            )
        payload = resp.json()
        return Transcript(words=parse_words(payload), language_code=payload.get("language_code"))
