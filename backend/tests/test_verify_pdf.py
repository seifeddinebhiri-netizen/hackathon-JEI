from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.core.config import Settings, get_settings
from app.main import app
from app.repositories import passport_repository as repo
from app.schemas.passport import PassportDocument
from app.services import c2pa_service
from app.services.passport_fingerprint import passport_fingerprint
from app.services.passport_pdf_service import render_pdf
from app.services.passport_service import declarations_from_row
from scripts.make_test_cert import make_certs

NOW = datetime(2026, 11, 19, 12, 0, tzinfo=UTC)
DECLS = [
    {"department": "scenario", "used_ai": True, "tool_id": "claude", "what": "Dialogues.",
     "level": "assistance", "human_decisions": "Tout le reste."},
    {"department": "image", "used_ai": False, "what": "", "human_decisions": "Filmé par moi."},
]  # fmt: skip


@pytest.fixture(scope="module")
def our_certs(tmp_path_factory):
    return make_certs(tmp_path_factory.mktemp("ours"))


@pytest.fixture(scope="module")
def other_certs(tmp_path_factory):
    return make_certs(tmp_path_factory.mktemp("other"))


def cfg(certs, **kw) -> Settings:
    return Settings(
        _env_file=None,
        c2pa_cert_chain_path=str(certs / "test-signing-chain.pem"),
        c2pa_private_key_path=str(certs / "test-signing-key.pem"),
        **kw,
    )


def signed_pdf(certs, decls=DECLS, title="Dar Hmeti", badge="EN-ABCD-23") -> bytes:
    declarations = declarations_from_row(decls)
    doc = PassportDocument(passport_id="p1", badge_code=badge, film_title=title, director="Amira",
                           issued_at=NOW, declarations=declarations)  # fmt: skip
    return c2pa_service.sign_pdf(render_pdf(doc, {}), doc, {}, cfg(certs), NOW).data


@pytest.fixture
def env(monkeypatch, our_certs):
    state = {
        "row": {"film_title": "Dar Hmeti", "director": "Amira", "declarations": list(DECLS)},
        "writes": [],
    }
    state["asked"] = []

    async def get_by_badge(pool, badge):
        state["asked"].append(badge)
        return state["row"]

    async def no_writes(*a, **k):
        state["writes"].append(a)

    monkeypatch.setattr(repo, "get_by_badge", get_by_badge)
    monkeypatch.setattr(repo, "mark_signed", no_writes)
    s = get_settings()
    monkeypatch.setattr(s, "c2pa_cert_chain_path", str(our_certs / "test-signing-chain.pem"))
    monkeypatch.setattr(s, "c2pa_private_key_path", str(our_certs / "test-signing-key.pem"))
    monkeypatch.setattr(s, "c2pa_trust_anchors_path", "")
    rate_limit.verify_pdf_limiter().reset()
    app.state.db_pool = object()
    app.dependency_overrides.clear()  # route publique : aucun compte
    return state


def post(data: bytes, name="passeport.pdf"):
    return TestClient(app).post("/verify/pdf", files={"file": (name, data, "application/pdf")})


def test_intact_pdf_from_us_that_matches_the_current_passport(env, our_certs):
    r = post(signed_pdf(our_certs))
    assert r.status_code == 200
    j = r.json()
    assert j["state"] == "valid" and j["issued_by_us"] is True
    assert j["matches_passport"] is True and j["reasons"] == []
    assert j["badge_code"] == "EN-ABCD-23" and j["film_title"] == "Dar Hmeti"
    assert j["signing_mode"] == "test"
    assert j["tools"] == [{"slug": "claude", "status": None, "reviewed": False}]
    assert env["asked"] == ["EN-ABCD-23"]


def test_passport_changed_since_the_pdf_was_issued(env, our_certs):
    pdf = signed_pdf(our_certs)
    env["row"]["declarations"][0]["what"] = "Une autre description."  # un seul champ modifié
    j = post(pdf).json()
    assert j["state"] == "valid" and j["issued_by_us"] is True  # le fichier, lui, est intact
    assert j["matches_passport"] is False
    assert j["reasons"] == ["Le Passeport a été modifié depuis l'émission de ce PDF."]


def test_changed_film_title_is_also_detected(env, our_certs):
    pdf = signed_pdf(our_certs)
    env["row"]["film_title"] = "Autre titre"
    assert post(pdf).json()["matches_passport"] is False


def test_modified_file_is_invalid_and_reveals_nothing(env, our_certs):
    bad = bytearray(signed_pdf(our_certs))
    bad[bad.find(b"stream") + 10] ^= 0xFF
    j = post(bytes(bad)).json()
    assert j["state"] == "invalid" and "assertion.dataHash.mismatch" in j["problems"]
    assert j["issued_by_us"] is False and j["badge_code"] is None and j["tools"] == []
    assert env["asked"] == []  # on ne cherche rien en base pour un fichier cassé


def test_unsigned_pdf(env):
    doc = PassportDocument(passport_id="p", badge_code="EN-ABCD-23", film_title="X", director="Y",
                           issued_at=NOW, declarations=declarations_from_row(DECLS))  # fmt: skip
    j = post(render_pdf(doc, {})).json()
    assert j["state"] == "none" and j["issued_by_us"] is False and j["matches_passport"] is None


def test_a_pdf_signed_by_someone_else_copying_our_info_is_not_ours(env, other_certs):
    # Même contenu, même badge, mais signé avec un AUTRE certificat : intact, pas de nous.
    j = post(signed_pdf(other_certs)).json()
    assert j["state"] == "valid"
    assert j["issued_by_us"] is False
    assert j["matches_passport"] is None and j["badge_code"] is None and j["tools"] == []
    assert j["signing_mode"] is None  # on ne répète pas ce que le fichier prétend
    assert env["asked"] == []


def test_unknown_badge_cannot_be_compared(env, our_certs):
    env["row"] = None
    j = post(signed_pdf(our_certs)).json()
    assert j["issued_by_us"] is True and j["matches_passport"] is None
    assert "Aucun Passeport ne porte ce code" in j["reasons"][0]


def test_trust_anchor_makes_the_state_trusted(env, our_certs, monkeypatch):
    monkeypatch.setattr(
        get_settings(), "c2pa_trust_anchors_path", str(our_certs / "test-root-ca.pem")
    )
    j = post(signed_pdf(our_certs)).json()
    assert j["state"] == "trusted" and j["issued_by_us"] is True


def test_not_a_pdf_and_too_large_are_refused_before_reading(env, monkeypatch):
    assert post(b"MZ\x90\x00 pas un pdf").status_code == 422
    assert (
        post(b"%PDF-1.4 " + b"x" * 100, name="x.pdf").status_code == 200
    )  # un PDF non signé passe
    monkeypatch.setattr(get_settings(), "verify_pdf_max_mb", 0)
    r = post(b"%PDF-1.4 petit")
    assert r.status_code == 413 and r.json()["code"] == "trop_volumineux"


def test_public_no_account_needed_but_rate_limited_per_address(env, our_certs, monkeypatch):
    pdf = signed_pdf(our_certs)
    monkeypatch.setattr(rate_limit.verify_pdf_limiter(), "limit", 2)
    assert post(pdf).status_code == 200 and post(pdf).status_code == 200
    r = post(pdf)
    assert r.status_code == 429 and r.json()["code"] == "trop_de_requetes"


def test_nothing_is_stored(env, our_certs):
    post(signed_pdf(our_certs))
    assert env["writes"] == []  # ni signature marquée, ni écriture


def test_fingerprint_changes_with_any_word_and_ignores_key_order():
    a = declarations_from_row(DECLS)
    b = declarations_from_row([{**DECLS[0], "what": "Dialogue."}, DECLS[1]])
    assert passport_fingerprint("T", "D", a) != passport_fingerprint("T", "D", b)
    assert passport_fingerprint("T", "D", a) == passport_fingerprint(
        "T", "D", declarations_from_row(DECLS)
    )
    assert passport_fingerprint("T", "D", a) != passport_fingerprint("T", "D2", a)


def test_the_route_is_public_in_openapi():
    op = app.openapi()["paths"]["/verify/pdf"]["post"]
    assert not op.get("security")
    assert "multipart/form-data" in op["requestBody"]["content"]
