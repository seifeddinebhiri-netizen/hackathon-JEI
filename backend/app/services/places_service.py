"""Recherche de lieux RÉELS dans la ville de tournage (OpenStreetMap Nominatim).

Règles d'usage de Nominatim respectées : User-Agent explicite, au plus 1 requête par seconde,
résultats mis en cache. Les lieux renvoyés viennent uniquement de Nominatim, jamais du LLM.
"""

import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable

import httpx
import structlog

from app.schemas.location_suggest import PlaceCandidate

log = structlog.get_logger()

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "Encadre-API/0.1 (reperage de lieux de tournage pour jeunes cineastes)"
MAX_RESULTS = 3
CACHE_SIZE = 500


class PlacesService:
    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        *,
        min_interval: float = 1.0,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ):
        self.client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(10, connect=5), headers={"User-Agent": USER_AGENT}
        )
        self._min_interval = min_interval
        self._clock = clock
        self._sleep = sleep
        self._lock = asyncio.Lock()
        self._last: float | None = None
        self._cache: OrderedDict[str, list[PlaceCandidate]] = OrderedDict()

    async def search(self, query: str, city: str) -> list[PlaceCandidate]:
        """0 à 3 lieux réels pour « <requête>, <ville> », en Tunisie. [] en cas d'erreur."""
        key = f"{query.strip().casefold()}|{city.strip().casefold()}"
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]

        async with self._lock:
            # Au plus 1 requête par seconde, toutes recherches confondues
            if self._last is not None:
                wait = self._min_interval - (self._clock() - self._last)
                if wait > 0:
                    await self._sleep(wait)
            try:
                response = await self.client.get(
                    NOMINATIM_URL,
                    params={
                        "q": f"{query}, {city}",
                        "format": "jsonv2",
                        "limit": MAX_RESULTS,
                        "countrycodes": "tn",
                        "addressdetails": 1,
                    },
                    headers={"User-Agent": USER_AGENT},
                )
                response.raise_for_status()
                items = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                # Pas de requête dans les journaux : seulement le type d'erreur
                log.warning("nominatim_error", error=type(exc).__name__)
                return []
            finally:
                self._last = self._clock()

        places = [p for p in (_to_candidate(i) for i in items[:MAX_RESULTS]) if p is not None]
        self._cache[key] = places
        if len(self._cache) > CACHE_SIZE:
            self._cache.popitem(last=False)
        return places

    async def aclose(self) -> None:
        await self.client.aclose()


def _to_candidate(item: dict) -> PlaceCandidate | None:
    try:
        lat = float(item["lat"])
        lon = float(item["lon"])
        address = str(item.get("display_name") or "").strip()
        name = str(item.get("name") or "").strip() or address.split(",")[0].strip()
        osm_type = item.get("osm_type")
        osm_id = item.get("osm_id")
    except (KeyError, TypeError, ValueError):
        return None
    if not name or not address:
        return None
    osm_url = (
        f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
        if osm_type in {"node", "way", "relation"} and osm_id
        else f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=18/{lat}/{lon}"
    )
    return PlaceCandidate(name=name, address=address, lat=lat, lon=lon, osm_url=osm_url)
