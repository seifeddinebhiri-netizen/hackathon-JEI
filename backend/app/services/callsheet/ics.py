"""Fichier .ics (RFC 5545) : un événement par jour de tournage d'un membre.

Heures converties en UTC (suffixe Z) : pas besoin de bloc VTIMEZONE, et tous les agendas
affichent l'heure locale correcte.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

PRODID = "-//Encadre//Convocations//FR"
DEFAULT_DURATION = timedelta(hours=2)  # si aucune heure de fin n'est connue


@dataclass(frozen=True)
class IcsDay:
    day: date
    call_time: str  # "08:00"
    end_time: str | None  # "17:30" ou None
    location: str
    summary: str
    description: str


def escape_text(value: str) -> str:
    """Échappement des valeurs TEXT (RFC 5545 §3.3.11)."""
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def fold(line: str) -> str:
    """Coupe une ligne à 75 octets UTF-8 au plus, sans couper un caractère (§3.1)."""
    out, current = [], ""
    for ch in line:
        limit = 75 if not out else 74  # les lignes suivantes commencent par une espace
        if len((current + ch).encode("utf-8")) > limit:
            out.append(current)
            current = ch
        else:
            current += ch
    out.append(current)
    return "\r\n ".join(out)


def _utc(day: date, hhmm: str, tz: ZoneInfo) -> datetime:
    h, m = (int(x) for x in hhmm.split(":"))
    return datetime.combine(day, time(h, m), tzinfo=tz).astimezone(UTC)


def _stamp(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%SZ")


def build_ics(
    days: list[IcsDay], *, uid_prefix: str, timezone: str, now: datetime | None = None
) -> str:
    tz = ZoneInfo(timezone)
    stamp = _stamp(now or datetime.now(UTC))
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    for d in days:
        start = _utc(d.day, d.call_time, tz)
        end = _utc(d.day, d.end_time, tz) if d.end_time else start + DEFAULT_DURATION
        if end <= start:
            end = start + DEFAULT_DURATION
        lines += [
            "BEGIN:VEVENT",
            f"UID:{uid_prefix}-{d.day.isoformat()}@encadre",
            f"DTSTAMP:{stamp}",
            f"DTSTART:{_stamp(start)}",
            f"DTEND:{_stamp(end)}",
            f"SUMMARY:{escape_text(d.summary)}",
            f"LOCATION:{escape_text(d.location)}",
            f"DESCRIPTION:{escape_text(d.description)}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(fold(line) for line in lines) + "\r\n"
