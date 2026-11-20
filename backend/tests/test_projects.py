import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.auth import CurrentUser, get_current_user
from app.main import app
from app.repositories import project_repository as repo

ME = CurrentUser(id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email="me@example.com")
OTHER = CurrentUser(id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", email=None)
BODY = {
    "title": "Marée basse", "format": "court", "city": "Tunis",
    "shooting_window": {"from": "2026-11-19", "to": "2026-12-08"}, "max_hours_per_day": 8,
}  # fmt: skip


@pytest.fixture
def db(monkeypatch):
    rows: dict[str, dict] = {}

    async def create(pool, owner_id, title, format_, city, data):
        row = {"id": str(uuid.uuid4()), "owner_id": owner_id, "title": title,
               "format": format_, "city": city, "data": data, "version": 1}  # fmt: skip
        rows[row["id"]] = row
        return row

    async def get(pool, project_id):
        return rows.get(project_id)

    async def update(pool, project_id, columns, data_patch):
        row = rows[project_id]
        row.update(columns)
        row["data"] = {**row["data"], **data_patch}
        return row

    async def delete(pool, project_id):
        rows.pop(project_id, None)

    monkeypatch.setattr(repo, "create", create)
    monkeypatch.setattr(repo, "get", get)
    monkeypatch.setattr(repo, "update", update)
    monkeypatch.setattr(repo, "delete", delete)
    return rows


def _client(user):
    app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


def test_requires_auth():
    with TestClient(app) as c:
        r = c.post("/projects", json=BODY)
        assert r.status_code == 401
        # le front lit `message` à la racine du corps d'erreur
        assert r.json() == {"code": "non_autorise", "message": "Session invalide ou expirée."}


def test_unknown_route_has_french_message():
    with TestClient(app) as c:
        assert c.get("/nope").json() == {"message": "Ressource introuvable."}


def test_create_get_update_delete(db):
    with _client(ME) as c:
        created = c.post("/projects", json=BODY)
        assert created.status_code == 201
        p = created.json()
        assert p["shooting_window"] == {"from": "2026-11-19", "to": "2026-12-08"}
        assert p["scenes"] == [] and "scene_extras" not in p
        # clés facultatives absentes : omises, jamais `null` (le front les valide avec zod)
        assert not {"schedule", "film_profile", "synopsis", "film_page"} & p.keys()
        pid = p["id"]

        assert c.get(f"/projects/{pid}").json()["title"] == "Marée basse"

        scene = {"id": "sc-1", "title": "Ouverture"}
        patched = c.patch(f"/projects/{pid}", json={"title": "Autre", "scenes": [scene]}).json()
        assert patched["title"] == "Autre" and patched["scenes"] == [scene]
        assert db[pid]["data"]["scene_extras"] == {}  # préservé par le PATCH

        assert c.delete(f"/projects/{pid}").json() == {"ok": True}
        assert c.get(f"/projects/{pid}").status_code == 404


def test_other_user_gets_403(db):
    with _client(ME) as c:
        pid = c.post("/projects", json=BODY).json()["id"]
    with _client(OTHER) as c:
        assert c.get(f"/projects/{pid}").status_code == 403
        assert c.patch(f"/projects/{pid}", json={"title": "x"}).status_code == 403
        assert c.delete(f"/projects/{pid}").status_code == 403
    assert pid in db


def test_validation(db):
    with _client(ME) as c:
        assert c.post("/projects", json={**BODY, "format": "serie"}).status_code == 422
        pid = c.post("/projects", json=BODY).json()["id"]
        assert c.patch(f"/projects/{pid}", json={"inconnu": 1}).status_code == 422


def test_members_are_saved(db):
    member = {"id": "m-1", "name": "Amira", "email": "amira@example.com", "role": "acteur"}
    with _client(ME) as c:
        pid = c.post("/projects", json=BODY).json()["id"]
        assert c.get(f"/projects/{pid}").json()["members"] == []
        patched = c.patch(f"/projects/{pid}", json={"members": [member]}).json()
        assert patched["members"] == [member]


def test_demo_login_refused_in_production(monkeypatch):
    from app.core import auth
    from app.core.config import Settings

    monkeypatch.setattr(auth, "get_settings", lambda: Settings(app_env="production"))
    with TestClient(app) as c:
        r = c.get(f"/projects/{uuid.uuid4()}", headers={"Authorization": "Bearer demo.u.x"})
    assert r.status_code == 401
