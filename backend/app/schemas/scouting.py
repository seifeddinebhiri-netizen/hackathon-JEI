from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Latitude = Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
Longitude = Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]
Category = Literal["cafe", "restaurant", "park", "beach", "street", "building", "nature"]


class ScoutModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class SceneInput(ScoutModel):
    text: str = Field(min_length=5, max_length=6000)


class Interpretation(ScoutModel):
    category: Category
    keywords: list[str] = Field(max_length=12)
    explanation: str = Field(max_length=2000)


class Requirements(ScoutModel):
    setting: Literal["INT", "EXT", "UNKNOWN"] = "EXT"
    moment: Literal["DAY", "NIGHT", "DAWN", "DUSK", "UNKNOWN"] = "DAY"
    max_wind_kmh: float = Field(default=25, ge=0, le=200)
    max_precipitation_mm: float = Field(default=0.2, ge=0, le=100)
    min_cloud_pct: int = Field(default=0, ge=0, le=100)
    max_cloud_pct: int = Field(default=100, ge=0, le=100)
    min_temperature_c: float = Field(default=5, ge=-60, le=60)
    max_temperature_c: float = Field(default=35, ge=-60, le=60)

    @model_validator(mode="after")
    def ordered_ranges(self):
        if self.min_cloud_pct > self.max_cloud_pct:
            raise ValueError("Invalid cloud range")
        if self.min_temperature_c > self.max_temperature_c:
            raise ValueError("Invalid temperature range")
        return self


class Candidate(ScoutModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(max_length=500)
    address: str = Field(max_length=1500)
    lat: Latitude
    lon: Longitude
    categories: list[str]
    source: Literal["Geoapify / OpenStreetMap"] = "Geoapify / OpenStreetMap"
    availability: Literal["unverified"] = "unverified"
    fetched_at: datetime


class SearchResult(ScoutModel):
    region: str
    center_lat: Latitude
    center_lon: Longitude
    category: Category
    radius_km: int
    candidates: list[Candidate]


class HourWeather(ScoutModel):
    time: datetime
    temperature_c: float | None
    wind_kmh: Annotated[float, Field(ge=0)] | None
    precipitation_mm: Annotated[float, Field(ge=0)] | None
    cloud_pct: Annotated[float, Field(ge=0, le=100)] | None
    is_day: Literal[0, 1] | None


class Weather(ScoutModel):
    location_id: str
    date: date
    status: Literal["available", "unavailable"]
    reason: str | None = None
    timezone: str = "UTC"
    sunrise: datetime | None = None
    sunset: datetime | None = None
    hours: list[HourWeather] = Field(default_factory=list)
    source: Literal["Open-Meteo"] = "Open-Meteo"
    fetched_at: datetime


class EvaluationRequest(ScoutModel):
    location_ids: list[str] = Field(min_length=1, max_length=3)
    date: date
    requirements: Requirements
    scene_text: str = Field(default="", max_length=6000)
    explain_with_ollama: bool = False


class Slot(ScoutModel):
    start: datetime
    end: datetime
    score: int | None
    verdict: Literal["favorable", "a_verifier", "defavorable", "unavailable"]
    reasons: list[str]
    weather: HourWeather


class Evaluation(ScoutModel):
    location: Candidate
    weather: Weather
    slots: list[Slot]
    ai_status: Literal["not_requested", "available", "unavailable"] = "not_requested"
    ai_explanation: str | None = None


class Explanation(ScoutModel):
    explanation: str = Field(min_length=1, max_length=2000)
