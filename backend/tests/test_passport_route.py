import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.core.auth import CurrentUser, get_current_user
from app.core.config import get_settings
from app.core.errors import AppError
from app.main import app
from app.repositories import passport_repository as repo
from app.schemas.ai_tool import Fact, Tool
from app.services import ai_tool_service, c2pa_service, project_service
from scripts.make_test_cert import make_certs

PROJECT = "11111111-1111-1111-1111-111111111111"
ME = CurrentUser(id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email=None)

DECLARATIONS = [
    {"department": "scenario", "used_ai": True, "tool_id": "claude", "what": "Dialogues.",
     "level": "assistance", "human_decisions": "Tout le reste."},
    {"department": "image", "used_ai": False, "what": "", "human_decisions": "Filmé par moi."},
    {"department": "musique", "used_ai": True, "custom_tool": "Outil maison", "what": "Maquette.",
     "level": "assistance", "human_decisions": "Composition finale."},
    {"department": "vfx", "used_ai": True, "tool_id": "outil-fantome", "what": "x", "human_decisions": "y"},
]  # fmt: skip


def claude() -> Tool:
    fact = Fact(field="training_data", plan="all", value_fr="x", quote="Une phrase exacte de la page",
                source_url="https://a.example/t", quote_verified=True)  # fmt: skip
    return Tool(id="c", slug="claude", name="Claude", vendor="Anthropic", status="documente",
                review_state="verifie", research_state="complete", reviewed_by="Amira B.", facts=[fact])  # fmt: skip


@pytest.fixture(scope="module")
def certs(tmp_path_factory):
    return make_certs(tmp_path_factory.mktemp("certs"))


@pytest.fixture
def env(monkeypatch, certs):
    state = {"row": {"project_id": PROJECT, "owner_id": ME.id, "film_title": "Dar Hmeti",
                     "director": "Amira", "declarations": list(DECLARATIONS),
                     "badge_code": "EN-ABCD-23", "c2pa_signed": False},
             "signed": []}  # fmt: skip

    async def get_for_project(pool, pid):
        return state["row"]

    async def mark_signed(pool, pid):
        state["signed"].append(pid)

    async def ensure_owned(pool, pid, user):
        if state.get("forbidden"):
            raise AppError("Ce projet ne t'appartient pas.", status_code=403, code="interdit")

    async def get_tool(pool, slug):
        if slug == "claude":
            return claude()
        raise AppError("Outil introuvable.", status_code=404, code="introuvable")

    monkeypatch.setattr(repo, "get_for_project", get_for_project)
    monkeypatch.setattr(repo, "mark_signed", mark_signed)
    monkeypatch.setattr(project_service, "ensure_owned", ensure_owned)
    monkeypatch.setattr(ai_tool_service, "get_tool", get_tool)
    settings = get_settings()
    monkeypatch.setattr(settings, "c2pa_cert_chain_path", str(certs / "test-signing-chain.pem"))
    monkeypatch.setattr(settings, "c2pa_private_key_path", str(certs / "test-signing-key.pem"))
    monkeypatch.setattr(settings, "c2pa_test_mode", True)
    monkeypatch.setattr(settings, "public_app_url", "https://passeport.example")
    rate_limit.passport_pdf_limiter().reset()
    app.state.db_pool = object()
    app.dependency_overrides[get_current_user] = lambda: ME
    yield state
    app.dependency_overrides.clear()


def post(project=PROJECT):
    return TestClient(app).post(f"/passports/{project}/pdf")


def test_requires_auth():
    app.dependency_overrides.clear()
    assert TestClient(app).post(f"/passports/{PROJECT}/pdf").status_code == 401


def test_owner_gets_a_signed_pdf_and_the_server_marks_it_signed(env):
    r = post()
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    assert r.headers["x-c2pa-simulated"] == "true" and r.headers["x-c2pa-manifest-id"].startswith(
        "urn:c2pa"
    )
    assert "passeport-ia-EN-ABCD-23.pdf" in r.headers["content-disposition"]
    assert r.headers["cache-control"] == "no-store"
    assert env["signed"] == [PROJECT]
    v = c2pa_service.verify_pdf(r.content)
    assert v.state == "valid" and v.claims["badge_code"] == "EN-ABCD-23"
    tools = {t["slug"]: t for t in v.claims["tools"]}
    assert tools["claude"] == {"slug": "claude", "status": "documente", "reviewed": True}
    assert tools["outil-fantome"]["status"] is None  # outil inconnu du catalogue : dit comme tel


def test_someone_elses_project_is_refused_and_nothing_is_signed(env):
    env["forbidden"] = True
    r = post()
    assert r.status_code == 403 and r.json()["code"] == "interdit"
    assert env["signed"] == []


def test_missing_passport_and_bad_project_id(env):
    env["row"] = None
    assert post().status_code == 404
    assert post("pas-un-uuid").status_code in (404, 422)


def test_invalid_declarations_are_refused_not_signed(env):
    env["row"]["declarations"] = [{"department": "cuisine", "used_ai": True}]
    r = post()
    assert r.status_code == 422 and r.json()["code"] == "passeport_invalide"
    env["row"]["declarations"] = []
    assert post().status_code == 422
    assert env["signed"] == []


def test_signing_not_configured_is_a_clear_503_and_marks_nothing(env, monkeypatch):
    monkeypatch.setattr(get_settings(), "c2pa_cert_chain_path", "")
    r = post()
    assert r.status_code == 503 and r.json()["code"] == "signature_indisponible"
    assert env["signed"] == []


def test_a_failing_signature_is_a_502_and_marks_nothing(env, monkeypatch):
    def boom(*a, **k):
        raise c2pa_service.C2paSigningFailed("x")

    monkeypatch.setattr(c2pa_service, "sign_pdf", boom)
    r = post()
    assert r.status_code == 502 and r.json()["code"] == "signature_echouee"
    assert env["signed"] == []


def test_pdf_generation_is_rate_limited(env, monkeypatch):
    monkeypatch.setattr(rate_limit.passport_pdf_limiter(), "limit", 1)
    assert post().status_code == 200
    assert post().status_code == 429


def test_the_route_returns_a_file_not_json_in_openapi():
    spec = app.openapi()["paths"]["/passports/{project_id}/pdf"]["post"]
    assert "application/pdf" in spec["responses"]["200"]["content"]
