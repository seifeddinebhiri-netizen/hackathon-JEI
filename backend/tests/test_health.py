from fastapi.testclient import TestClient

from app.main import app


def test_live():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}
        assert "x-request-id" in r.headers


def test_ready_degraded_without_db():
    with TestClient(app) as client:
        app.state.db_pool = None
        r = client.get("/health/ready")
        assert r.status_code == 503
        assert r.json()["database"] == "not_configured"
