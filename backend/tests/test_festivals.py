from datetime import date

import pytest
from fastapi.testclient import TestClient
from structlog.testing import capture_logs

from app.main import app
from app.schemas.festival import Festival, FestivalFilters, FilmProfile
from app.services import festival_service as svc

TODAY = date(2026, 11, 18)


def fest(**kw) -> Festival:
    base = {
        "id": "f",
        "name": "Festival test",
        "country": "Tunisie",
        "deadline": date(2027, 1, 14),
        "deadline_status": "ouverte",
        "fee": "16 €",
        "max_duration_min": 30,
        "subtitle_langs": ["fr"],
        "ai_policy": "a_declarer",
        "source_url": "https://exemple.invalid",
        "checked_at": TODAY,
    }
    base.update(kw)
    f = Festival.model_validate(base)
    f.deadline_status = svc.deadline_status(f.deadline, TODAY)
    return f


# --- Statut de la date limite ---------------------------------------------------------
def test_deadline_status():
    assert svc.deadline_status(None, TODAY) == "a_confirmer"
    assert svc.deadline_status(date(2026, 11, 17), TODAY) == "passee"
    assert svc.deadline_status(TODAY, TODAY) == "ouverte"


def test_record_without_source_is_hidden():
    raw = {
        "id": "x",
        "name": "X",
        "country": "FR",
        "fee": "",
        "source_url": "",
        "checked_at": "2026-11-18",
    }
    assert svc._to_festival(raw, TODAY) is None


# --- Classement -----------------------------------------------------------------------
def test_compatible_film_scores_high():
    m = svc.rank_festival(fest(fee="Gratuit"), FilmProfile(duration_min=15), TODAY)
    assert m.score == 5
    assert any("Durée compatible" in r for r in m.reasons)


def test_too_long_film_scores_one():
    m = svc.rank_festival(fest(max_duration_min=15), FilmProfile(duration_min=25), TODAY)
    assert m.score == 1
    assert any("au-delà" in w for w in m.warnings)


def test_closed_call_is_kept_with_warning():
    m = svc.rank_festival(fest(deadline=date(2026, 9, 24)), None, TODAY)
    assert m.score == 1
    assert any("Appel clos" in w for w in m.warnings)


def test_unknown_deadline_is_not_closed():
    m = svc.rank_festival(fest(deadline=None), None, TODAY)
    assert m.score == 3
    assert not any("clos" in w for w in m.warnings)
    assert any("à confirmer" in w for w in m.warnings)


def test_urgent_deadline_lowers_score():
    m = svc.rank_festival(fest(deadline=date(2026, 11, 25)), None, TODAY)
    assert m.score == 2
    assert any("7 jours" in w for w in m.warnings)


def test_ai_policies_with_declared_ai():
    film = FilmProfile(duration_min=10, declared_ai_departments=2)
    assert svc.rank_festival(fest(ai_policy="interdite"), film, TODAY).score == 1
    silent = svc.rank_festival(fest(ai_policy="non_precisee"), film, TODAY)
    assert any("ne dit rien sur l'IA" in w for w in silent.warnings)
    declare = svc.rank_festival(fest(ai_policy="a_declarer"), film, TODAY)
    assert any("Passeport IA" in r for r in declare.reasons)


def test_score_never_predicts_selection():
    m = svc.rank_festival(fest(), FilmProfile(duration_min=10), TODAY)
    assert all("sélectionné" not in s for s in m.reasons + m.warnings)


# --- Filtres --------------------------------------------------------------------------
def test_filters():
    items = [
        fest(id="a", fee="Gratuit", subtitle_langs=["fr"]),
        fest(id="b", fee="23 €", subtitle_langs=["en"], max_duration_min=15),
        fest(id="c", deadline=None, max_duration_min=None),
    ]
    ids = lambda fs: [f.id for f in fs]
    assert ids(svc.apply_filters(items, FestivalFilters(fee="gratuit"))) == ["a"]
    assert ids(svc.apply_filters(items, FestivalFilters(subtitle_lang="en"))) == ["b"]
    # durée max inconnue : on ne l'exclut pas
    assert ids(svc.apply_filters(items, FestivalFilters(max_duration_min=20))) == ["a", "c"]
    assert ids(svc.apply_filters(items, FestivalFilters(open_only=True))) == ["a", "b"]
    assert "c" not in ids(
        svc.apply_filters(items, FestivalFilters(deadline_before=date(2027, 6, 1)))
    )


def test_search_accent_insensitive():
    items = [fest(id="a", name="Festival de Kélibia")]
    assert len(svc.apply_filters(items, FestivalFilters(q="kelibia"))) == 1


# --- Repli sur le fichier ---------------------------------------------------------------
@pytest.mark.asyncio
async def test_file_fallback_logs_once_and_keeps_list(monkeypatch):
    monkeypatch.setattr(svc, "_file_source_logged", False)
    with capture_logs() as logs:
        first = await svc.list_festivals(None, TODAY)
        second = await svc.list_festivals(None, TODAY)
    warnings = [e for e in logs if e["event"] == "festivals_source_file"]
    assert len(warnings) == 1
    assert warnings[0]["log_level"] == "warning"
    assert len(first) == 20
    assert [f.id for f in first] == [f.id for f in second]
    assert len({f.id for f in first}) == 20


# --- API (données du fichier, sans base) ------------------------------------------------
def test_get_festivals_from_file():
    with TestClient(app) as client:
        app.state.db_pool = None
        r = client.get("/festivals")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 20
        statuses = [m["festival"]["deadline_status"] for m in data]
        # ouverts d'abord, clos à la fin
        assert statuses.index("passee") > statuses.index("ouverte")
        assert all(m["festival"]["source_url"] for m in data)


def test_get_festivals_with_film_and_filters():
    with TestClient(app) as client:
        app.state.db_pool = None
        r = client.get(
            "/festivals",
            params={"film_duration_min": 15, "subtitle_lang": "fr", "open_only": True},
        )
        assert r.status_code == 200
        data = r.json()
        assert data and all("fr" in m["festival"]["subtitle_langs"] for m in data)
        scores = [m["score"] for m in data]
        assert scores == sorted(scores, reverse=True)


def test_post_match():
    with TestClient(app) as client:
        app.state.db_pool = None
        r = client.post(
            "/festivals/match",
            json={"film": {"duration_min": 45, "declared_ai_departments": 1}, "filters": {}},
        )
        assert r.status_code == 200
        too_short = [m for m in r.json() if (m["festival"]["max_duration_min"] or 999) < 45]
        assert too_short and all(m["score"] == 1 for m in too_short)


def test_get_one_and_404():
    with TestClient(app) as client:
        app.state.db_pool = None
        assert client.get("/festivals/clermont-international").json()["country"] == "France"
        r = client.get("/festivals/inconnu")
        assert r.status_code == 404
        assert r.json()["code"] == "festival_not_found"


def test_invalid_params_rejected():
    with TestClient(app) as client:
        app.state.db_pool = None
        assert client.get("/festivals", params={"fee": "cher"}).status_code == 422
        assert (
            client.post("/festivals/match", json={"film": {"duration_min": -3}}).status_code == 422
        )
