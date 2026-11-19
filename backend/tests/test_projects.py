import json
import time
from uuid import UUID, uuid4

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core import auth
from app.core.config import Settings
from app.core.errors import AppError
from app.main import app
from app.schemas.project import CreateProjectInput, UpdateProjectInput
from app.services import project_service

OWNER = UUID("11111111-1111-1111-1111-111111111111")
SECRET = "test-jwt-secret-with-enough-length-1234"

NEW = {
    "title": "Le dernier ferry",
    "format": "court",
    "city": "Tunis",
    "shooting_window": {"from": "2026-12-01", "to": "2026-12-10"},
    "max_hours_per_day": 10,
}


# --- Connexion ---------------------------------------------------------------------------


def _token(**claims) -> str:
    base = {"sub": str(OWNER), "aud": "authenticated", "exp": int(time.time()) + 600}
    return jwt.encode({**base, **claims}, SECRET, algorithm="HS256")


@pytest.mark.asyncio
async def test_valid_supabase_jwt_gives_owner():
    s = Settings(supabase_jwt_secret=SECRET)
    assert await auth.verify_supabase_jwt(_token(), s) == OWNER


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "token",
    [
        _token(exp=int(time.time()) - 10),  # expiré
        _token(aud="anon"),  # mauvais public
        jwt.encode({"sub": str(OWNER), "aud": "authenticated"}, "x" * 40, algorithm="HS256"),
        "not-a-jwt",
    ],
)
async def test_bad_jwt_is_401(token):
    with pytest.raises(AppError) as exc:
        await auth.verify_supabase_jwt(token, Settings(supabase_jwt_secret=SECRET))
    assert exc.value.status_code == 401


def test_requests_without_token_are_401():
    with TestClient(app) as client:
        r = client.post("/projects", json=NEW)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "non_autorise"


def test_demo_login_refused_in_production(monkeypatch):
    monkeypatch.setattr(auth, "get_settings", lambda: Settings(app_env="production"))
    with TestClient(app) as client:
        r = client.get(f"/projects/{uuid4()}", headers={"Authorization": "Bearer demo.u.x"})
    assert r.status_code == 401


# --- Routes (service remplacé) -------------------------------------------------------------


@pytest.fixture
def api(monkeypatch):
    calls = []

    async def fake_pool(request):
        return object()

    def record(name, result):
        async def fn(*args):
            calls.append((name, args[1:]))
            if isinstance(result, Exception):
                raise result
            return result

        return fn

    project = {"id": "p1", **NEW, "scenes": [], "locations": [], "people": []}
    project["festival_shortlist"] = []
    monkeypatch.setattr("app.controllers.project_controller._pool", fake_pool)
    for name in ("create", "get", "update"):
        monkeypatch.setattr(project_service, name, record(name, project))
    monkeypatch.setattr(project_service, "delete", record("delete", None))
    app.dependency_overrides[auth.get_caller] = lambda: auth.Caller(OWNER, is_demo=True)
    with TestClient(app) as client:
        yield client, calls
    app.dependency_overrides.clear()


def test_create_returns_201(api):
    client, calls = api
    r = client.post("/projects", json=NEW)
    assert r.status_code == 201
    assert r.json()["id"] == "p1"
    name, (owner, body) = calls[0]
    assert (name, owner, body.title) == ("create", OWNER, "Le dernier ferry")


@pytest.mark.parametrize(
    "bad",
    [
        {**NEW, "format": "moyen"},
        {**NEW, "title": ""},
        {**NEW, "max_hours_per_day": 0},
        {k: v for k, v in NEW.items() if k != "shooting_window"},
    ],
)
def test_create_rejects_invalid_input(api, bad):
    client, calls = api
    assert client.post("/projects", json=bad).status_code == 422
    assert calls == []


def test_patch_cannot_clear_required_field(api):
    client, _ = api
    assert client.patch("/projects/p1", json={"title": None}).status_code == 422
    assert client.patch("/projects/p1", json={"scenes": None}).status_code == 422


def test_get_patch_delete_are_wired(api):
    client, calls = api
    assert client.get("/projects/p1").status_code == 200
    assert client.patch("/projects/p1", json={"city": "Sfax"}).status_code == 200
    assert client.delete("/projects/p1").json() == {"ok": True}
    assert [c[0] for c in calls] == ["get", "update", "delete"]
    assert calls[1][1][1] == "p1"


# --- Service SQL (pool factice) ------------------------------------------------------------


class FakePool:
    def __init__(self, row=None):
        self.row = row
        self.calls = []

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        return self.row

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        return self.row


def _row(data: dict, **cols):
    return {
        "id": UUID(int=1),
        "title": "T",
        "format": "court",
        "city": "Tunis",
        **cols,
        "data": json.dumps(data),
    }


def test_to_project_fills_lists_and_drops_nulls():
    p = project_service.to_project(_row({"max_hours_per_day": 8, "schedule": None, "title": "x"}))
    assert p["scenes"] == [] and p["festival_shortlist"] == []
    assert "schedule" not in p
    assert p["title"] == "T"  # la colonne prime sur une copie dans data
    assert p["id"] == str(UUID(int=1))


@pytest.mark.asyncio
async def test_create_stores_columns_and_data():
    pool = FakePool(_row({}))
    await project_service.create(pool, OWNER, CreateProjectInput(**NEW))
    _sql, args = pool.calls[0]
    assert args[:4] == (OWNER, "Le dernier ferry", "court", "Tunis")
    data = json.loads(args[4])
    assert data == {
        "shooting_window": {"from": "2026-12-01", "to": "2026-12-10"},
        "max_hours_per_day": 10.0,
    }


@pytest.mark.asyncio
async def test_update_merges_data_and_removes_optional_nulls():
    pool = FakePool(_row({}))
    patch = UpdateProjectInput.model_validate(
        {"city": "Sfax", "scenes": [{"id": "s1"}], "schedule": None}
    )
    await project_service.update(pool, OWNER, str(UUID(int=1)), patch)
    sql, args = pool.calls[0]
    assert "owner_id = $2" in sql
    assert args[1] == OWNER
    assert args[2:5] == (None, None, "Sfax")
    assert json.loads(args[5]) == {"scenes": [{"id": "s1"}]}
    assert args[6] == ["schedule"]


@pytest.mark.asyncio
@pytest.mark.parametrize("fn", ["get", "delete"])
async def test_missing_or_foreign_project_is_404(fn):
    with pytest.raises(AppError) as exc:
        await getattr(project_service, fn)(FakePool(None), OWNER, str(uuid4()))
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_malformed_id_is_404_without_query():
    pool = FakePool(None)
    with pytest.raises(AppError) as exc:
        await project_service.get(pool, OWNER, "not-a-uuid")
    assert exc.value.status_code == 404
    assert pool.calls == []
