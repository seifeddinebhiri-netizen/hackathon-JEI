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
