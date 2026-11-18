import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.auth import CurrentUser, get_current_user
from app.main import app
from app.repositories import workspace_repository as repo
from app.schemas.workspace import MAX_WORKSPACES

ME = CurrentUser(id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", email="me@example.com")
OTHER = CurrentUser(id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", email=None)
DATA = {
    "request": {"description": "Un vieil homme boit son thé."},
    "spec": {},
    "overrides": {},
    "notes": {},
}


@pytest.fixture
def db(monkeypatch):
    rows: dict[str, dict] = {}
    clock = {"n": 0}

    def tick():
        clock["n"] += 1
        return f"2026-11-18T10:00:{clock['n']:02d}Z"

    async def list_for_owner(pool, owner_id):
        mine = [r for r in rows.values() if r["owner_id"] == owner_id]
        return sorted(mine, key=lambda r: r["created_at"])

    async def get(pool, workspace_id):
        return rows.get(workspace_id)

    async def upsert(pool, owner_id, workspace_id, name, data, base_version):
        cur = rows.get(workspace_id)
        if cur is None:
            if base_version is not None:
                return "conflict", None
            if len([r for r in rows.values() if r["owner_id"] == owner_id]) >= MAX_WORKSPACES:
                return "limit", None
            t = tick()
            rows[workspace_id] = {"id": workspace_id, "owner_id": owner_id, "name": name, "data": data,
                                  "version": 1, "created_at": t, "updated_at": t}  # fmt: skip
            return "saved", rows[workspace_id]
        if cur["owner_id"] != owner_id:
            return "forbidden", None
        if base_version != cur["version"]:
            return "conflict", cur
        cur.update(name=name, data=data, version=cur["version"] + 1, updated_at=tick())
        return "saved", cur

    async def delete(pool, workspace_id):
        rows.pop(workspace_id, None)

    monkeypatch.setattr(repo, "list_for_owner", list_for_owner)
    monkeypatch.setattr(repo, "get", get)
    monkeypatch.setattr(repo, "upsert", upsert)
    monkeypatch.setattr(repo, "delete", delete)
    return rows


def client_for(user):
    app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


def new_id():
    return str(uuid.uuid4())


def test_requires_auth():
    with TestClient(app) as c:
        assert c.get("/workspaces").status_code == 401
        assert c.put(f"/workspaces/{new_id()}", json={"name": "x", "data": {}}).status_code == 401


def test_create_update_list_delete(db):
    wid = new_id()
    with client_for(ME) as c:
        created = c.put(f"/workspaces/{wid}", json={"name": "Café", "data": DATA})
        assert created.status_code == 200
        assert created.json()["version"] == 1 and created.json()["data"] == DATA

        updated = c.put(
            f"/workspaces/{wid}", json={"name": "Café médina", "data": DATA, "base_version": 1}
        )
        assert updated.json()["version"] == 2 and updated.json()["name"] == "Café médina"

        listing = c.get("/workspaces").json()
        assert [w["id"] for w in listing] == [wid]
        assert c.get(f"/workspaces/{wid}").json()["name"] == "Café médina"

        assert c.delete(f"/workspaces/{wid}").json() == {"ok": True}
        assert c.get("/workspaces").json() == []
        assert c.delete(f"/workspaces/{wid}").status_code == 200  # idempotent
        assert c.get(f"/workspaces/{wid}").status_code == 404


def test_two_devices_stale_write_gets_409(db):
    wid = new_id()
    with client_for(ME) as c:
        c.put(f"/workspaces/{wid}", json={"name": "A", "data": DATA})
        # l'appareil 1 enregistre (version 1 -> 2)
        assert (
            c.put(
                f"/workspaces/{wid}", json={"name": "A1", "data": DATA, "base_version": 1}
            ).status_code
            == 200
        )
        # l'appareil 2 part encore de la version 1 : refusé, rien n'est écrasé
        stale = c.put(f"/workspaces/{wid}", json={"name": "A2", "data": DATA, "base_version": 1})
        assert stale.status_code == 409
        assert stale.json()["code"] == "conflit"
        assert c.get(f"/workspaces/{wid}").json()["name"] == "A1"
        # créer un espace qui existe déjà (sans version) est aussi un conflit
        assert c.put(f"/workspaces/{wid}", json={"name": "B", "data": DATA}).status_code == 409
        # modifier un espace supprimé ailleurs : conflit
        c.delete(f"/workspaces/{wid}")
        assert (
            c.put(
                f"/workspaces/{wid}", json={"name": "A", "data": DATA, "base_version": 2}
            ).status_code
            == 409
        )


def test_other_users_workspaces_are_private(db):
    wid = new_id()
    with client_for(ME) as c:
        c.put(f"/workspaces/{wid}", json={"name": "Privé", "data": DATA})
    with client_for(OTHER) as c:
        assert c.get("/workspaces").json() == []
        assert c.get(f"/workspaces/{wid}").status_code == 403
        assert (
            c.put(
                f"/workspaces/{wid}", json={"name": "Vol", "data": DATA, "base_version": 1}
            ).status_code
            == 403
        )
        assert c.delete(f"/workspaces/{wid}").status_code == 403
    assert db[wid]["name"] == "Privé"


def test_limits_and_validation(db):
    with client_for(ME) as c:
        for _ in range(MAX_WORKSPACES):
            assert (
                c.put(f"/workspaces/{new_id()}", json={"name": "x", "data": {}}).status_code == 200
            )
        full = c.put(f"/workspaces/{new_id()}", json={"name": "x", "data": {}})
        assert full.status_code == 422 and full.json()["code"] == "limite_atteinte"

        wid = next(iter(db))
        assert (
            c.put(
                f"/workspaces/{wid}", json={"name": "", "data": {}, "base_version": 1}
            ).status_code
            == 422
        )
        assert (
            c.put(
                f"/workspaces/{wid}", json={"name": "x" * 41, "data": {}, "base_version": 1}
            ).status_code
            == 422
        )
        assert c.put("/workspaces/pas-un-uuid", json={"name": "x", "data": {}}).status_code == 422
        big = {"blob": "x" * 300_000}
        assert (
            c.put(
                f"/workspaces/{wid}", json={"name": "x", "data": big, "base_version": 1}
            ).status_code
            == 413
        )
