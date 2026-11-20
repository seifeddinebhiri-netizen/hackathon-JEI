import asyncio
from datetime import UTC, datetime

from pydantic import ValidationError

from app.core.auth import CurrentUser
from app.core.config import Settings
from app.core.errors import AppError
from app.repositories import passport_repository as repo
from app.schemas.ai_tool import Tool
from app.schemas.passport import Declaration, PassportDocument
from app.services import ai_tool_service, c2pa_service, project_service
from app.services.passport_pdf_service import render_pdf


def declarations_from_row(raw: list[dict]) -> list[Declaration]:
    """Les déclarations enregistrées par le front (clé `tool_id` = identifiant de l'outil du catalogue)."""
    out = []
    for d in raw:
        out.append(
            Declaration(
                department=d.get("department"),
                used_ai=bool(d.get("used_ai")),
                tool_slug=d.get("tool_id") or None,
                custom_tool=(d.get("custom_tool") or None),
                what=(d.get("what") or "")[:1500],
                level=d.get("level") or None,
                human_decisions=(d.get("human_decisions") or "")[:1500],
            )
        )
    return out


async def _catalog(pool, declarations: list[Declaration]) -> dict[str, Tool]:
    tools: dict[str, Tool] = {}
    for slug in {d.tool_slug for d in declarations if d.used_ai and d.tool_slug}:
        try:
            tools[slug] = await ai_tool_service.get_tool(pool, slug)
        except AppError:
            pass  # outil inconnu du catalogue : le PDF le dit (« hors catalogue »)
    return tools


async def signed_pdf(
    pool, settings: Settings, user: CurrentUser, project_id: str
) -> tuple[c2pa_service.SignedPdf, str]:
    """PDF du Passeport d'un projet, signé en C2PA. Réservé au propriétaire du projet."""
    await project_service.ensure_owned(pool, project_id, user)
    row = await repo.get_for_project(pool, project_id)
    if row is None:
        raise AppError(
            "Passeport introuvable : remplis d'abord ta déclaration.",
            status_code=404,
            code="introuvable",
        )
    try:
        declarations = declarations_from_row(row["declarations"])
        now = datetime.now(UTC)
        verify_url = f"{settings.public_app_url.rstrip('/')}/verifier/{row['badge_code']}"
        document = PassportDocument(
            passport_id=row["project_id"],
            badge_code=row["badge_code"],
            film_title=row["film_title"],
            director=row["director"] or "—",
            issued_at=now,
            verify_url=verify_url,
            declarations=declarations,
        )
    except (ValidationError, TypeError, AttributeError) as exc:
        raise AppError(
            "La déclaration est incomplète ou invalide : vérifie les 8 départements.",
            status_code=422,
            code="passeport_invalide",
        ) from exc

    tools = await _catalog(pool, declarations)
    pdf = render_pdf(document, tools)
    try:
        # Signer est du calcul pur : hors de la boucle d'événements, pour ne pas bloquer le serveur.
        signed = await asyncio.to_thread(c2pa_service.sign_pdf, pdf, document, tools, settings, now)
    except c2pa_service.C2paNotConfigured as exc:
        raise AppError(
            "La signature C2PA n'est pas configurée sur le serveur.",
            status_code=503,
            code="signature_indisponible",
        ) from exc
    except c2pa_service.C2paSigningFailed as exc:
        raise AppError(
            "La signature C2PA a échoué. Réessaie dans un instant.",
            status_code=502,
            code="signature_echouee",
        ) from exc
    await repo.mark_signed(pool, project_id)
    return signed, f"passeport-ia-{row['badge_code']}.pdf"
