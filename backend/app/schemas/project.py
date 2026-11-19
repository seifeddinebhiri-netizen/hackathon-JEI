"""Projet du Planner (contrat : web/src/api/types.ts, type `Project`).

En base (table `projects`) : title, format et city ont leur colonne ; tout le reste du projet
(fenêtre de tournage, scènes, décors, équipe, plan de travail, Kit Festival…) est dans `data`.
Les listes imbriquées (scènes, décors…) sont validées par le front (zod) à chaque lecture ;
ici on vérifie leur forme générale et on borne leur taille.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Format = Literal["court", "long"]

# Champs facultatifs du type Project : `null` dans un PATCH les retire.
OPTIONAL_FIELDS = ("schedule", "film_profile", "synopsis", "film_page")
# Listes toujours présentes dans la réponse (vides par défaut).
LIST_FIELDS = ("scenes", "locations", "people", "festival_shortlist", "members")


class _Lenient(BaseModel):
    # Le front peut envoyer plus de champs que le contrat (objet étalé) : ignorés, pas d'erreur.
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class ShootingWindow(_Lenient):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    from_: str = Field(alias="from", min_length=1, max_length=40)
    to: str = Field(min_length=1, max_length=40)


class FilmProfile(_Lenient):
    duration_min: float = Field(ge=0, le=100_000)
    language: str = Field(max_length=100)
    genre: str = Field(max_length=100)


class Synopsis(_Lenient):
    phrase: str = Field(max_length=2_000)
    court: str = Field(max_length=10_000)
    long: str = Field(max_length=50_000)


class FilmPage(_Lenient):
    stills: list[str] = Field(max_length=100)
    trailer_url: str | None = Field(default=None, max_length=2_000)


Items = list[dict[str, Any]]


class CreateProjectInput(_Lenient):
    title: str = Field(min_length=1, max_length=200)
    format: Format
    city: str = Field(max_length=200)
    shooting_window: ShootingWindow
    max_hours_per_day: float = Field(gt=0, le=24)


class UpdateProjectInput(_Lenient):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    format: Format | None = None
    city: str | None = Field(default=None, max_length=200)
    shooting_window: ShootingWindow | None = None
    max_hours_per_day: float | None = Field(default=None, gt=0, le=24)
    scenes: Items | None = Field(default=None, max_length=2_000)
    locations: Items | None = Field(default=None, max_length=1_000)
    people: Items | None = Field(default=None, max_length=1_000)
    # Équipe pour les convocations (type Member du contrat)
    members: Items | None = Field(default=None, max_length=200)
    schedule: dict[str, Any] | None = None
    festival_shortlist: Items | None = Field(default=None, max_length=500)
    film_profile: FilmProfile | None = None
    synopsis: Synopsis | None = None
    film_page: FilmPage | None = None

    @field_validator(
        "title",
        "format",
        "city",
        "shooting_window",
        "max_hours_per_day",
        *LIST_FIELDS,
        mode="before",
    )
    @classmethod
    def _required_not_null(cls, v):
        # Ces champs existent toujours dans un projet : on peut les changer, pas les effacer.
        if v is None:
            raise ValueError("ce champ ne peut pas être vide")
        return v
