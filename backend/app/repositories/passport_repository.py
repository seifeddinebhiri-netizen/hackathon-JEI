import json

import asyncpg

from app.repositories.ai_tool_repository import _require

Row = dict


async def get_for_project(pool: asyncpg.Pool | None, project_id: str) -> Row | None:
    rec = await _require(pool).fetchrow(
        "select project_id, owner_id, film_title, director, declarations, badge_code, c2pa_signed "
        "from public.ai_passports where project_id = $1::uuid",
        project_id,
    )
    if rec is None:
        return None
    row = dict(rec)
    row["project_id"] = str(row["project_id"])
    row["owner_id"] = str(row["owner_id"])
    decl = row["declarations"]
    row["declarations"] = json.loads(decl) if isinstance(decl, str) else decl
    return row


async def mark_signed(pool: asyncpg.Pool | None, project_id: str) -> None:
    """Seul le serveur pose `c2pa_signed` (le navigateur n'en a pas le droit, migration 0007)."""
    await _require(pool).execute(
        "update public.ai_passports set c2pa_signed = true where project_id = $1::uuid", project_id
    )


async def get_by_badge(pool: asyncpg.Pool | None, badge_code: str) -> Row | None:
    """Passeport d'après son code de badge (vérification publique : seulement ce qui sert à comparer)."""
    rec = await _require(pool).fetchrow(
        "select film_title, director, declarations from public.ai_passports where badge_code = $1",
        badge_code,
    )
    if rec is None:
        return None
    row = dict(rec)
    decl = row["declarations"]
    row["declarations"] = json.loads(decl) if isinstance(decl, str) else decl
    return row
