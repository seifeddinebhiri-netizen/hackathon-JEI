"""Envoi d'un e-mail par l'API HTTP de Resend (https://resend.com/docs/api-reference).

Rien n'est journalisé sur le contenu : ni objet, ni texte, ni adresse.
"""

import asyncio
import base64
import hashlib
import json
from dataclasses import dataclass

import httpx

RESEND_URL = "https://api.resend.com/emails"
PAUSE_BETWEEN_SENDS = 0.6  # offre gratuite : 2 requêtes par seconde
MAX_RETRY_WAIT = 5.0


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    text: str
    html: str
    reply_to: str | None
    ics: str
    ics_filename: str
    pdf: bytes = b""
    pdf_filename: str = ""


@dataclass(frozen=True)
class SendOutcome:
    ok: bool
    reason: str | None = None


def idempotency_key(email: Email) -> str:
    """Même e-mail renvoyé deux fois (double clic, nouvel essai) : un seul envoi chez Resend."""
    # Pas le PDF : il contient sa date de création, et changerait à chaque essai. Le .ics
    # et le texte déterminent déjà son contenu (mêmes scènes, mêmes heures, mêmes lieux).
    raw = json.dumps([email.to, email.subject, email.text, email.ics], ensure_ascii=False)
    return "convocation-" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:40]


def _reason(response: httpx.Response) -> str:
    try:
        message = response.json().get("message")
    except ValueError:
        message = None
    base = {
        401: "clé Resend refusée",
        403: "expéditeur ou destinataire refusé par Resend",
        422: "e-mail refusé par Resend",
        429: "trop d'envois d'un coup, réessaie dans une minute",
    }.get(response.status_code, f"erreur Resend ({response.status_code})")
    return f"{base} : {str(message)[:160]}" if message else base


class ResendSender:
    def __init__(self, api_key: str, sender: str, client: httpx.AsyncClient | None = None):
        self._key = api_key
        self._from = sender
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(20, connect=10))
        self._sent_once = False

    async def send(self, email: Email) -> SendOutcome:
        if self._sent_once:
            await asyncio.sleep(PAUSE_BETWEEN_SENDS)
        self._sent_once = True
        payload = {
            "from": self._from,
            "to": [email.to],
            "subject": email.subject,
            "text": email.text,
            "html": email.html,
            "attachments": [
                {
                    "filename": email.ics_filename,
                    "content": base64.b64encode(email.ics.encode("utf-8")).decode("ascii"),
                    "content_type": "text/calendar; charset=utf-8; method=PUBLISH",
                }
            ],
        }
        if email.pdf:
            # La feuille de service en PDF, avant l'agenda
            payload["attachments"].insert(
                0,
                {
                    "filename": email.pdf_filename,
                    "content": base64.b64encode(email.pdf).decode("ascii"),
                    "content_type": "application/pdf",
                },
            )
        if email.reply_to:
            payload["reply_to"] = email.reply_to
        headers = {
            "Authorization": f"Bearer {self._key}",
            "Idempotency-Key": idempotency_key(email),
        }
        try:
            for attempt in (1, 2):
                response = await self._client.post(RESEND_URL, json=payload, headers=headers)
                if response.status_code != 429 or attempt == 2:
                    break
                try:
                    wait = float(response.headers.get("retry-after", "1"))
                except ValueError:
                    wait = 1.0
                await asyncio.sleep(min(wait, MAX_RETRY_WAIT))
        except httpx.TimeoutException:
            return SendOutcome(False, "Resend n'a pas répondu à temps")
        except httpx.HTTPError:
            return SendOutcome(False, "Resend injoignable")
        if response.is_success:
            return SendOutcome(True)
        return SendOutcome(False, _reason(response))

    async def aclose(self) -> None:
        await self._client.aclose()
