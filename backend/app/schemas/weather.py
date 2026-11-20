"""Météo d'un lieu de tournage, jour par jour (contrat `WeatherDay` du front)."""

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field


class GoldenHour(BaseModel):
    from_: str = Field(serialization_alias="from")
    to: str


class WeatherDay(BaseModel):
    date: dt.date
    # null au-delà de l'horizon de prévision (ou si la source ne donne pas la valeur)
    rain_pct: int | None
    wind_kmh: int | None
    cloud_pct: int | None
    sunrise: str
    sunset: str
    golden_hour: GoldenHour
    forecast: Literal["prevision", "hors_horizon"]
