"""Accès SQL aux espaces de travail. Le backend ignore la sécurité par ligne de Postgres : la
propriété est vérifiée ici (owner_id) et par le service."""

import json
from typing import Any, Literal

import asyncpg

from app.core.errors import AppError
from app.schemas.workspace import MAX_WORKSPACES

Row = dict[str, Any]
Outcome = Literal["saved", "conflict", "forbidden", "limit"]


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


async def list_for_owner(pool: asyncpg.Pool | None, owner_id: str) -> list[Row]:
    records = await _require(pool).fetch(
        "select * from public.workspaces where owner_id = $1::uuid order by created_at, id",
        owner_id,
    )
    return [_to_row(r) for r in records]


async def get(pool: asyncpg.Pool | None, workspace_id: str) -> Row | None:
    record = await _require(pool).fetchrow(
        "select * from public.workspaces where id = $1::uuid", workspace_id
    )
    return _to_row(record) if record else None


async def upsert(
    pool: asyncpg.Pool | None,
    owner_id: str,
    workspace_id: str,
    name: str,
    data: dict,
    base_version: int | None,
) -> tuple[Outcome, Row | None]:
    """Crée (base_version None) ou met à jour (base_version = version actuelle) un espace.

    Verrou de ligne : deux appareils qui écrivent en même temps sont départagés, le second reçoit
    « conflict » (la version a déjà avancé).
    """
    payload = json.dumps(data, ensure_ascii=False)
    async with _require(pool).acquire() as conn, conn.transaction():
        current = await conn.fetchrow(
            "select * from public.workspaces where id = $1::uuid for update", workspace_id
        )
        if current is None:
            if base_version is not None:
                return "conflict", None  # modifié ailleurs : l'espace n'existe plus
            count = await conn.fetchval(
                "select count(*) from public.workspaces where owner_id = $1::uuid", owner_id
            )
            if count >= MAX_WORKSPACES:
                return "limit", None
            record = await conn.fetchrow(
                "insert into public.workspaces (id, owner_id, name, data) "
                "values ($1::uuid, $2::uuid, $3, $4::jsonb) returning *",
                workspace_id, owner_id, name, payload,
            )  # fmt: skip
            return "saved", _to_row(record)
        if str(current["owner_id"]) != owner_id:
            return "forbidden", None
        if base_version != current["version"]:
            return "conflict", _to_row(current)
        record = await conn.fetchrow(
            "update public.workspaces set name = $2, data = $3::jsonb, version = version + 1 "
            "where id = $1::uuid returning *",
            workspace_id, name, payload,
        )  # fmt: skip
        return "saved", _to_row(record)


async def delete(pool: asyncpg.Pool | None, workspace_id: str) -> None:
    await _require(pool).execute("delete from public.workspaces where id = $1::uuid", workspace_id)
