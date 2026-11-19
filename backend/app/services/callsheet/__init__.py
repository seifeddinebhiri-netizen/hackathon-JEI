"""Convocations : aperçu des feuilles de service, puis envoi après validation du réalisateur."""

import structlog

from app.core.config import Settings
from app.schemas.callsheet import (
    CallsheetDraft,
    CallsheetRequest,
    NotConcerned,
    PreviewResponse,
    SendRequest,
    SendResponse,
    SendResult,
    is_valid_email,
)
from app.services.callsheet.pdf import build_callsheet_pdf, pdf_filename
from app.services.callsheet.render import build_draft, email_body
from app.services.callsheet.resend import Email, ResendSender

log = structlog.get_logger()


def preview(req: CallsheetRequest, settings: Settings) -> PreviewResponse:
    drafts: list[CallsheetDraft] = []
    not_concerned: list[NotConcerned] = []
    for member in req.members:
        result = build_draft(req, member)
        (drafts if isinstance(result, CallsheetDraft) else not_concerned).append(result)
    # Compteurs seulement : jamais de nom, d'adresse ni de texte de scène dans les journaux
    log.info(
        "callsheet_preview",
        members=len(req.members),
        drafts=len(drafts),
        not_concerned=len(not_concerned),
        scenes=len(req.scenes),
    )
    return PreviewResponse(
        drafts=drafts,
        not_concerned=not_concerned,
        email_configured=bool(settings.resend_api_key.get_secret_value()),
    )


def _reply_to(req: CallsheetRequest, settings: Settings) -> str | None:
    for candidate in (req.project.reply_to, settings.email_reply_to):
        if candidate and is_valid_email(candidate):
            return candidate.strip()
    return None


async def send(
    req: SendRequest, settings: Settings, sender: ResendSender | None = None
) -> SendResponse:
    """Envoie les brouillons validés. Une erreur sur un destinataire n'arrête pas les autres."""
    key = settings.resend_api_key.get_secret_value()
    dry_run = not key
    members = {m.id: m for m in req.members}
    reply_to = _reply_to(req, settings)
    own_sender = sender is None and not dry_run
    if own_sender:
        sender = ResendSender(key, settings.email_from)
    results: list[SendResult] = []
    seen: set[str] = set()
    try:
        for edit in req.drafts:
            member = members.get(edit.member_id)
            if member is None:
                results.append(
                    SendResult(
                        member_id=edit.member_id,
                        name="",
                        to="",
                        status="erreur",
                        reason="Membre inconnu dans l'équipe",
                    )
                )
                continue
            base = {"member_id": member.id, "name": member.name, "to": member.email.strip()}
            if member.id in seen:
                results.append(SendResult(**base, status="ignore", reason="Déjà dans la liste"))
                continue
            seen.add(member.id)
            draft = build_draft(
                req,
                member,
                subject=edit.subject,
                message=edit.message,
                include_scene_text=edit.include_scene_text,
            )
            if isinstance(draft, NotConcerned):
                results.append(SendResult(**base, status="ignore", reason=draft.reason))
                continue
            if draft.blocked_reason:
                results.append(SendResult(**base, status="ignore", reason=draft.blocked_reason))
                continue
            if dry_run:
                results.append(SendResult(**base, status="essai", subject=draft.subject))
                continue
            # Le planning part en PDF joint, à la place du texte brut dans l'e-mail
            text, html = email_body(draft.message)
            outcome = await sender.send(
                Email(
                    to=draft.to,
                    subject=draft.subject,
                    text=text,
                    html=html,
                    reply_to=reply_to,
                    ics=draft.ics,
                    ics_filename=draft.ics_filename,
                    pdf=build_callsheet_pdf(draft, req.project.title, req.project.director_name),
                    pdf_filename=pdf_filename(req.project.title, member.name),
                )
            )
            results.append(
                SendResult(
                    **base,
                    status="envoye" if outcome.ok else "erreur",
                    reason=outcome.reason,
                )
            )
    finally:
        if own_sender:
            await sender.aclose()

    sent = sum(r.status == "envoye" for r in results)  # mode essai : 0, rien n'est parti
    skipped = sum(r.status == "ignore" for r in results)
    failed = sum(r.status == "erreur" for r in results)
    log.info("callsheet_send", dry_run=dry_run, sent=sent, skipped=skipped, failed=failed)
    return SendResponse(dry_run=dry_run, results=results, sent=sent, skipped=skipped, failed=failed)
