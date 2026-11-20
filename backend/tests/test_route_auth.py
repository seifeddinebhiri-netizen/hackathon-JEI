"""Toute route exige un jeton Supabase, sauf la liste blanche ci-dessous (données publiques).

Ajouter une route publique demande de l'ajouter ici, explicitement : ce test échoue sinon."""

import re

import pytest
from fastapi.testclient import TestClient

from app.main import app

PUBLIC_ROUTES = {
    ("GET", "/health"),
    ("GET", "/health/ready"),
    ("GET", "/calibration"),  # tables de conversion, identiques pour tout le monde
    ("GET", "/festivals"),  # catalogue des festivals : lecture publique
    ("POST", "/festivals/match"),  # même recherche, critères dans le corps
    ("GET", "/festivals/{festival_id}"),
    # Un festival n'a pas de compte : il dépose le PDF reçu. Limité par adresse IP, 8 Mo, rien n'est conservé.
    ("POST", "/verify/pdf"),
}


def _routes() -> dict[tuple[str, str], dict]:
    """Routes réellement servies, lues dans le schéma OpenAPI (méthode, chemin) -> opération."""
    return {
        (method.upper(), path): op
        for path, ops in app.openapi()["paths"].items()
        for method, op in ops.items()
    }


def _asks_for_token(op: dict) -> bool:
    # `get_current_user` dépend de HTTPBearer : FastAPI le déclare dans `security`.
    return any("HTTPBearer" in s for s in op.get("security", []))


PRIVATE = sorted(k for k in _routes() if k not in PUBLIC_ROUTES)


def test_public_list_has_no_stale_entry():
    assert PUBLIC_ROUTES <= _routes().keys(), PUBLIC_ROUTES - _routes().keys()


def test_public_routes_do_not_ask_for_a_token():
    for key in PUBLIC_ROUTES:
        assert not _asks_for_token(_routes()[key]), key


def test_there_are_private_routes():
    assert ("GET", "/projects/{project_id}") in PRIVATE
    assert ("POST", "/synopsis/translate") in PRIVATE


@pytest.mark.parametrize(("method", "path"), PRIVATE)
def test_private_route_declares_the_token(method, path):
    assert _asks_for_token(_routes()[(method, path)]), f"{method} {path} est ouverte sans jeton"


@pytest.mark.parametrize(("method", "path"), PRIVATE)
@pytest.mark.parametrize("auth", [None, "Bearer pas-un-jeton"])
def test_private_route_answers_401_without_valid_token(method, path, auth):
    url = re.sub(r"\{[^}]+\}", "00000000-0000-0000-0000-000000000000", path)
    headers = {"Authorization": auth} if auth else {}
    with TestClient(app) as c:
        r = c.request(method, url, headers=headers)
    assert r.status_code == 401, f"{method} {path} -> {r.status_code}"
    assert r.json()["code"] == "non_autorise"
