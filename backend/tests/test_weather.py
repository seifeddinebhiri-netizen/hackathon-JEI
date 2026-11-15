from datetime import date, timedelta

import httpx
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.services.weather_service import WeatherService, sun_times_utc

TUNIS = (36.8065, 10.1815)


def _open_meteo(calls: list[httpx.Request], start: date, fail: bool = False):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if fail:
            return httpx.Response(500)
        days = [(start + timedelta(days=i)).isoformat() for i in range(3)]
        return httpx.Response(
            200,
            json={
                "utc_offset_seconds": 3600,
                "daily": {
                    "time": days,
                    "precipitation_probability_max": [65, 10, None],
                    "wind_speed_10m_max": [20.4, 45.0, 12.0],
                    "cloud_cover_mean": [90, 20, 30],
                    "sunrise": [f"{d}T07:04" for d in days],
                    "sunset": [f"{d}T17:06" for d in days],
                },
            },
        )

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _get(service, params):
    with TestClient(app) as client:
        app.state.weather = service
        return client.get("/planner/weather", params=params)


def test_sun_times_for_tunis_in_november():
    sunrise, sunset = sun_times_utc(date(2026, 11, 22), *TUNIS)
    # Tunis (UTC+1) : lever vers 7 h 04, coucher vers 17 h 06 heure locale
    assert abs((sunrise.hour * 60 + sunrise.minute) - (6 * 60 + 4)) <= 4
    assert abs((sunset.hour * 60 + sunset.minute) - (16 * 60 + 6)) <= 4


def test_forecast_then_beyond_horizon():
    start = date(2026, 11, 22)
    calls: list[httpx.Request] = []
    service = WeatherService(get_settings(), _open_meteo(calls, start))
    r = _get(service, {"lat": TUNIS[0], "lon": TUNIS[1], "from": "2026-11-22", "to": "2026-11-25"})
    assert r.status_code == 200
    days = r.json()
    assert [d["date"] for d in days] == ["2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"]
    first, second, missing, beyond = days
    assert first == {
        "date": "2026-11-22",
        "rain_pct": 65,
        "wind_kmh": 20,
        "cloud_pct": 90,
        "sunrise": "2026-11-22T07:04:00+01:00",
        "sunset": "2026-11-22T17:06:00+01:00",
        "golden_hour": {"from": "2026-11-22T16:06:00+01:00", "to": "2026-11-22T17:06:00+01:00"},
        "forecast": "prevision",
    }
    assert second["wind_kmh"] == 45
    # Valeur absente : pas de chiffre inventé
    assert missing["forecast"] == "hors_horizon" and missing["rain_pct"] is None
    # Au-delà de l'horizon : pas de météo, mais le soleil est calculé
    assert beyond["forecast"] == "hors_horizon"
    assert beyond["rain_pct"] is None
    assert beyond["sunrise"].startswith("2026-11-25T07:0")
    assert beyond["sunrise"].endswith("+01:00")
    assert calls[0].url.params["timezone"] == "auto"


def test_open_meteo_down_gives_sun_times_only():
    calls: list[httpx.Request] = []
    service = WeatherService(get_settings(), _open_meteo(calls, date(2026, 11, 22), fail=True))
    r = _get(service, {"lat": TUNIS[0], "lon": TUNIS[1], "from": "2026-11-22", "to": "2026-11-22"})
    assert r.status_code == 200
    (day,) = r.json()
    assert day["forecast"] == "hors_horizon"
    assert day["sunrise"].endswith("+01:00")


def test_cache_avoids_second_call():
    calls: list[httpx.Request] = []
    service = WeatherService(get_settings(), _open_meteo(calls, date(2026, 11, 22)))
    params = {"lat": TUNIS[0], "lon": TUNIS[1], "from": "2026-11-22", "to": "2026-11-23"}
    _get(service, params)
    _get(service, params)
    assert len(calls) == 1


def test_invalid_ranges_are_rejected():
    service = WeatherService(get_settings(), _open_meteo([], date(2026, 11, 22)))
    bad = {"lat": TUNIS[0], "lon": TUNIS[1], "from": "2026-11-25", "to": "2026-11-22"}
    assert _get(service, bad).status_code == 422
    long = {"lat": TUNIS[0], "lon": TUNIS[1], "from": "2026-01-01", "to": "2026-12-31"}
    assert _get(service, long).status_code == 422
    assert _get(service, {**bad, "lat": 200}).status_code == 422
