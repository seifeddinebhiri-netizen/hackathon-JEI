import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.health_service import check_database


def test_live():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}
        assert "x-request-id" in r.headers


def test_ready_degraded_without_db():
    # conftest vide DATABASE_URL : aucun pool réel n'est ouvert, donc rien à fuiter
    with TestClient(app) as client:
        assert app.state.db_pool is None
        r = client.get("/health/ready")
        assert r.status_code == 503
        assert r.json() == {
            "status": "degraded",
            "database": "not_configured",
            "supabase": "not_configured",
        }


class _Conn:
    def __init__(self, fail: bool):
        self.fail = fail

    async def fetchval(self, query: str):
        if self.fail:
            raise ConnectionError("boom")
        return 1


class _Acquire:
    def __init__(self, conn: _Conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *exc):
        return False


class _Pool:
    def __init__(self, fail: bool = False):
        self.fail = fail

    def acquire(self, timeout=None):
        return _Acquire(_Conn(self.fail))


@pytest.mark.asyncio
async def test_check_database_up():
    assert await check_database(_Pool()) == "up"


@pytest.mark.asyncio
async def test_check_database_down():
    assert await check_database(_Pool(fail=True)) == "down"
