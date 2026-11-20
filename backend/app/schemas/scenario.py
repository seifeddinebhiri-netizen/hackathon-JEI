import re
import unicodedata
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ScenarioRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=30, max_length=100_000)


class SceneAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    number: int = Field(ge=1)
    heading: str = Field(min_length=1, max_length=500)
    setting: Literal["INT", "EXT", "UNKNOWN"]
    time_of_day: Literal["DAY", "NIGHT", "DAWN", "DUSK", "UNKNOWN"]
    location: str = Field(max_length=1000)
    summary: str = Field(max_length=3000)
    characters: list[str]
    props: list[str]
    technical_requirements: list[str]
    production_challenges: list[str]
    missing_information: list[str]
    inferences: list[str]
    suggestions: list[str]


class CharacterAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(max_length=2000)
    scenes: list[int]
    production_observations: list[str]


def character_key(name: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", name).casefold().split())


def _base_key(name: str) -> str:
    """« Amira (jeune) » → « amira » : même personnage, autre âge ou autre tenue."""
    return character_key(re.sub(r"\s*\([^)]*\)\s*", " ", name))


_SCENE_LISTS = (
    "characters",
    "props",
    "technical_requirements",
    "production_challenges",
    "missing_information",
    "inferences",
    "suggestions",
)
_ALLOWED = {
    "setting": {"INT", "EXT", "UNKNOWN"},
    "time_of_day": {"DAY", "NIGHT", "DAWN", "DUSK", "UNKNOWN"},
}


def repair_analysis(data: dict) -> dict:
    """Corrige les écarts de forme prévisibles d'un modèle léger, puis les références.

    Une valeur hors liste (« INT/EXT », « CRESC ») devient UNKNOWN, la valeur prévue par le schéma
    pour « pas clair » ; une liste absente devient vide. La numérotation n'est pas touchée : le
    contrôle de l'ordre narratif reste entier. Le contenu (résumés, lieux…) n'est pas modifié.
    """
    if not isinstance(data, dict) or not isinstance(data.get("scenes"), list):
        return data
    scenes = [s for s in data["scenes"] if isinstance(s, dict)]
    for scene in scenes:
        for field, allowed in _ALLOWED.items():
            value = str(scene.get(field, "")).strip().upper()
            scene[field] = value if value in allowed else "UNKNOWN"
        for field in _SCENE_LISTS:
            if not isinstance(scene.get(field), list):
                scene[field] = []
        for field in ("location", "summary"):
            if not isinstance(scene.get(field), str):
                scene[field] = ""
    data["scenes"] = scenes
    chars = data.get("characters")
    data["characters"] = (
        [c for c in chars if isinstance(c, dict)] if isinstance(chars, list) else []
    )
    for c in data["characters"]:
        c.setdefault("description", "")
        if not isinstance(c.get("production_observations"), list):
            c["production_observations"] = []
    return repair_references(data)


def repair_references(data: dict) -> dict:
    """Remet en cohérence la liste des personnages et leurs scènes, sur une réponse brute d'IA.

    Ne touche à aucun fait : les apparitions d'un personnage se déduisent des scènes, donc on les
    recalcule au lieu de faire confiance au modèle. Un nom de scène absent de la liste est rattaché
    au personnage de même nom sans parenthèse (« Amira (jeune) » → « Amira »), sinon ajouté.
    Un personnage qui n'apparaît dans aucune scène est retiré.
    """
    if not isinstance(data, dict):
        return data
    scenes = data.get("scenes")
    characters = data.get("characters")
    if not isinstance(scenes, list) or not isinstance(characters, list):
        return data
    known: dict[str, dict] = {}
    for c in characters:
        if isinstance(c, dict) and isinstance(c.get("name"), str):
            known.setdefault(character_key(c["name"]), c)
    by_base = {_base_key(c["name"]): c for c in known.values()}

    for scene in scenes:
        if not isinstance(scene, dict) or not isinstance(scene.get("characters"), list):
            continue
        names: list[str] = []
        for name in scene["characters"]:
            if not isinstance(name, str) or not name.strip():
                continue
            char = known.get(character_key(name)) or by_base.get(_base_key(name))
            if char is None:
                char = {
                    "name": name.strip(),
                    "description": "",
                    "scenes": [],
                    "production_observations": [],
                }
                known[character_key(name)] = char
                by_base.setdefault(_base_key(name), char)
            if char["name"] not in names:
                names.append(char["name"])
        scene["characters"] = names

    for char in known.values():
        key = character_key(char["name"])
        char["scenes"] = [
            s["number"]
            for s in scenes
            if isinstance(s, dict) and key in {character_key(n) for n in s.get("characters", [])}
        ]
    data["characters"] = [c for c in known.values() if c["scenes"]]
    return data


class ScenarioAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenes: list[SceneAnalysis] = Field(min_length=1, max_length=300)
    characters: list[CharacterAnalysis] = Field(max_length=500)

    @model_validator(mode="after")
    def check_references(self):
        if [s.number for s in self.scenes] != list(range(1, len(self.scenes) + 1)):
            raise ValueError("Scenes must follow narrative order, numbered from 1")
        keys = [character_key(c.name) for c in self.characters]
        if len(set(keys)) != len(keys):
            raise ValueError("Duplicate characters")
        by_name = dict(zip(keys, self.characters))
        for scene in self.scenes:
            names = [character_key(n) for n in scene.characters]
            if len(names) != len(set(names)) or any(n not in by_name for n in names):
                raise ValueError("Invalid scene characters")
            scene.characters = [by_name[name].name for name in names]
        for key, character in by_name.items():
            appearances = [
                s.number for s in self.scenes if key in {character_key(n) for n in s.characters}
            ]
            if not appearances or character.scenes != appearances:
                raise ValueError("Character appearances must match scenes")
        return self


class ScenarioResponse(ScenarioAnalysis):
    title: str
    status: Literal["Brouillon IA : à valider"] = "Brouillon IA : à valider"
    simulated: bool = False
