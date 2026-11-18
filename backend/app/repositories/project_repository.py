"""Accès SQL aux projets. Le backend ignore la sécurité par ligne de Postgres : chaque
fonction qui touche un projet prend `owner_id` et la propriété est vérifiée par l'appelant."""

import json
from typing import Any

import asyncpg

from app.core.errors import AppError

COLUMN_FIELDS = ("title", "format", "city")
Row = dict[str, Any]


def _require(pool: asyncpg.Pool | None) -> asyncpg.Pool:
    if pool is None:
        raise AppError(
            "Base de données indisponible.", status_code=503, code="database_unavailable"
        )
    return pool


def _to_row(record: asyncpg.Record) -> Row:
    row = dict(record)
    row["id"] = str(row["id"])
    row["owner_id"] = str(row["owner_id"])
    row["data"] = json.loads(row["data"]) if isinstance(row["data"], str) else row["data"]
    return row


async def create(
    pool: asyncpg.Pool | None, owner_id: str, title: str, format_: str, city: str, data: dict
) -> Row:
    async with _require(pool).acquire() as conn, conn.transaction():
        record = await conn.fetchrow(
            "insert into public.projects (owner_id, title, format, city, data) "
            "values ($1::uuid, $2, $3, $4, $5::jsonb) returning *",
            owner_id, title, format_, city, json.dumps(data),
        )  # fmt: skip
        # Premier projet de l'utilisateur : il devient son projet courant.
        await conn.execute(
            "update public.profiles set current_project_id = $1 "
            "where id = $2::uuid and current_project_id is null",
            record["id"], owner_id,
        )  # fmt: skip
    return _to_row(record)


async def get(pool: asyncpg.Pool | None, project_id: str) -> Row | None:
    try:
        record = await _require(pool).fetchrow(
            "select * from public.projects where id = $1::uuid", project_id
        )
    except asyncpg.DataError:  # identifiant qui n'est pas un UUID
        return None
    return _to_row(record) if record else None


async def update(
    pool: asyncpg.Pool | None, project_id: str, columns: dict[str, Any], data_patch: dict
) -> Row:
    sets, args = [], [project_id]
    for name in COLUMN_FIELDS:
        if name in columns:
            args.append(columns[name])
            sets.append(f"{name} = ${len(args)}")
    args.append(json.dumps(data_patch))
    # `||` remplace chaque clé de premier niveau envoyée, sans fusion profonde des listes.
    sets.append(f"data = data || ${len(args)}::jsonb")
    sets.append("version = version + 1")
    record = await _require(pool).fetchrow(
        f"update public.projects set {', '.join(sets)} where id = $1::uuid returning *", *args
    )
    return _to_row(record)


async def delete(pool: asyncpg.Pool | None, project_id: str) -> None:
    await _require(pool).execute("delete from public.projects where id = $1::uuid", project_id)


async def get_profile(pool: asyncpg.Pool | None, user_id: str) -> Row | None:
    record = await _require(pool).fetchrow(
        "select id, display_name, is_demo, current_project_id from public.profiles "
        "where id = $1::uuid",
        user_id,
    )
    if record is None:
        return None
    row = dict(record)
    row["id"] = str(row["id"])
    row["current_project_id"] = (
        str(row["current_project_id"]) if row["current_project_id"] else None
    )
    return row
