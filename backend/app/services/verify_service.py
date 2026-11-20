import asyncio

from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import AppError
from app.repositories import passport_repository as repo
from app.schemas.verify import PdfVerification, VerifiedTool
from app.services import c2pa_service
from app.services.passport_fingerprint import passport_fingerprint
from app.services.passport_service import declarations_from_row

_gate: asyncio.Semaphore | None = None


def _semaphore(limit: int) -> asyncio.Semaphore:
    global _gate
    if _gate is None:
        _gate = asyncio.Semaphore(max(1, limit))
    return _gate


async def _compare(pool, claims: dict) -> tuple[bool | None, list[str]]:
    """Le Passeport actuel est-il celui que ce PDF a signé ? Sans rien révéler du Passeport."""
    badge = claims.get("badge_code")
    if not badge:
        return None, ["Ce PDF ne contient pas les informations d'un Passeport Premier Plan."]
    row = await repo.get_by_badge(pool, badge)
    if row is None:
        return None, [
            "Aucun Passeport ne porte ce code dans notre base (supprimé, ou autre émetteur)."
        ]
    signed = claims.get("passport_sha256")
    if not signed:
        return None, ["Ce PDF ne contient pas d'empreinte du Passeport : comparaison impossible."]
    try:
        current = passport_fingerprint(
            row["film_title"], row["director"] or "—", declarations_from_row(row["declarations"])
        )
    except (ValidationError, TypeError, AttributeError):
        return None, ["Le Passeport actuel est incomplet : comparaison impossible."]
    if current != signed:
        return False, ["Le Passeport a été modifié depuis l'émission de ce PDF."]
    return True, []


async def verify_uploaded_pdf(pool, settings: Settings, data: bytes) -> PdfVerification:
    """Lit la signature d'un PDF déposé. Ne stocke rien. Un fichier signé par quelqu'un d'autre est
    reconnu comme tel (`issued_by_us = False`), même si ses informations imitent les nôtres."""
    async with _semaphore(settings.verify_pdf_concurrency):
        # Lecture d'un fichier inconnu par une bibliothèque native : hors de la boucle d'événements.
        v = await asyncio.to_thread(c2pa_service.verify_pdf, data, settings)
    if v.state == "none":
        return PdfVerification(state="none")
    if v.state == "invalid":
        return PdfVerification(state="invalid", problems=v.problems)

    ours = c2pa_service.our_cert_serial(settings)
    issued_by_us = v.state == "trusted" or (ours is not None and v.cert_serial == ours)
    matches, reasons = (await _compare(pool, v.claims)) if issued_by_us else (None, [])
    mode = v.claims.get("signing_mode") if issued_by_us else None
    return PdfVerification(
        state=v.state,
        issued_by_us=issued_by_us,
        signer=v.signer,
        issuer=v.issuer,
        signing_mode=mode if mode in ("test", "production") else None,
        badge_code=v.claims.get("badge_code") if issued_by_us else None,
        film_title=v.claims.get("film_title") if issued_by_us else None,
        issued_at=v.claims.get("issued_at") if issued_by_us else None,
        tools=[VerifiedTool(**t) for t in v.claims.get("tools", [])] if issued_by_us else [],
        problems=v.problems,
        matches_passport=matches,
        reasons=reasons,
    )


async def read_upload(file, max_bytes: int) -> bytes:
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise AppError("Fichier trop volumineux.", status_code=413, code="trop_volumineux")
    if not data.startswith(b"%PDF"):
        raise AppError("Ce fichier n'est pas un PDF.", status_code=422, code="pas_un_pdf")
    return data
