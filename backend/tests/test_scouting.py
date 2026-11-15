from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import AppError
from app.main import app
from app.schemas.scouting import Explanation, Interpretation
from app.services import scouting_service as module
from app.services.scouting_service import Cache, ScoutingService

NOW = datetime(2026, 11, 15, tzinfo=UTC)
DAY = "2026-11-16"
BASE = datetime(2026, 11, 15, 23, tzinfo=UTC)


def geo(place_id="region", lat=36.8, lon=10.1):
    return {
        "properties": {
            "place_id": place_id,
            "name": "Café de test",
            "formatted": "Adresse fournie",
            "lat": lat,
            "lon": lon,
            "categories": ["catering.cafe"],
        }
    }


def forecast():
    return {
        "timezone": "Africa/Tunis",
        "hourly": {
            "time": [int((BASE + timedelta(hours=h)).timestamp()) for h in range(24)],
            "temperature_2m": [20] * 24,
            "wind_speed_10m": [10] * 24,
            "precipitation": [0] * 24,
            "cloud_cover": [20] * 24,
            "is_day": [int(6 <= h < 18) for h in range(24)],
        },
        "daily": {
            "time": [int(BASE.timestamp())],
            "sunrise": [int((BASE + timedelta(hours=6)).timestamp())],
            "sunset": [int((BASE + timedelta(hours=18)).timestamp())],
        },
    }


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setattr(module, "now", lambda: NOW)
    calls = []
    payload = {"weather": forecast(), "places": {"features": [geo("one"), geo("two", 36.9)]}}

    def handler(request):
        calls.append(request)
        if request.url.path.endswith("geocode/search"):
            return httpx.Response(200, json={"features": [geo()]})
        if request.url.path.endswith("/places"):
            return httpx.Response(200, json=payload["places"])
        return httpx.Response(200, json=payload["weather"])

    settings = Settings(geoapify_api_key="test-key-only")
    service = ScoutingService(settings, httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    with TestClient(app) as client:
        app.state.scouting = service
        yield client, service, calls, payload


def search(client):
    response = client.get(
        "/locations/search", params={"region": "Tunis, Tunisie", "category": "cafe"}
    )
    assert response.status_code == 200, response.text
    return response.json()["candidates"]


def test_real_provider_contract_cache_and_server_coordinates(setup):
    client, _, calls, _ = setup
    places = search(client)
    assert places[0]["lat"] == 36.8
    assert places[0]["availability"] == "unverified"
    assert "test-key-only" not in str(places)
    assert calls[1].url.params["categories"] == "catering.cafe"
    search(client)
    assert len(calls) == 2
    response = client.get(f"/locations/{places[0]['id']}/weather", params={"date": DAY})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["timezone"] == "Africa/Tunis"
    assert len(data["hours"]) == 24
    assert data["hours"][0]["temperature_c"] == 20
    assert calls[-1].url.params["latitude"] == "36.8"
    assert calls[-1].url.params["longitude"] == "10.1"
    client.get(f"/locations/{places[0]['id']}/weather", params={"date": DAY})
    assert len(calls) == 3


@pytest.mark.parametrize("day", ["2026-10-01", "2027-01-01"])
def test_outside_forecast_horizon_never_fabricates_weather(setup, day):
    client, _, calls, _ = setup
    place = search(client)[0]
    response = client.get(f"/locations/{place['id']}/weather", params={"date": day})
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"
    assert response.json()["hours"] == []
    assert response.json()["sunrise"] is None
    assert len(calls) == 2


def test_compare_two_candidates_with_deterministic_rules_and_ai_failure(setup):
    client, service, _, payload = setup
    places = search(client)
    payload["weather"]["hourly"]["wind_speed_10m"] = [40] * 24
    service.ollama.structured = AsyncMock(side_effect=AppError("offline", 503))
    response = client.post(
        "/planning/evaluate-location",
        json={
            "location_ids": [p["id"] for p in places],
            "date": DAY,
            "requirements": {"setting": "EXT", "moment": "DAY", "max_wind_kmh": 25},
            "explain_with_ollama": True,
            "scene_text": "Une scène de café.",
        },
    )
    assert response.status_code == 200, response.text
    assert len(response.json()) == 2
    for item in response.json():
        assert item["ai_status"] == "unavailable"
        day_slot = item["slots"][10]
        assert day_slot["score"] == 70
        assert day_slot["verdict"] == "a_verifier"
        assert any("Vent 40" in reason for reason in day_slot["reasons"])
        assert item["slots"][0]["score"] == 30


def test_missing_measurement_is_not_treated_as_good_weather(setup):
    client, _, _, payload = setup
    place = search(client)[0]
    payload["weather"]["hourly"]["precipitation"][11] = None
    data = client.post(
        "/planning/evaluate-location",
        json={
            "location_ids": [place["id"]],
            "date": DAY,
            "requirements": {},
        },
    ).json()[0]
    assert data["slots"][10]["verdict"] == "unavailable"
    assert data["slots"][10]["score"] is None


@pytest.mark.parametrize("kind", ["coordinates", "weather_length", "weather_range", "timezone"])
def test_malformed_external_data_is_rejected(setup, kind):
    client, _, _, payload = setup
    if kind == "coordinates":
        payload["places"]["features"][0]["properties"]["lat"] = 200
        response = client.get("/locations/search", params={"region": "Test"})
    else:
        place = search(client)[0]
        if kind == "weather_length":
            payload["weather"]["hourly"]["temperature_2m"].pop()
        elif kind == "weather_range":
            payload["weather"]["hourly"]["cloud_cover"][10] = 200
        else:
            payload["weather"]["timezone"] = "Not/AZone"
        response = client.get(f"/locations/{place['id']}/weather", params={"date": DAY})
    assert response.status_code == 502


@pytest.mark.parametrize(
    "params",
    [
        {"region": "a"},
        {"region": "  "},
        {"region": "Tunis", "radius_km": 1000},
        {"region": "Tunis", "category": "injected-query"},
    ],
)
def test_search_validation(setup, params):
    client, _, calls, _ = setup
    assert client.get("/locations/search", params=params).status_code == 422
    assert not calls


def test_unknown_location_invalid_date_and_invalid_thresholds(setup):
    client, _, _, _ = setup
    assert client.get(f"/locations/{'a' * 24}/weather", params={"date": DAY}).status_code == 404
    assert (
        client.get(f"/locations/{'a' * 24}/weather", params={"date": "bad-date"}).status_code == 422
    )
    assert (
        client.post(
            "/planning/evaluate-location",
            json={
                "location_ids": ["a" * 24],
                "date": DAY,
                "requirements": {"min_cloud_pct": 80, "max_cloud_pct": 20},
            },
        ).status_code
        == 422
    )


def test_no_geoapify_key_and_request_rate_limit(setup):
    client, service, calls, _ = setup
    service.settings.geoapify_api_key = Settings(geoapify_api_key="").geoapify_api_key
    response = client.get("/locations/search", params={"region": "Tunis"})
    assert response.status_code == 503
    assert "GEOAPIFY_API_KEY" in response.json()["error"]["message"]
    assert not calls
    for _ in range(19):
        client.get("/locations/search", params={"region": "Tunis"})
    assert client.get("/locations/search", params={"region": "Tunis"}).status_code == 429


@pytest.mark.parametrize("failure,status", [("timeout", 504), ("quota", 429), ("offline", 503)])
def test_provider_errors_are_safe(setup, failure, status):
    client, service, _, _ = setup

    def handler(request):
        if failure == "timeout":
            raise httpx.ReadTimeout("private-provider-text", request=request)
        return httpx.Response(429 if failure == "quota" else 500)

    service.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    response = client.get("/locations/search", params={"region": "Tunis"})
    assert response.status_code == status
    assert "test-key-only" not in response.text
    assert "private-provider-text" not in response.text


def test_semantic_interpretation_only_returns_search_hints(setup):
    client, service, _, _ = setup
    service.ollama.structured = AsyncMock(
        return_value=Interpretation(
            category="cafe", keywords=["café", "fenêtre"], explanation="Le décor est un café."
        )
    )
    response = client.post("/locations/interpret-scene", json={"text": "INT. CAFÉ - JOUR"})
    assert response.status_code == 200
    assert set(response.json()) == {"category", "keywords", "explanation"}


def test_daylight_rain_cloud_temperature_and_interior_rules(setup):
    client, _, _, payload = setup
    place = search(client)[0]
    payload["weather"]["hourly"]["precipitation"] = [5] * 24
    payload["weather"]["hourly"]["cloud_cover"] = [95] * 24
    payload["weather"]["hourly"]["temperature_2m"] = [40] * 24
    body = {
        "location_ids": [place["id"]],
        "date": DAY,
        "requirements": {"setting": "EXT", "max_cloud_pct": 70},
    }
    data = client.post("/planning/evaluate-location", json=body).json()[0]
    slot = data["slots"][10]
    assert slot["score"] == 30
    assert len(slot["reasons"]) == 4
    body["requirements"]["setting"] = "INT"
    interior = client.post("/planning/evaluate-location", json=body).json()[0]
    assert interior["slots"][10]["score"] == 100


def test_cache_ttl_and_capacity(monkeypatch):
    cache = Cache(capacity=2)
    cache.put("a", 1, 10)
    cache.put("b", 2, 10)
    cache.put("c", 3, 10)
    assert cache.get("a") is None
    monkeypatch.setattr(module.time, "monotonic", lambda: float("inf"))
    assert cache.get("c") is None


def test_ai_explanations_cannot_change_deterministic_scores(setup):
    client, service, _, _ = setup
    place = search(client)[0]
    service.ollama.structured = AsyncMock(
        return_value=Explanation(explanation="La scène exige la lumière du jour.")
    )
    data = client.post(
        "/planning/evaluate-location",
        json={
            "location_ids": [place["id"]],
            "date": DAY,
            "requirements": {},
            "explain_with_ollama": True,
        },
    ).json()[0]
    assert data["ai_status"] == "available"
    assert data["slots"][10]["score"] == 100


def test_polar_missing_sunrise_has_no_invented_dawn_slot(setup):
    client, _, _, payload = setup
    place = search(client)[0]
    payload["weather"]["daily"]["sunrise"] = [None]
    data = client.post(
        "/planning/evaluate-location",
        json={
            "location_ids": [place["id"]],
            "date": DAY,
            "requirements": {"moment": "DAWN"},
        },
    ).json()[0]
    assert data["weather"]["sunrise"] is None
    assert all(slot["score"] is None for slot in data["slots"])
