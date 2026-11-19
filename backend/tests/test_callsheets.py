import base64
import copy
import io
import json
from pathlib import Path
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core import auth
from app.core.config import Settings
from app.main import app
from app.schemas.callsheet import CallsheetRequest, SendRequest
from app.services import callsheet
from app.services.callsheet import resend
from app.services.callsheet.ics import fold
from app.services.callsheet.pdf import build_callsheet_pdf, pdf_filename
from app.services.callsheet.render import build_draft, hour_fr, scenes_for
from app.services.callsheet.resend import RESEND_URL, ResendSender

FIXTURE = Path(__file__).parent / "fixtures" / "callsheet_request.json"
DEMO = {"Authorization": "Bearer demo.u-demo.test"}
OWNER = UUID(int=7)


def raw() -> dict:
    # Lecture explicite en UTF-8 : le projet tourne aussi sous Windows (cp1252 par défaut)
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def request(**changes) -> CallsheetRequest:
    return CallsheetRequest.model_validate({**raw(), **changes})


def member(req: CallsheetRequest, member_id: str):
    return next(m for m in req.members if m.id == member_id)


def draft(req: CallsheetRequest, member_id: str, **kw):
    return build_draft(req, member(req, member_id), **kw)


# --- Qui reçoit quoi ---------------------------------------------------------------------


def test_actor_only_gets_scenes_of_their_characters():
    req = request()
    numbers = [s.number for s in scenes_for(member(req, "m-amira"), req.scenes)]
    assert numbers == ["1", "3"]  # « amira » en minuscules dans la scène 3 : même personnage
    assert [s.number for s in scenes_for(member(req, "m-slim"), req.scenes)] == ["1"]
    d = draft(req, "m-amira")
    assert "La cuisine" not in d.text and "Scène 2" not in d.text
    assert "Scène 1" in d.text and "Scène 3" in d.text


def test_technician_gets_the_whole_schedule():
    req = request()
    d = draft(req, "m-image")
    assert [s.number for s in d.scenes] == ["1", "2", "3"]
    assert "Le planning complet" in d.text


def test_actor_without_character_is_not_concerned():
    res = callsheet.preview(request(), Settings(resend_api_key=""))
    reasons = {n.member_id: n.reason for n in res.not_concerned}
    assert reasons == {"m-sans-role": "Aucun personnage associé"}
    assert {d.member_id for d in res.drafts} == {"m-amira", "m-slim", "m-nour", "m-image"}
    assert res.email_configured is False


def test_plain_french_wording():
    d = draft(request(), "m-amira")
    assert "Rendez-vous à 6 h 30" in d.text
    assert "Lever du soleil" in d.text
    assert "Lumière du soir" in d.text
    assert "mardi 1er décembre 2026" in d.subject
    for jargon in ("RDV", "heure dorée", "heure_doree", "golden"):
        assert jargon not in d.text and jargon not in d.html
    assert hour_fr("08:05") == "8 h 05"


def test_html_escapes_project_data():
    data = raw()
    data["project"]["title"] = "<script>alert(1)</script>"
    data["scenes"][0]["notes"] = '<img src=x onerror="alert(1)">'
    d = build_draft(CallsheetRequest.model_validate(data), member(request(), "m-image"))
    assert "<script>" not in d.html and "<img" not in d.html
    assert "&lt;script&gt;" in d.html


# --- Texte des scènes ----------------------------------------------------------------------


def test_scene_text_is_absent_by_default():
    req = request()
    for member_id in ("m-amira", "m-image"):
        d = draft(req, member_id)
        assert "Amira regarde le ferry" not in d.text + d.html
        assert all(s.text is None for s in d.scenes)
        assert d.include_scene_text is False


def test_scene_text_only_for_the_members_own_scenes():
    req = request(include_scene_text_for=["m-amira"])
    d = draft(req, "m-amira")
    assert "Amira regarde le ferry" in d.text
    assert "Amira seule face à la mer" in d.text
    assert "La mère prépare le café" not in d.text  # scène 2 : pas la sienne
    # Les autres membres ne le reçoivent pas
    assert "Amira regarde le ferry" not in draft(req, "m-image").text


# --- Fichier .ics ---------------------------------------------------------------------------


def test_ics_has_one_event_per_shooting_day_with_place_and_time():
    ics = draft(request(), "m-amira").ics
    assert ics.startswith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")
    assert ics.endswith("END:VCALENDAR\r\n")
    assert "\n" not in ics.replace("\r\n", "")  # uniquement des fins de ligne CRLF
    unfolded = ics.replace("\r\n ", "")
    assert unfolded.count("BEGIN:VEVENT") == 2  # 1er et 2 décembre
    # Tunis = UTC+1 : rendez-vous 6 h 30 → 05:30 UTC ; fin de la scène 1 à 9 h → 08:00 UTC
    assert "DTSTART:20261201T053000Z" in unfolded
    assert "DTEND:20261201T080000Z" in unfolded
    assert "DTSTART:20261202T150000Z" in unfolded
    # Virgules échappées dans LOCATION (RFC 5545)
    assert "LOCATION:Port de La Goulette\\, Quai 3\\, La Goulette\\, Tunis" in unfolded
    assert "UID:m-amira-2026-12-01@encadre" in unfolded


def test_ics_lines_are_folded_at_75_octets():
    line = "DESCRIPTION:" + "é" * 100
    for part in fold(line).split("\r\n"):
        assert len(part.encode("utf-8")) <= 75


def test_unknown_timezone_is_rejected():
    data = raw()
    data["project"]["timezone"] = "Mars/Olympus"
    with pytest.raises(ValueError):
        CallsheetRequest.model_validate(data)


# --- Envoi ----------------------------------------------------------------------------------


def send_request(**changes) -> SendRequest:
    drafts = [
        {"member_id": m, "subject": f"Convocation {m}", "message": f"Bonjour {m}"}
        for m in ("m-amira", "m-slim", "m-nour", "m-image")
    ]
    return SendRequest.model_validate({**raw(), "drafts": drafts, **changes})


@pytest.fixture
def resend_server(monkeypatch):
    """Faux serveur Resend : refuse karim@ et youssef@ pour tester les erreurs."""
    monkeypatch.setattr(resend, "PAUSE_BETWEEN_SENDS", 0)
    calls: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        body = json.loads(req.content)
        if body["to"] == ["youssef@example.com"]:
            return httpx.Response(422, json={"message": "Invalid `to` field"})
        return httpx.Response(200, json={"id": f"email-{len(calls)}"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return calls, ResendSender("re_test", "Encadré <test@example.com>", client=client)


@pytest.mark.asyncio
async def test_dry_run_without_key_sends_nothing(resend_server):
    calls, sender = resend_server
    res = await callsheet.send(send_request(), Settings(resend_api_key=""), sender=sender)
    assert res.dry_run is True
    statuses = {r.member_id: r.status for r in res.results}
    assert statuses["m-amira"] == "essai"
    assert statuses["m-image"] == "essai"
    assert next(r for r in res.results if r.member_id == "m-amira").subject == "Convocation m-amira"
    assert res.sent == 0
    assert calls == []


@pytest.mark.asyncio
async def test_refuses_without_consent_or_valid_email(resend_server):
    calls, sender = resend_server
    res = await callsheet.send(send_request(), Settings(resend_api_key="re_x"), sender=sender)
    by_id = {r.member_id: r for r in res.results}
    assert by_id["m-slim"].status == "ignore"
    assert "accepté" in by_id["m-slim"].reason
    assert by_id["m-nour"].status == "ignore"
    assert "non valide" in by_id["m-nour"].reason
    sent_to = [json.loads(c.content)["to"][0] for c in calls]
    assert "karim@example.com" not in sent_to
    assert "pas-une-adresse" not in sent_to


@pytest.mark.asyncio
async def test_status_per_recipient_and_errors_do_not_stop_others(resend_server):
    _calls, sender = resend_server
    req = send_request()
    # youssef (refusé par Resend) passe avant amira : amira doit quand même partir
    req.drafts.reverse()
    res = await callsheet.send(req, Settings(resend_api_key="re_x"), sender=sender)
    by_id = {r.member_id: r for r in res.results}
    assert by_id["m-image"].status == "erreur"
    assert "Invalid `to` field" in by_id["m-image"].reason
    assert by_id["m-amira"].status == "envoye"
    assert (res.sent, res.skipped, res.failed) == (1, 2, 1)
    assert res.dry_run is False


@pytest.mark.asyncio
async def test_resend_payload(resend_server):
    calls, sender = resend_server
    await callsheet.send(send_request(), Settings(resend_api_key="re_x"), sender=sender)
    req = next(c for c in calls if json.loads(c.content)["to"] == ["ines@example.com"])
    body = json.loads(req.content)
    assert str(req.url) == RESEND_URL
    assert req.headers["authorization"] == "Bearer re_test"
    assert req.headers["idempotency-key"].startswith("convocation-")
    assert body["reply_to"] == "realisation@example.com"
    assert body["subject"] == "Convocation m-amira"
    assert body["text"].startswith("Bonjour m-amira")  # le message modifié est bien utilisé
    # Le planning part en PDF joint, pas en texte brut dans l'e-mail
    assert "jointe en PDF" in body["text"]
    assert "Rendez-vous à" not in body["text"]
    files = {a["filename"]: base64.b64decode(a["content"]) for a in body["attachments"]}
    assert set(files) == {"Le-dernier-ferry_convocation_Ines.pdf", "convocation.ics"}
    assert body["attachments"][0]["content_type"] == "application/pdf"
    assert files["Le-dernier-ferry_convocation_Ines.pdf"].startswith(b"%PDF")
    assert files["convocation.ics"].decode("utf-8").startswith("BEGIN:VCALENDAR")
    assert "Amira regarde le ferry" not in body["text"]


def _pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    return "\n".join(page.extract_text() for page in PdfReader(io.BytesIO(data)).pages)


def test_pdf_has_only_the_members_scenes_and_page_numbers():
    req = request()
    d = draft(req, "m-amira")
    text = _pdf_text(build_callsheet_pdf(d, req.project.title, req.project.director_name))
    assert "Le dernier ferry" in text  # titre du film en haut
    assert "Ines Trabelsi" in text
    assert "Rendez-vous à 6 h 30" in text
    assert "Scène 1" in text and "Scène 3" in text
    assert "La cuisine" not in text  # scène 2 : pas la sienne
    assert "Amira regarde le ferry" not in text  # pas de texte de scène par défaut
    assert "Page 1 / 1" in text


def test_long_pdf_never_splits_a_scene_between_pages():
    data = raw()
    base = data["scenes"][0]
    data["scenes"] = [
        {
            **base,
            "id": f"s{i}",
            "number": str(i),
            "title": f"Scène longue {i}",
            "notes": "Note. " * 40,
        }
        for i in range(1, 40)
    ]
    req = CallsheetRequest.model_validate(data)
    pdf = build_callsheet_pdf(draft(req, "m-image"), req.project.title)
    from pypdf import PdfReader

    pages = [p.extract_text() for p in PdfReader(io.BytesIO(pdf)).pages]
    assert len(pages) > 1
    for i in range(1, 40):
        # Le titre et la fin des notes d'une scène sont sur la même page
        holder = [
            p
            for p in pages
            if f"Scène longue {i}\n" in p or p.rstrip().endswith(f"Scène longue {i}")
        ]
        assert len(holder) == 1
    assert f"Page {len(pages)} / {len(pages)}" in pages[-1]


def test_pdf_filename_is_clear():
    assert (
        pdf_filename("Le dernier ferry", "Amira Ben Salah")
        == "Le-dernier-ferry_convocation_Amira.pdf"
    )
    assert pdf_filename("L’été à Sfax !", "Éloïse") == "L-ete-a-Sfax_convocation_Eloise.pdf"


@pytest.mark.asyncio
async def test_unknown_member_and_duplicate_are_reported(resend_server):
    _calls, sender = resend_server
    req = send_request()
    req.drafts.append(copy.deepcopy(req.drafts[0]))
    req.drafts.append(req.drafts[0].model_copy(update={"member_id": "inconnu"}))
    res = await callsheet.send(req, Settings(resend_api_key="re_x"), sender=sender)
    assert res.results[-2].status == "ignore"
    assert res.results[-1].status == "erreur"


def test_at_most_50_recipients_per_call():
    drafts = [{"member_id": f"m{i}", "subject": "s", "message": "m"} for i in range(51)]
    with pytest.raises(ValueError):
        SendRequest.model_validate({**raw(), "drafts": drafts})


# --- Routes ---------------------------------------------------------------------------------


def test_routes_require_login():
    with TestClient(app) as client:
        assert client.post("/callsheets/preview", json=raw()).status_code == 401
        assert client.post("/callsheets/send", json=raw()).status_code == 401


@pytest.fixture
def logged_in():
    app.dependency_overrides[auth.get_current_user] = lambda: auth.CurrentUser(
        id=str(OWNER), email=None, is_demo=True
    )
    yield
    app.dependency_overrides.clear()


def test_preview_route_and_no_content_in_logs(capsys, logged_in):
    with TestClient(app) as client:
        r = client.post("/callsheets/preview", json=raw(), headers=DEMO)
    assert r.status_code == 200
    body = r.json()
    assert len(body["drafts"]) == 4
    assert body["drafts"][0]["ics"].startswith("BEGIN:VCALENDAR")
    logs = capsys.readouterr()
    for secret in ("ines@example.com", "Ines Trabelsi", "Amira regarde", "Le départ"):
        assert secret not in logs.out + logs.err


def test_send_route_dry_run(logged_in):
    # conftest vide RESEND_API_KEY : mode essai
    body = {**raw(), "drafts": [{"member_id": "m-amira", "subject": "Objet", "message": "Salut"}]}
    with TestClient(app) as client:
        r = client.post("/callsheets/send", json=body, headers=DEMO)
    assert r.status_code == 200
    assert r.json()["dry_run"] is True
    assert r.json()["results"][0]["status"] == "essai"
