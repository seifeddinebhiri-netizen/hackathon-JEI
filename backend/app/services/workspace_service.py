import json
from uuid import UUID

import asyncpg

from app.core.auth import CurrentUser
from app.core.errors import AppError
from app.repositories import workspace_repository as repo
from app.schemas.workspace import MAX_DATA_BYTES, MAX_WORKSPACES, WorkspaceIn, WorkspaceOut


def _out(row: repo.Row) -> WorkspaceOut:
    return WorkspaceOut(
        id=row["id"],
        name=row["name"],
        data=row["data"],
        version=row["version"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


async def _owned(pool: asyncpg.Pool | None, workspace_id: UUID, user: CurrentUser) -> repo.Row:
    row = await repo.get(pool, str(workspace_id))
    if row is None:
        raise AppError("Espace introuvable.", status_code=404, code="introuvable")
    if row["owner_id"] != user.id:
        raise AppError("Cet espace ne t'appartient pas.", status_code=403, code="interdit")
    return row


async def list_workspaces(pool: asyncpg.Pool | None, user: CurrentUser) -> list[WorkspaceOut]:
    return [_out(r) for r in await repo.list_for_owner(pool, user.id)]


async def get_workspace(
    pool: asyncpg.Pool | None, user: CurrentUser, workspace_id: UUID
) -> WorkspaceOut:
    return _out(await _owned(pool, workspace_id, user))


async def put_workspace(
    pool: asyncpg.Pool | None, user: CurrentUser, workspace_id: UUID, body: WorkspaceIn
) -> WorkspaceOut:
    if len(json.dumps(body.data, ensure_ascii=False).encode()) > MAX_DATA_BYTES:
        raise AppError("Cet espace est trop volumineux.", status_code=413, code="trop_volumineux")
    outcome, row = await repo.upsert(
        pool, user.id, str(workspace_id), body.name, body.data, body.base_version
    )
    if outcome == "forbidden":
        raise AppError("Cet espace ne t'appartient pas.", status_code=403, code="interdit")
    if outcome == "limit":
        raise AppError(
            f"{MAX_WORKSPACES} espaces au maximum : supprime-en un pour en créer un autre.",
            status_code=422,
            code="limite_atteinte",
        )
    if outcome == "conflict":
        raise AppError(
            "Cet espace a été modifié depuis un autre appareil.", status_code=409, code="conflit"
        )
    assert row is not None
    return _out(row)


async def delete_workspace(
    pool: asyncpg.Pool | None, user: CurrentUser, workspace_id: UUID
) -> None:
    row = await repo.get(pool, str(workspace_id))
    if row is None:
        return  # déjà supprimé : la suppression est idempotente
    if row["owner_id"] != user.id:
        raise AppError("Cet espace ne t'appartient pas.", status_code=403, code="interdit")
    await repo.delete(pool, str(workspace_id))
