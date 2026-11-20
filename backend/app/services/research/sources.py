import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.services.tool_names import normalize_name

SOURCES_FILE = (
    Path(__file__).resolve().parent.parent.parent.parent / "data" / "ai_tool_sources.json"
)


@dataclass(frozen=True)
class KnownSource:
    """Site officiel et pages juridiques d'un outil connu, vérifiés à la main puis par script
    (`scripts/verify_tool_sources.py`). Remplace la devinette du modèle pour les outils courants."""

    name: str
    vendor: str
    site: str
    pages: tuple[str, ...]
    aliases: tuple[str, ...] = ()


@lru_cache
def _index(path: Path = SOURCES_FILE) -> dict[str, KnownSource]:
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    index: dict[str, KnownSource] = {}
    for raw in data.get("tools", []):
        source = KnownSource(
            name=raw["name"],
            vendor=raw["vendor"],
            site=raw["site"],
            pages=tuple(raw["pages"]),
            aliases=tuple(raw.get("aliases", [])),
        )
        for label in (source.name, *source.aliases):
            index[normalize_name(label)] = source
    return index


def lookup(name: str, path: Path = SOURCES_FILE) -> KnownSource | None:
    return _index(path).get(normalize_name(name))
