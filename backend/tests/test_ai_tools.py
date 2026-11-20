import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.auth import CurrentUser, get_current_user
from app.main import app
from app.repositories import ai_tool_repository as repo
from app.schemas.ai_tool import Fact
from app.services.research.fetcher import FetchError, check_url, html_to_text
from app.services.research.pipeline import same_site
from app.services.research.quotes import quote_in_page
from app.services.research.seed import evaluate_seed_tool
from app.services.tool_names import make_slug, normalize_name
from app.services.tool_status import compute_status

ME = CurrentUser(id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email="me@example.com")
OTHER = CurrentUser(id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", email=None)


def fact(field="training_data", verified=True, plan="all") -> Fact:
    return Fact(
        field=field, plan=plan, value_fr="x", quote="une phrase assez longue",
        source_url="https://a.example/terms", quote_verified=verified,
    )  # fmt: skip


# --- noms, statut, citations ---------------------------------------------------------------
def test_names_are_normalized():
    assert normalize_name("Chat GPT") == normalize_name("chatgpt") == "chatgpt"
    assert normalize_name("Éléven-Labs") == "elevenlabs"
    assert make_slug("Adobe Firefly") == "adobe-firefly"


def test_status_is_computed_by_rules_from_verified_facts_only():
    core = ["training_data", "input_training_use", "output_rights"]
    assert compute_status([fact(f) for f in core]) == "documente"
    assert compute_status([fact(core[0]), fact(core[1])]) == "partiel"
    assert compute_status([fact(f, verified=False) for f in core]) == "non_divulgue"
    assert (
        compute_status([fact("provenance"), fact("indemnity")]) == "non_divulgue"
    )  # pas des questions de base
    assert compute_status([]) == "non_divulgue"


def test_quote_must_really_be_in_the_page():
    page = "Terms\n\nWe may use your “Inputs”   and Outputs to train\nmodels, unless you opt out.\n"
    assert quote_in_page(
        'We may use your "Inputs" and Outputs to train models, unless you opt out', page
    )
    assert quote_in_page(
        'we may use your "inputs" and outputs to train models', page
    )  # casse, espaces, retours à la ligne
    assert not quote_in_page("We never use your data to train models, ever", page)
    assert not quote_in_page("train", page)  # trop court pour prouver quoi que ce soit
    assert quote_in_page("**bold quote that exists** here", "bold quote that exists here")


# --- lecture sûre d'une page ---------------------------------------------------------------
@pytest.mark.parametrize(
    "url",
    [
        "http://example.com/terms",  # pas https
        "https://127.0.0.1/admin",
        "https://localhost/x",
        "https://169.254.169.254/latest/meta-data",  # métadonnées cloud
        "https://user:pw@example.com/",
        "https://example.com:8443/",
        "file:///etc/passwd",
        "ftp://example.com/x",
    ],
)
def test_unsafe_urls_are_refused(url):
    with pytest.raises(FetchError):
        check_url(url)


def test_html_to_text_drops_scripts_and_keeps_text():
    html = "<html><head><title>t</title></head><body><script>evil()</script><h1>Terms</h1><p>We own nothing.</p></body></html>"
    text = html_to_text(html)
    assert "We own nothing." in text and "Terms" in text and "evil" not in text


def test_same_site_blocks_other_domains():
    assert same_site("https://help.openai.com/x", "https://openai.com")
    assert same_site("https://www.anthropic.com/legal", "https://claude.ai") is False
    assert not same_site("https://evil.example/x", "https://openai.com")
    assert not same_site("not a url", "https://openai.com")


# --- jeu de départ -------------------------------------------------------------------------
SEED = json.loads(
    (Path(__file__).resolve().parent.parent / "data" / "ai_tools_seed.json").read_text()
)


def test_seed_has_ten_tools_each_fact_with_a_source_and_quote():
    assert len(SEED["tools"]) == 10
    for t in SEED["tools"]:
        for f in t["facts"]:
            assert f["source_url"].startswith("https://") and len(f["quote"]) >= 12, (t["slug"], f)
            assert len(f["value_fr"]) <= 600 and len(f["quote"]) <= 500


def test_seed_unreadable_pages_leave_the_status_empty_not_undisclosed():
    claude = next(t for t in SEED["tools"] if t["slug"] == "claude")
    row = evaluate_seed_tool(claude, {})  # aucune page lue
    assert row["status"] is None and row["research_state"] == "incomplete_access"
    pages: dict[str, str] = {}  # pages qui contiennent toutes leurs citations
    for f in claude["facts"]:
        pages[f["source_url"]] = pages.get(f["source_url"], "") + " " + f["quote"]
    assert evaluate_seed_tool(claude, pages)["status"] == "documente"
    partial = {u: q for u, q in list(pages.items())[:1]}
    assert all(
        not f.quote_verified
        for f in evaluate_seed_tool(claude, {"https://x.example": "z"})["facts"]
    )
    assert (
        evaluate_seed_tool(claude, partial)["review_state"] == "a_verifier"
    )  # jamais « vérifié » d'office


# --- routes (faux dépôt en mémoire) --------------------------------------------------------
@pytest.fixture
def db(monkeypatch):
    tools: dict[str, dict] = {}
    aliases: dict[str, str] = {}
    runs: dict[str, dict] = {}
    started: list[tuple[str, str]] = []

    async def find_by_alias(pool, norm):
        return tools.get(aliases.get(norm, ""))

    async def get_by_slug(pool, slug):
        return next((t for t in tools.values() if t["slug"] == slug), None)

    async def search(pool, q, limit=20):
        return [t for t in tools.values() if q.lower() in t["name"].lower()]

    async def facts_for(pool, ids):
        return {i: tools[i]["_facts"] for i in ids if i in tools}

    async def create_run(pool, norm, user_id):
        live = next(
            (
                r
                for r in runs.values()
                if r["name_norm"] == norm and r["state"] in ("queued", "running")
            ),
            None,
        )
        if live:
            return live, False
        run = {
            "id": f"00000000-0000-0000-0000-{len(runs):012d}",
            "name_norm": norm,
            "requested_by": user_id,
            "state": "queued",
            "error": None,
            "tool_slug": None,
        }
        runs[run["id"]] = run
        return run, True

    async def get_run(pool, run_id):
        return runs.get(run_id)

    async def count_runs_today(pool):
        return len(runs)

    monkeypatch.setattr(repo, "find_by_alias", find_by_alias)
    monkeypatch.setattr(repo, "get_by_slug", get_by_slug)
    monkeypatch.setattr(repo, "search", search)
    monkeypatch.setattr(repo, "facts_for", facts_for)
    monkeypatch.setattr(repo, "create_run", create_run)
    monkeypatch.setattr(repo, "get_run", get_run)
    monkeypatch.setattr(repo, "count_runs_today", count_runs_today)

    class Runner:
        def start(self, run_id, name):
            started.append((run_id, name))

    def add_tool(name="Claude", slug="claude", alias="claude"):
        tid = f"11111111-1111-1111-1111-{len(tools):012d}"
        tools[tid] = {
            "id": tid, "slug": slug, "name": name, "vendor": "V", "official_site": None, "categories": [],
            "terms_url": None, "privacy_url": None, "terms_updated": None, "status": "partiel",
            "review_state": "a_verifier", "research_state": "complete", "note_fr": "", "checked_at": None, "reviewed_by": None, "reviewed_at": None,
            "_facts": [{"id": "f1", "human_confirmed": False, "field": "training_data", "plan": "all", "value_fr": "x", "quote": "une phrase assez longue", "source_url": "https://a.example", "source_kind": "terms", "quote_verified": True, "retrieved_at": None}],
        }  # fmt: skip
        aliases[alias] = tid

    app.state.db_pool = object()
    app.state.tool_runner = Runner()
    from app.core import rate_limit

    rate_limit.tool_resolve_limiter().reset()
    yield {"tools": tools, "runs": runs, "started": started, "add": add_tool}
    app.dependency_overrides.clear()


def as_user(user):
    app.dependency_overrides[get_current_user] = lambda: user


def test_requires_auth():
    c = TestClient(app)
    assert c.get("/ai-tools").status_code == 401
    assert c.post("/ai-tools/resolve", json={"name": "Claude"}).status_code == 401
    assert c.get("/ai-tools/runs/x").status_code == 401


def test_known_tool_is_returned_with_its_sources_and_no_search_starts(db):
    db["add"]()
    as_user(ME)
    r = TestClient(app).post("/ai-tools/resolve", json={"name": "  Claude "})
    assert r.status_code == 200 and r.json()["state"] == "found"
    assert r.json()["tool"]["facts"][0]["quote_verified"] is True
    assert db["started"] == []


def test_missing_tool_starts_one_server_side_search_and_dedupes(db):
    as_user(ME)
    c = TestClient(app)
    first = c.post("/ai-tools/resolve", json={"name": "Pika Labs"}).json()
    assert first["state"] == "researching" and first["run_id"] and first["tool"] is None
    again = c.post("/ai-tools/resolve", json={"name": "pika  labs"}).json()
    assert again["run_id"] == first["run_id"]
    assert len(db["started"]) == 1  # une seule recherche pour ce nom


def test_a_run_is_only_visible_to_who_asked_for_it(db):
    as_user(ME)
    run_id = TestClient(app).post("/ai-tools/resolve", json={"name": "Pika"}).json()["run_id"]
    assert TestClient(app).get(f"/ai-tools/runs/{run_id}").json()["state"] == "queued"
    as_user(OTHER)
    assert TestClient(app).get(f"/ai-tools/runs/{run_id}").status_code == 404
    assert TestClient(app).get("/ai-tools/runs/pas-un-uuid").status_code == 404


def test_resolve_is_rate_limited_and_validates_names(db, monkeypatch):
    as_user(ME)
    c = TestClient(app)
    assert c.post("/ai-tools/resolve", json={"name": "a"}).status_code == 422
    assert c.post("/ai-tools/resolve", json={"name": "!!"}).status_code == 422
    from app.core import rate_limit

    rate_limit.tool_resolve_limiter().reset()  # les requêtes invalides comptent aussi
    monkeypatch.setattr(rate_limit.tool_resolve_limiter(), "limit", 2)
    assert c.post("/ai-tools/resolve", json={"name": "Alpha Tool"}).status_code == 200
    assert c.post("/ai-tools/resolve", json={"name": "Beta Tool"}).status_code == 200
    assert c.post("/ai-tools/resolve", json={"name": "Gamma Tool"}).status_code == 429


def test_daily_research_budget(db, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "tool_research_daily_limit", 1)
    as_user(ME)
    c = TestClient(app)
    assert c.post("/ai-tools/resolve", json={"name": "Alpha Tool"}).status_code == 200
    r = c.post("/ai-tools/resolve", json={"name": "Beta Tool"})
    assert r.status_code == 429 and r.json()["code"] == "trop_de_requetes"


def test_catalog_search_and_detail_and_unknown_slug(db):
    db["add"]()
    as_user(ME)
    c = TestClient(app)
    assert [t["slug"] for t in c.get("/ai-tools?q=clau").json()] == ["claude"]
    assert c.get("/ai-tools/claude").json()["name"] == "Claude"
    assert c.get("/ai-tools/inconnu").status_code == 404


def test_no_route_can_trigger_the_research_directly():
    paths = {p: set(ops) for p, ops in app.openapi()["paths"].items() if p.startswith("/ai-tools")}
    assert set(paths) == {
        "/ai-tools",
        "/ai-tools/resolve",
        "/ai-tools/runs/{run_id}",
        "/ai-tools/{slug}",
    }
    writes = {p for p, ops in paths.items() if ops - {"get"}}
    assert writes == {
        "/ai-tools/resolve"
    }  # seule écriture : demander un outil, sans réglage de recherche


# --- vrais types de la base : asyncpg renvoie des UUID, pas des chaînes ---------------------
def test_every_uuid_column_becomes_text_whatever_its_name():
    from datetime import UTC, datetime
    from uuid import UUID

    user = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    row = repo._row(
        {
            "id": UUID("11111111-1111-1111-1111-111111111111"),
            "requested_by": UUID(user),  # ne finit pas par `_id` : c'était le cas oublié
            "tool_id": None,
            "created_at": datetime(2026, 11, 20, tzinfo=UTC),
            "name_norm": "kimik2",
        }
    )
    assert row["requested_by"] == user and isinstance(row["requested_by"], str)
    assert row["id"] == "11111111-1111-1111-1111-111111111111"
    assert row["tool_id"] is None and row["created_at"].startswith("2026-11-20")


def test_the_owner_of_a_run_can_read_it_with_the_types_the_database_returns(db):
    from uuid import UUID

    as_user(ME)
    run_id = TestClient(app).post("/ai-tools/resolve", json={"name": "Kimi K2"}).json()["run_id"]
    # La base renvoie la colonne en UUID, nettoyée par `_row` : on la rejoue ici fidèlement.
    stored = db["runs"][run_id]
    stored["requested_by"] = repo._row({"requested_by": UUID(ME.id)})["requested_by"]
    r = TestClient(app).get(f"/ai-tools/runs/{run_id}")
    assert r.status_code == 200 and r.json()["state"] == "queued"
