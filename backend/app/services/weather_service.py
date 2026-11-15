"""Météo jour par jour d'un lieu (Open-Meteo, par coordonnées).

- Dans l'horizon de prévision (14 jours) : probabilité de pluie, vent, nuages, lever et coucher.
- Au-delà : pas de chiffre inventé (valeurs nulles, `hors_horizon`), mais lever et coucher du soleil
  calculés (formules de la NOAA), qui ne dépendent que de la date et du lieu.
"""

import math
import time
from datetime import UTC, date, datetime, timedelta, timezone

import httpx
import structlog

from app.core.config import Settings
from app.schemas.weather import GoldenHour, WeatherDay

log = structlog.get_logger()

HORIZON_DAYS = 14
CACHE_TTL_S = 3600
DAILY_VARS = "precipitation_probability_max,wind_speed_10m_max,cloud_cover_mean,sunrise,sunset"
USER_AGENT = "Encadre-API/0.1 (planification de tournage)"


def sun_times_utc(day: date, lat: float, lon: float) -> tuple[datetime, datetime]:
    """Lever et coucher du soleil (UTC), formules simplifiées de la NOAA (précision ~1 min)."""
    n = day.timetuple().tm_yday
    g = 2 * math.pi / 365 * (n - 1)
    eqtime = 229.18 * (
        0.000075
        + 0.001868 * math.cos(g)
        - 0.032077 * math.sin(g)
        - 0.014615 * math.cos(2 * g)
        - 0.040849 * math.sin(2 * g)
    )
    decl = (
        0.006918
        - 0.399912 * math.cos(g)
        + 0.070257 * math.sin(g)
        - 0.006758 * math.cos(2 * g)
        + 0.000907 * math.sin(2 * g)
        - 0.002697 * math.cos(3 * g)
        + 0.00148 * math.sin(3 * g)
    )
    phi = math.radians(lat)
    cos_ha = math.cos(math.radians(90.833)) / (math.cos(phi) * math.cos(decl)) - math.tan(
        phi
    ) * math.tan(decl)
    ha = math.degrees(math.acos(max(-1.0, min(1.0, cos_ha))))
    midnight = datetime(day.year, day.month, day.day, tzinfo=UTC)
    sunrise = midnight + timedelta(minutes=720 - 4 * (lon + ha) - eqtime)
    sunset = midnight + timedelta(minutes=720 - 4 * (lon - ha) - eqtime)
    return sunrise, sunset


def _iso(dt: datetime, offset: timezone) -> str:
    return dt.astimezone(offset).replace(second=0, microsecond=0).isoformat()


def _local_iso(value: str, offset: timezone) -> str:
    """« 2026-11-22T07:04 » (heure locale Open-Meteo) → ISO avec décalage."""
    return datetime.fromisoformat(value).replace(tzinfo=offset).isoformat()


class WeatherService:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        self.settings = settings
        self.client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(10, connect=5), headers={"User-Agent": USER_AGENT}
        )
        self._cache: dict[tuple[float, float], tuple[float, dict]] = {}

    async def _forecast(self, lat: float, lon: float) -> dict | None:
        key = (round(lat, 3), round(lon, 3))
        hit = self._cache.get(key)
        if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
            return hit[1]
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": DAILY_VARS,
            "timezone": "auto",
            "forecast_days": HORIZON_DAYS,
        }
        key_value = self.settings.open_meteo_api_key.get_secret_value()
        if key_value:
            params["apikey"] = key_value
        try:
            r = await self.client.get(self.settings.open_meteo_url, params=params)
            r.raise_for_status()
            data = r.json()
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("open_meteo_error", error=type(exc).__name__)
            return None
        self._cache[key] = (time.monotonic(), data)
        return data

    async def days(self, lat: float, lon: float, start: date, end: date) -> list[WeatherDay]:
        data = await self._forecast(lat, lon)
        if data is not None:
            offset = timezone(timedelta(seconds=int(data.get("utc_offset_seconds", 0))))
        else:
            # Sans réponse : fuseau approché par la longitude (heures pleines)
            offset = timezone(timedelta(hours=round(lon / 15)))

        daily = (data or {}).get("daily") or {}
        by_date: dict[str, int] = {d: i for i, d in enumerate(daily.get("time", []))}

        def pick(name: str, i: int):
            values = daily.get(name) or []
            return values[i] if i < len(values) else None

        out: list[WeatherDay] = []
        day = start
        while day <= end:
            i = by_date.get(day.isoformat())
            rain = wind = cloud = None
            sunrise = sunset = None
            if i is not None:
                rain, wind, cloud = (
                    pick("precipitation_probability_max", i),
                    pick("wind_speed_10m_max", i),
                    pick("cloud_cover_mean", i),
                )
                sr, ss = pick("sunrise", i), pick("sunset", i)
                if sr and ss:
                    sunrise, sunset = _local_iso(sr, offset), _local_iso(ss, offset)
            if sunrise is None or sunset is None:
                sr_utc, ss_utc = sun_times_utc(day, lat, lon)
                sunrise, sunset = _iso(sr_utc, offset), _iso(ss_utc, offset)
            known = None not in (rain, wind, cloud)
            golden_from = (datetime.fromisoformat(sunset) - timedelta(hours=1)).isoformat()
            out.append(
                WeatherDay(
                    date=day,
                    rain_pct=round(rain) if known else None,
                    wind_kmh=round(wind) if known else None,
                    cloud_pct=round(cloud) if known else None,
                    sunrise=sunrise,
                    sunset=sunset,
                    golden_hour=GoldenHour(from_=golden_from, to=sunset),
                    forecast="prevision" if known else "hors_horizon",
                )
            )
            day += timedelta(days=1)
        return out
