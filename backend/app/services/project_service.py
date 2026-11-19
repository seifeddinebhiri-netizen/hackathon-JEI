"""Lecture et écriture des projets dans Postgres (table `projects`).

Chaque requête filtre sur `owner_id` : le rôle Postgres du serveur ignore les règles RLS, la
séparation entre utilisateurs repose donc sur ces filtres. Un projet d'un autre utilisateur
répond « introuvable », exactement comme un projet qui n'existe pas.
"""

import json
from typing import Any
from uuid import UUID

import asyncpg

from app.core.errors import AppError
from app.schemas.project import (
    LIST_FIELDS,
    OPTIONAL_FIELDS,
    CreateProjectInput,
    UpdateProjectInput,
)

_COLUMNS = ("title", "format", "city")
_RETURNING = "id, title, format, city, data"


def _not_found() -> AppError:
    return AppError("Projet introuvable.", 404, "introuvable")


def _project_id(raw: str) -> UUID:
    try:
        return UUID(raw)
    except ValueError:
        raise _not_found() from None


def to_project(row: asyncpg.Record) -> dict[str, Any]:
    """Ligne SQL → objet `Project` du contrat (listes vides par défaut, jamais de null)."""
    data = row["data"]
    if isinstance(data, str):
        data = json.loads(data)
    project: dict[str, Any] = {field: [] for field in LIST_FIELDS}
    project.update({k: v for k, v in data.items() if v is not None and k not in _COLUMNS})
    project.update(id=str(row["id"]), title=row["title"], format=row["format"], city=row["city"])
    return project


async def create(pool: asyncpg.Pool, owner_id: UUID, body: CreateProjectInput) -> dict[str, Any]:
    data = body.model_dump(mode="json", by_alias=True, exclude=set(_COLUMNS))
    row = await pool.fetchrow(
        f"insert into projects (owner_id, title, format, city, data) "
        f"values ($1, $2, $3, $4, $5::jsonb) returning {_RETURNING}",
        owner_id,
        body.title,
        body.format,
        body.city,
        json.dumps(data),
    )
    return to_project(row)


async def get(pool: asyncpg.Pool, owner_id: UUID, project_id: str) -> dict[str, Any]:
    row = await pool.fetchrow(
        f"select {_RETURNING} from projects where id = $1 and owner_id = $2",
        _project_id(project_id),
        owner_id,
    )
    if row is None:
        raise _not_found()
    return to_project(row)


async def update(
    pool: asyncpg.Pool, owner_id: UUID, project_id: str, patch: UpdateProjectInput
) -> dict[str, Any]:
    changes = patch.model_dump(mode="json", by_alias=True, exclude_unset=True)
    columns = {k: changes.pop(k) for k in _COLUMNS if k in changes}
    removed = [k for k in OPTIONAL_FIELDS if k in changes and changes[k] is None]
    data_patch = {k: v for k, v in changes.items() if k not in removed}
    row = await pool.fetchrow(
        f"""update projects set
              title = coalesce($3, title),
              format = coalesce($4, format),
              city = coalesce($5, city),
              data = (data || $6::jsonb) - $7::text[],
              version = version + 1
            where id = $1 and owner_id = $2
            returning {_RETURNING}""",
        _project_id(project_id),
        owner_id,
        columns.get("title"),
        columns.get("format"),
        columns.get("city"),
        json.dumps(data_patch),
        removed,
    )
    if row is None:
        raise _not_found()
    return to_project(row)


async def delete(pool: asyncpg.Pool, owner_id: UUID, project_id: str) -> None:
    deleted = await pool.fetchval(
        "delete from projects where id = $1 and owner_id = $2 returning id",
        _project_id(project_id),
        owner_id,
    )
    if deleted is None:
        raise _not_found()
