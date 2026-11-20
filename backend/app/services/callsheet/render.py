"""Composition des convocations : quelles scènes pour qui, et le texte de l'e-mail.

Français simple, pour des non-techniciens : « Rendez-vous à 8 h 00 », « Lumière du soir ».
Toute donnée venant du projet est échappée dans le HTML.
"""

import re
import unicodedata
from collections import defaultdict
from datetime import date
from html import escape

from app.schemas.callsheet import (
    CallsheetDraft,
    CallsheetLocation,
    CallsheetRequest,
    DraftScene,
    Member,
    NotConcerned,
    PlannedScene,
    is_valid_email,
)
from app.services.callsheet.ics import IcsDay, build_ics

MOMENT_LABELS = {
    "jour": "En journée",
    "nuit": "De nuit",
    "aube": "Lever du soleil",
    "heure_doree": "Lumière du soir",
}
DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MONTHS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]  # fmt: skip


def hour_fr(hhmm: str) -> str:
    """« 08:00 » → « 8 h 00 »."""
    h, m = hhmm.split(":")
    return f"{int(h)} h {m}"


def date_fr(d: date) -> str:
    """« lundi 1er décembre 2026 »."""
    day = "1er" if d.day == 1 else str(d.day)
    return f"{DAYS[d.weekday()]} {day} {MONTHS[d.month - 1]} {d.year}"


def _key(name: str) -> str:
    """Nom de personnage comparable : sans accents, casse ni espaces en trop."""
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return " ".join(plain.casefold().split())


def scenes_for(member: Member, scenes: list[PlannedScene]) -> list[PlannedScene]:
    """Technicien : tout le planning. Acteur : seulement les scènes de ses personnages."""
    ordered = sorted(scenes, key=lambda s: (s.date, s.start or s.call_time, s.number))
    if member.role == "technicien":
        return ordered
    mine = {_key(c) for c in member.characters if c.strip()}
    return [s for s in ordered if mine & {_key(c) for c in s.characters}]


def first_name(name: str) -> str:
    return name.split()[0] if name.split() else name


def default_subject(film: str, scenes: list[PlannedScene]) -> str:
    first = min(s.date for s in scenes)
    return f"Ta convocation pour « {film} » : à partir du {date_fr(first)}"


def default_message(member: Member, film: str, director: str) -> str:
    who = "tes scènes" if member.role == "acteur" else "le planning complet"
    signature = f"\n\n{director}" if director else ""
    return (
        f"Bonjour {first_name(member.name)},\n\n"
        f"Voici ta convocation pour le tournage de « {film} ». Tu trouveras ci-dessous {who} : "
        "les jours, les heures de rendez-vous et les lieux. Le fichier joint ajoute les jours "
        "de tournage à ton agenda.\n\n"
        f"Pour toute question, réponds simplement à cet e-mail.{signature}"
    )


def _location(scene: PlannedScene, locations: dict[str, CallsheetLocation]) -> tuple[str, str]:
    loc = locations.get(scene.location_id)
    if loc is None:
        return "Lieu à confirmer", ""
    return loc.name or "Lieu à confirmer", loc.address


def _draft_scene(
    s: PlannedScene, locations: dict[str, CallsheetLocation], with_text: bool
) -> DraftScene:
    name, address = _location(s, locations)
    return DraftScene(
        number=s.number,
        title=s.title,
        date=s.date,
        call_time=s.call_time,
        start=s.start,
        end=s.end,
        location_name=name,
        address=address,
        moment_label=MOMENT_LABELS[s.moment],
        characters=s.characters,
        notes=s.notes,
        text=(s.text or None) if with_text else None,
    )


def _by_day(scenes: list[DraftScene]) -> dict[date, list[DraftScene]]:
    days: dict[date, list[DraftScene]] = defaultdict(list)
    for s in scenes:
        days[s.date].append(s)
    return dict(sorted(days.items()))


def _place(s: DraftScene) -> str:
    return f"{s.location_name}, {s.address}" if s.address else s.location_name


def _timing(s: DraftScene) -> str:
    if s.start and s.end:
        return f"de {hour_fr(s.start)} à {hour_fr(s.end)}"
    if s.start:
        return f"à partir de {hour_fr(s.start)}"
    return ""


def schedule_text(member: Member, scenes: list[DraftScene], film: str) -> str:
    title = "Tes scènes" if member.role == "acteur" else "Le planning complet"
    lines = [f"{title} pour « {film} »", ""]
    for day, items in _by_day(scenes).items():
        call = min(s.call_time for s in items)
        places = list(dict.fromkeys(_place(s) for s in items))
        lines.append(date_fr(day).capitalize())
        lines.append(f"Rendez-vous à {hour_fr(call)} : {' / '.join(places)}")
        for s in items:
            detail = ", ".join(x for x in (s.moment_label, _timing(s)) if x)
            head = f"Scène {s.number}" + (f" : {s.title}" if s.title else "")
            lines.append(f"  - {head} ({detail})")
            if s.characters:
                lines.append(f"    Personnages : {', '.join(s.characters)}")
            if s.notes:
                lines.append(f"    À savoir : {s.notes}")
            if s.text:
                lines.append("    Texte de la scène :")
                lines += [f"    {line}" for line in s.text.splitlines()]
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _paragraphs(text: str) -> str:
    return "".join(
        f"<p>{escape(p).replace(chr(10), '<br>')}</p>" for p in re.split(r"\n\s*\n", text) if p
    )


def schedule_html(member: Member, scenes: list[DraftScene], film: str) -> str:
    title = "Tes scènes" if member.role == "acteur" else "Le planning complet"
    parts = [f"<h2>{escape(title)} pour « {escape(film)} »</h2>"]
    for day, items in _by_day(scenes).items():
        call = min(s.call_time for s in items)
        places = " / ".join(escape(p) for p in dict.fromkeys(_place(s) for s in items))
        parts.append(f"<h3>{escape(date_fr(day).capitalize())}</h3>")
        parts.append(f"<p><strong>Rendez-vous à {hour_fr(call)}</strong> : {places}</p><ul>")
        for s in items:
            detail = ", ".join(x for x in (s.moment_label, _timing(s)) if x)
            head = f"Scène {escape(s.number)}" + (f" : {escape(s.title)}" if s.title else "")
            item = f"<li><strong>{head}</strong> ({escape(detail)})"
            if s.characters:
                item += f"<br>Personnages : {escape(', '.join(s.characters))}"
            if s.notes:
                item += f"<br>À savoir : {escape(s.notes)}"
            if s.text:
                item += (
                    '<br>Texte de la scène :<blockquote style="white-space:pre-wrap">'
                    f"{escape(s.text)}</blockquote>"
                )
            parts.append(item + "</li>")
        parts.append("</ul>")
    return "".join(parts)


def compose(message: str, sched_text: str, sched_html: str) -> tuple[str, str]:
    """E-mail complet : le message du réalisateur, puis le planning."""
    text = f"{message.strip()}\n\n{sched_text}"
    html = (
        '<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;'
        'font-size:16px;line-height:1.5;color:#111;max-width:640px">'
        f"{_paragraphs(message.strip())}<hr>{sched_html}</body></html>"
    )
    return text, html


PDF_NOTE = (
    "Ta feuille de service est jointe en PDF. Le fichier .ics ajoute les jours de tournage "
    "à ton agenda."
)


def email_body(message: str) -> tuple[str, str]:
    """Corps de l'e-mail envoyé : le message, puis un renvoi vers la feuille de service en PDF."""
    text = f"{message.strip()}\n\n{PDF_NOTE}\n"
    html = (
        '<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;'
        'font-size:16px;line-height:1.5;color:#111;max-width:640px">'
        f"{_paragraphs(message.strip())}<p><strong>{escape(PDF_NOTE)}</strong></p></body></html>"
    )
    return text, html


def build_ics_for(member: Member, scenes: list[DraftScene], film: str, timezone: str) -> str:
    days = []
    for day, items in _by_day(scenes).items():
        call = min(s.call_time for s in items)
        ends = [s.end for s in items if s.end]
        numbers = ", ".join(s.number for s in items)
        days.append(
            IcsDay(
                day=day,
                call_time=call,
                end_time=max(ends) if ends else None,
                location=" / ".join(dict.fromkeys(_place(s) for s in items)),
                summary=f"Tournage « {film} »",
                description=f"Rendez-vous à {hour_fr(call)}. Scènes : {numbers}.",
            )
        )
    return build_ics(days, uid_prefix=member.id, timezone=timezone)


def blocked_reason(member: Member) -> str | None:
    if not member.email.strip():
        return "Pas d'adresse e-mail"
    if not is_valid_email(member.email):
        return "Adresse e-mail non valide"
    if not member.email_consent:
        return "N'a pas accepté de recevoir des e-mails"
    return None


def build_draft(
    req: CallsheetRequest,
    member: Member,
    *,
    subject: str | None = None,
    message: str | None = None,
    include_scene_text: bool | None = None,
) -> CallsheetDraft | NotConcerned:
    """Brouillon d'un membre, ou la raison pour laquelle il n'est pas concerné."""
    if member.role == "acteur" and not any(c.strip() for c in member.characters):
        return NotConcerned(
            member_id=member.id, name=member.name, reason="Aucun personnage associé"
        )
    mine = scenes_for(member, req.scenes)
    if not mine:
        return NotConcerned(
            member_id=member.id, name=member.name, reason="Aucune scène planifiée pour ce membre"
        )
    with_text = (
        include_scene_text
        if include_scene_text is not None
        else req.include_scene_text or member.id in req.include_scene_text_for
    )
    locations = {loc.id: loc for loc in req.locations}
    scenes = [_draft_scene(s, locations, with_text) for s in mine]
    film = req.project.title
    msg = (
        message if message is not None else default_message(member, film, req.project.director_name)
    )
    sched_text = schedule_text(member, scenes, film)
    text, html = compose(msg, sched_text, schedule_html(member, scenes, film))
    return CallsheetDraft(
        member_id=member.id,
        name=member.name,
        role=member.role,
        to=member.email.strip(),
        subject=subject or default_subject(film, mine),
        message=msg,
        schedule_text=sched_text,
        text=text,
        html=html,
        scenes=scenes,
        ics=build_ics_for(member, scenes, film, req.project.timezone),
        ics_filename="convocation.ics",
        include_scene_text=with_text,
        blocked_reason=blocked_reason(member),
    )
