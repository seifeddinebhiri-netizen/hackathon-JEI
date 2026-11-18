"""Projet, aligné sur le contrat du front (web/src/api/types.ts, web/docs/API_CONTRACT.md).

Les listes (scènes, lieux, personnes...) sont acceptées telles quelles pour l'instant : le front
les valide déjà avec zod. À typer plus strictement plus tard.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_serializer

JsonList = list[dict[str, Any]]


class ShootingWindow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$")
    to: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class CreateProjectInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    format: Literal["court", "long"]
    city: str = Field(default="", max_length=120)
    shooting_window: ShootingWindow
    max_hours_per_day: float = Field(gt=0, le=24)


class UpdateProjectInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    format: Literal["court", "long"] | None = None
    city: str | None = Field(default=None, max_length=120)
    shooting_window: ShootingWindow | None = None
    max_hours_per_day: float | None = Field(default=None, gt=0, le=24)
    scenes: JsonList | None = None
    locations: JsonList | None = None
    people: JsonList | None = None
    schedule: dict[str, Any] | None = None
    festival_shortlist: JsonList | None = None
    film_profile: dict[str, Any] | None = None
    synopsis: dict[str, Any] | None = None
    film_page: dict[str, Any] | None = None


class Project(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    format: Literal["court", "long"]
    city: str
    shooting_window: ShootingWindow
    max_hours_per_day: float
    scenes: JsonList = []
    locations: JsonList = []
    people: JsonList = []
    schedule: dict[str, Any] | None = None
    festival_shortlist: JsonList = []
    film_profile: dict[str, Any] | None = None
    synopsis: dict[str, Any] | None = None
    film_page: dict[str, Any] | None = None

    @model_serializer(mode="wrap")
    def _omit_absent(self, handler):
        """Le front (zod `.optional()`) refuse `null` : une clé facultative absente est omise."""
        data = handler(self)
        for key in ("schedule", "film_profile", "synopsis", "film_page"):
            if data.get(key) is None:
                data.pop(key, None)
        return data


class Ok(BaseModel):
    ok: bool = True


class Me(BaseModel):
    id: str
    email: str | None
    display_name: str
    is_demo: bool
    current_project_id: str | None
