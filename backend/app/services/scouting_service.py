import asyncio
import hashlib
import time
from collections import OrderedDict, deque
from datetime import UTC, date, datetime, timedelta
from typing import TypeVar
from zoneinfo import ZoneInfo

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.config import Settings
from app.core.errors import AppError
from app.schemas.scouting import (
    Candidate,
    Category,
    Evaluation,
    EvaluationRequest,
    Explanation,
    HourWeather,
    Interpretation,
    Latitude,
    Longitude,
    Requirements,
    SearchResult,
    Slot,
    Weather,
)
from app.services.ollama_service import OllamaService

CATEGORIES = {
    "cafe": "catering.cafe",
    "restaurant": "catering.restaurant",
    "park": "leisure.park",
    "beach": "beach",
    "street": "highway.residential",
    "building": "building",
    "nature": "natural",
}
T = TypeVar("T")


class Cache:
    def __init__(self, capacity=512):
        self.items: OrderedDict[str, tuple[float, object]] = OrderedDict()
        self.capacity = capacity

    def get(self, key: str):
        item = self.items.get(key)
        if item is None:
            return None
        if item[0] <= time.monotonic():
            self.items.pop(key)
            return None
        self.items.move_to_end(key)
        return item[1]

    def put(self, key: str, value: T, ttl: float) -> T:
        self.items[key] = (time.monotonic() + ttl, value)
        self.items.move_to_end(key)
        while len(self.items) > self.capacity:
            self.items.popitem(last=False)
        return value


class GeoProperties(BaseModel):
    model_config = ConfigDict(extra="ignore")
    place_id: str = Field(min_length=1, max_length=1000)
    lat: Latitude
    lon: Longitude
    name: str = Field(default="", max_length=500)
    formatted: str = Field(default="", max_length=1500)
    categories: list[str] = Field(default_factory=list)


class GeoFeature(BaseModel):
    properties: GeoProperties


class GeoResponse(BaseModel):
    features: list[GeoFeature]


class ProviderHourly(BaseModel):
    time: list[int]
    temperature_2m: list[float | None]
    wind_speed_10m: list[float | None]
    precipitation: list[float | None]
    cloud_cover: list[float | None]
    is_day: list[int | None]


class ProviderDaily(BaseModel):
    time: list[int]
    sunrise: list[int | None]
    sunset: list[int | None]


class ProviderWeather(BaseModel):
    timezone: str
    hourly: ProviderHourly
    daily: ProviderDaily


def now() -> datetime:
    return datetime.now(UTC)


def evaluate_hour(hour: HourWeather, weather: Weather, req: Requirements) -> Slot:
    reasons = ["Autorisation, accès et disponibilité de tournage non vérifiés."]
    end = hour.time + timedelta(hours=1)
    values = (hour.temperature_c, hour.wind_kmh, hour.precipitation_mm, hour.cloud_pct, hour.is_day)
    missing_solar = (req.moment == "DAWN" and weather.sunrise is None) or (
        req.moment == "DUSK" and weather.sunset is None
    )
    if hour.time < now() or any(v is None for v in values) or missing_solar:
        reasons.append(
            "Créneau passé, données horaires ou événement solaire indisponibles : aucune recommandation météo."
        )
        return Slot(
            start=hour.time,
            end=end,
            score=None,
            verdict="unavailable",
            reasons=reasons,
            weather=hour,
        )
    score = 100
    if req.setting == "UNKNOWN" or req.moment == "UNKNOWN":
        score -= 15
        reasons.append("INT/EXT ou moment de la scène à préciser.")
    if req.setting == "INT":
        reasons.append(
            "Intérieur : météo extérieure indicative, sans décrire les conditions du bâtiment."
        )
    else:
        if hour.wind_kmh > req.max_wind_kmh:
            score -= 30
            reasons.append(f"Vent {hour.wind_kmh:g} km/h > seuil {req.max_wind_kmh:g} km/h.")
        if hour.precipitation_mm > req.max_precipitation_mm:
            score -= 35
            reasons.append(
                f"Précipitations {hour.precipitation_mm:g} mm > seuil "
                f"{req.max_precipitation_mm:g} mm sur le créneau."
            )
        if not req.min_cloud_pct <= hour.cloud_pct <= req.max_cloud_pct:
            score -= 15
            reasons.append(
                f"Nuages {hour.cloud_pct:g} % hors plage {req.min_cloud_pct}–{req.max_cloud_pct} %."
            )
        if not req.min_temperature_c <= hour.temperature_c <= req.max_temperature_c:
            score -= 20
            reasons.append(
                f"Température {hour.temperature_c:g} °C hors plage "
                f"{req.min_temperature_c:g}–{req.max_temperature_c:g} °C."
            )
    light_ok = True
    if req.moment in ("DAY", "NIGHT"):
        light_ok = hour.is_day == (1 if req.moment == "DAY" else 0)
    elif req.moment in ("DAWN", "DUSK"):
        sun = weather.sunrise if req.moment == "DAWN" else weather.sunset
        light_ok = sun is not None and abs((hour.time - sun).total_seconds()) <= 3600
    if not light_ok:
        score -= 40
        reasons.append(
            "Lumière naturelle incompatible avec le moment demandé (aube/soir : ±1 h du lever/coucher)."
        )
    if score == 100:
        reasons.append("Les seuils renseignés et le moment demandé sont respectés.")
    score = max(0, score)
    return Slot(
        start=hour.time,
        end=end,
        score=score,
        verdict="favorable" if score >= 85 else "a_verifier" if score >= 60 else "defavorable",
        reasons=reasons,
        weather=hour,
    )


class ScoutingService:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None):
        self.settings = settings
        self.client = client or httpx.AsyncClient(timeout=httpx.Timeout(15, connect=5))
        self.ollama = OllamaService(settings)
        self.cache = Cache()
        self.places = Cache()
        self._work_lock = asyncio.Lock()
        self._provider_lock = asyncio.Lock()
        self._last_request = 0.0
        self._day = now().date()
        self._calls = 0
        self._clients: OrderedDict[str, deque] = OrderedDict()

    def check_rate(self, ip: str):
        ticks = self._clients.setdefault(ip, deque())
        self._clients.move_to_end(ip)
        while len(self._clients) > 2048:
            self._clients.popitem(last=False)
        while ticks and ticks[0] < time.monotonic() - 60:
            ticks.popleft()
        if len(ticks) >= 20:
            raise AppError(
                "Trop de demandes. Attends une minute avant de réessayer.",
                429,
                "scouting_rate_limit",
            )
        ticks.append(time.monotonic())

    async def _get(self, url: str, params: dict, *, geo: bool = False):
        try:
            async with self._provider_lock:
                if now().date() != self._day:
                    self._day, self._calls = now().date(), 0
                if self._calls >= self.settings.scouting_daily_provider_budget:
                    raise AppError(
                        "Budget quotidien de requêtes atteint. Réessaie demain.",
                        429,
                        "provider_budget",
                    )
                await asyncio.sleep(max(0, 0.35 - (time.monotonic() - self._last_request)))
                self._last_request = time.monotonic()
                self._calls += 1
                response = await self.client.get(url, params=params)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            raise AppError(
                "Le fournisseur met trop de temps à répondre. Réessaie.", 504, "provider_timeout"
            ) from None
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status == 429:
                raise AppError(
                    "Quota du fournisseur atteint. Réessaie plus tard.", 429, "provider_rate_limit"
                ) from None
            message = (
                "Clé Geoapify refusée. Vérifie GEOAPIFY_API_KEY côté serveur."
                if geo and status in (401, 403)
                else "Fournisseur indisponible. Réessaie plus tard."
            )
            raise AppError(message, 503, "provider_unavailable") from None
        except httpx.HTTPError:
            raise AppError(
                "Impossible de joindre le fournisseur de données.", 503, "provider_unavailable"
            ) from None
        except ValueError:
            raise AppError(
                "Réponse fournisseur invalide.", 502, "invalid_provider_output"
            ) from None

    def location(self, location_id: str) -> Candidate:
        place = self.places.get(location_id)
        if place is None:
            raise AppError(
                "Lieu expiré ou inconnu. Relance la recherche de lieux.", 404, "location_expired"
            )
        return place

    async def search(self, region: str, category: Category, radius_km: int) -> SearchResult:
        key = self.settings.geoapify_api_key.get_secret_value()
        if not key:
            raise AppError(
                "Configure GEOAPIFY_API_KEY dans backend/.env pour rechercher des lieux réels.",
                503,
                "places_not_configured",
            )
        cache_key = f"places:{region.casefold()}:{category}:{radius_km}"
        async with self._work_lock:
            cached = self.cache.get(cache_key)
            if cached is not None:
                for candidate in cached.candidates:
                    self.places.put(candidate.id, candidate, 86400)
                return cached
            try:
                geokey = f"region:{region.casefold()}"
                geo = self.cache.get(geokey)
                if geo is None:
                    raw = await self._get(
                        "https://api.geoapify.com/v1/geocode/search",
                        {
                            "text": region,
                            "limit": 1,
                            "lang": "fr",
                            "apiKey": key,
                        },
                        geo=True,
                    )
                    found = GeoResponse.model_validate(raw)
                    if not found.features:
                        raise AppError(
                            "Région introuvable. Précise la ville et le pays.",
                            404,
                            "region_not_found",
                        )
                    geo = self.cache.put(geokey, found.features[0].properties, 86400)
                raw = await self._get(
                    "https://api.geoapify.com/v2/places",
                    {
                        "categories": CATEGORIES[category],
                        "limit": 12,
                        "lang": "fr",
                        "filter": f"circle:{geo.lon},{geo.lat},{radius_km * 1000}",
                        "bias": f"proximity:{geo.lon},{geo.lat}",
                        "apiKey": key,
                    },
                    geo=True,
                )
                places = GeoResponse.model_validate(raw)
                candidates: dict[str, Candidate] = {}
                for feature in places.features:
                    p = feature.properties
                    ident = hashlib.sha256(p.place_id.encode()).hexdigest()[:24]
                    candidate = Candidate(
                        id=ident,
                        name=p.name or p.formatted or "Lieu sans nom renseigné",
                        address=p.formatted,
                        lat=p.lat,
                        lon=p.lon,
                        categories=p.categories,
                        fetched_at=now(),
                    )
                    candidates[ident] = candidate
                    self.places.put(ident, candidate, 86400)
                result = SearchResult(
                    region=geo.formatted or region,
                    center_lat=geo.lat,
                    center_lon=geo.lon,
                    category=category,
                    radius_km=radius_km,
                    candidates=list(candidates.values()),
                )
                return self.cache.put(cache_key, result, 3600)
            except (ValidationError, KeyError, TypeError):
                raise AppError(
                    "Données de lieux invalides. Réessaie plus tard.",
                    502,
                    "invalid_provider_output",
                ) from None

    async def weather(self, location_id: str, shooting_date: date) -> Weather:
        place = self.location(location_id)
        unavailable = Weather(
            location_id=location_id,
            date=shooting_date,
            status="unavailable",
            reason="Date hors horizon de prévision (jusqu'à 16 jours, selon les données disponibles).",
            fetched_at=now(),
        )
        # Guard before provider call; timezone-specific check is performed after decoding.
        if (
            not now().date() - timedelta(days=1)
            <= shooting_date
            <= now().date() + timedelta(days=16)
        ):
            return unavailable
        cache_key = f"weather:{place.lat}:{place.lon}"
        async with self._work_lock:
            data = self.cache.get(cache_key)
            if data is None:
                params = {
                    "latitude": place.lat,
                    "longitude": place.lon,
                    "timezone": "auto",
                    "forecast_days": 16,
                    "timeformat": "unixtime",
                    "wind_speed_unit": "kmh",
                    "temperature_unit": "celsius",
                    "precipitation_unit": "mm",
                    "hourly": "temperature_2m,wind_speed_10m,precipitation,cloud_cover,is_day",
                    "daily": "sunrise,sunset",
                }
                if self.settings.open_meteo_api_key.get_secret_value():
                    params["apikey"] = self.settings.open_meteo_api_key.get_secret_value()
                raw = await self._get(self.settings.open_meteo_url, params)
                try:
                    data = (ProviderWeather.model_validate(raw), now())
                    self._decode_weather(data[0], location_id, shooting_date, data[1])
                except (ValueError, TypeError, KeyError, OverflowError, OSError):
                    raise AppError(
                        "Prévisions reçues invalides. Aucune météo inventée.",
                        502,
                        "invalid_weather_output",
                    ) from None
                self.cache.put(cache_key, data, 600)
        try:
            return self._decode_weather(data[0], location_id, shooting_date, data[1])
        except (ValueError, TypeError, KeyError, OverflowError, OSError):
            raise AppError(
                "Prévisions reçues invalides. Aucune météo inventée.", 502, "invalid_weather_output"
            ) from None

    def _decode_weather(
        self, data: ProviderWeather, location_id: str, day: date, fetched: datetime
    ) -> Weather:
        tz = ZoneInfo(data.timezone)
        today = now().astimezone(tz).date()
        if not today <= day < today + timedelta(days=16):
            return Weather(
                location_id=location_id,
                date=day,
                status="unavailable",
                reason="Date hors horizon de prévision local.",
                timezone=data.timezone,
                fetched_at=fetched,
            )
        hourly = data.hourly
        arrays = [
            hourly.time,
            hourly.temperature_2m,
            hourly.wind_speed_10m,
            hourly.precipitation,
            hourly.cloud_cover,
            hourly.is_day,
        ]
        if len({len(a) for a in arrays}) != 1 or not hourly.time:
            raise ValueError("Misaligned hourly arrays")
        if any(b - a != 3600 for a, b in zip(hourly.time, hourly.time[1:])):
            raise ValueError("Unordered or non-hourly timestamps")
        if len({len(data.daily.time), len(data.daily.sunrise), len(data.daily.sunset)}) != 1:
            raise ValueError("Misaligned daily arrays")
        hours = []
        for i, stamp in enumerate(hourly.time):
            at = datetime.fromtimestamp(stamp, UTC)
            if at.astimezone(tz).date() == day:
                hours.append(
                    HourWeather(
                        time=at,
                        temperature_c=hourly.temperature_2m[i],
                        wind_kmh=hourly.wind_speed_10m[i],
                        # Provider precipitation is accumulated over the preceding hour.
                        # Align it with our [time, time + 1h] shooting interval.
                        precipitation_mm=hourly.precipitation[i + 1]
                        if i + 1 < len(hourly.time)
                        else None,
                        cloud_pct=hourly.cloud_cover[i],
                        is_day=hourly.is_day[i],
                    )
                )
        sunrise = sunset = None
        for i, stamp in enumerate(data.daily.time):
            if datetime.fromtimestamp(stamp, UTC).astimezone(tz).date() == day:
                rise, fall = data.daily.sunrise[i], data.daily.sunset[i]
                sunrise = datetime.fromtimestamp(rise, UTC) if rise and rise > 0 else None
                sunset = datetime.fromtimestamp(fall, UTC) if fall and fall > 0 else None
        return Weather(
            location_id=location_id,
            date=day,
            status="available" if hours else "unavailable",
            reason=None if hours else "Aucune prévision pour cette date.",
            timezone=data.timezone,
            sunrise=sunrise,
            sunset=sunset,
            hours=hours,
            fetched_at=fetched,
        )

    async def interpret(self, text: str) -> Interpretation:
        return await self.ollama.structured(
            Interpretation,
            "À partir des faits de la scène, suggère une catégorie de lieu parmi les catégories "
            "du schéma. Explique le lien avec le décor et les éléments incertains. N'invente aucun "
            "lieu réel, coordonnée, mesure météo ni disponibilité. C'est un brouillon modifiable.",
            {"scene": text},
        )

    async def evaluate(self, body: EvaluationRequest) -> list[Evaluation]:
        evaluations = []
        for ident in dict.fromkeys(body.location_ids):
            place = self.location(ident)
            weather = await self.weather(ident, body.date)
            slots = [evaluate_hour(h, weather, body.requirements) for h in weather.hours]
            result = Evaluation(location=place, weather=weather, slots=slots)
            if body.explain_with_ollama:
                try:
                    best = sorted(
                        [s for s in slots if s.score is not None],
                        key=lambda s: s.score,
                        reverse=True,
                    )[:3]
                    explanation = await self.ollama.structured(
                        Explanation,
                        "Explique le rapprochement entre la scène et les critères fournis. "
                        "Ne recalcule pas les scores. N'invente ni coordonnée, météo ni disponibilité. "
                        "Ne prétends pas qu'un accès ou un tournage est autorisé. Ne cite aucun chiffre. "
                        "Les règles déterministes sont la seule source des verdicts météo.",
                        {
                            "scene": body.scene_text,
                            "place": place.name,
                            "category": place.categories,
                            "rules": body.requirements.model_dump(),
                            "reasons": [s.reasons for s in best],
                            "forecast_status": weather.status,
                        },
                    )
                    result.ai_status, result.ai_explanation = "available", explanation.explanation
                except AppError:
                    result.ai_status = "unavailable"
            evaluations.append(result)
        return evaluations
