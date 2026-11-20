from uuid import UUID

import asyncpg

from app.schemas.ai_tool import Fact

Row = dict


class DatabaseUnavailable(Exception):
    pass


def _require(pool: asyncpg.Pool | None) -> asyncpg.Pool:
    if pool is None:
        from app.core.errors import AppError

        raise AppError(
            "Base de données indisponible.", status_code=503, code="database_unavailable"
        )
    return pool


def _row(record: asyncpg.Record) -> Row:
    d = dict(record)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif isinstance(v, UUID):
            # Tout UUID devient du texte, quel que soit le nom de la colonne (`requested_by`, `tool_id`...) :
            # sinon `UUID(...) != "..."` serait toujours vrai et refuserait l'accès à son propre travail.
            d[k] = str(v)
    return d


async def find_by_alias(pool, name_norm: str) -> Row | None:
    rec = await _require(pool).fetchrow(
        "select t.* from public.ai_tools t join public.ai_tool_aliases a on a.tool_id = t.id "
        "where a.alias_norm = $1",
        name_norm,
    )
    return _row(rec) if rec else None


async def get_by_slug(pool, slug: str) -> Row | None:
    rec = await _require(pool).fetchrow("select * from public.ai_tools where slug = $1", slug)
    return _row(rec) if rec else None


async def search(pool, q: str, limit: int = 20) -> list[Row]:
    pattern = f"%{q.strip().lower()}%" if q.strip() else "%"
    recs = await _require(pool).fetch(
        "select * from public.ai_tools where lower(name) like $1 or lower(vendor) like $1 "
        "or slug like $1 order by name limit $2",
        pattern,
        limit,
    )
    return [_row(r) for r in recs]


async def facts_for(pool, tool_ids: list[str]) -> dict[str, list[Row]]:
    if not tool_ids:
        return {}
    recs = await _require(pool).fetch(
        "select * from public.ai_tool_facts where tool_id = any($1::uuid[]) order by field, plan",
        tool_ids,
    )
    out: dict[str, list[Row]] = {}
    for r in recs:
        row = _row(r)
        out.setdefault(row["tool_id"], []).append(row)
    return out


async def save_tool(
    pool,
    *,
    slug: str,
    name: str,
    vendor: str,
    official_site: str | None,
    categories: list[str],
    terms_url: str | None,
    privacy_url: str | None,
    terms_updated: str | None,
    status: str | None,
    review_state: str,
    research_state: str,
    note_fr: str,
    aliases: list[str],
    facts: list[Fact],
) -> Row:
    """Crée ou remplace un outil, ses noms alternatifs et ses faits, en une seule transaction."""
    async with _require(pool).acquire() as conn, conn.transaction():
        rec = await conn.fetchrow(
            "insert into public.ai_tools (slug, name, vendor, official_site, categories, terms_url, "
            "privacy_url, terms_updated, status, review_state, research_state, note_fr, checked_at) "
            "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now()) "
            "on conflict (slug) do update set name=excluded.name, vendor=excluded.vendor, "
            "official_site=excluded.official_site, categories=excluded.categories, "
            "terms_url=excluded.terms_url, privacy_url=excluded.privacy_url, "
            "terms_updated=excluded.terms_updated, status=excluded.status, "
            "review_state=excluded.review_state, research_state=excluded.research_state, "
            "note_fr=excluded.note_fr, checked_at=now() returning *",
            slug, name, vendor, official_site, categories, terms_url, privacy_url,
            terms_updated, status, review_state, research_state, note_fr,
        )  # fmt: skip
        tool_id = rec["id"]
        await conn.execute("delete from public.ai_tool_facts where tool_id = $1", tool_id)
        for f in facts:
            await conn.execute(
                "insert into public.ai_tool_facts (tool_id, field, plan, value_fr, quote, "
                "source_url, source_kind, quote_verified, human_confirmed) "
                "values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
                tool_id, f.field, f.plan, f.value_fr, f.quote, f.source_url, f.source_kind,
                f.quote_verified, f.human_confirmed,
            )  # fmt: skip
        for alias in aliases:
            await conn.execute(
                "insert into public.ai_tool_aliases (alias_norm, tool_id) values ($1,$2) "
                "on conflict (alias_norm) do nothing",
                alias, tool_id,
            )  # fmt: skip
        return _row(rec)


async def create_run(pool, name_norm: str, user_id: str | None) -> tuple[Row, bool]:
    """Ouvre une recherche. Retourne (run, created) ; created=False si une recherche est déjà en cours
    pour ce nom (index unique : jamais deux recherches en parallèle sur le même outil)."""
    async with _require(pool).acquire() as conn:
        rec = await conn.fetchrow(
            "insert into public.ai_tool_research_runs (name_norm, requested_by) values ($1, $2::uuid) "
            "on conflict (name_norm) where state in ('queued','running') do nothing returning *",
            name_norm,
            user_id,
        )
        if rec:
            return _row(rec), True
        existing = await conn.fetchrow(
            "select * from public.ai_tool_research_runs where name_norm = $1 "
            "and state in ('queued','running')",
            name_norm,
        )
        return _row(existing), False


async def update_run(pool, run_id: str, state: str, error: str | None = None, tool_id=None) -> None:
    await _require(pool).execute(
        "update public.ai_tool_research_runs set state = $2, error = $3, tool_id = $4::uuid, "
        "finished_at = case when $2 in ('done','failed') then now() else null end where id = $1::uuid",
        run_id, state, error, tool_id,
    )  # fmt: skip


async def get_run(pool, run_id: str) -> Row | None:
    rec = await _require(pool).fetchrow(
        "select r.*, t.slug as tool_slug from public.ai_tool_research_runs r "
        "left join public.ai_tools t on t.id = r.tool_id where r.id = $1::uuid",
        run_id,
    )
    return _row(rec) if rec else None


async def count_runs_today(pool) -> int:
    return await _require(pool).fetchval(
        "select count(*) from public.ai_tool_research_runs where created_at > now() - interval '1 day'"
    )


async def mark_stale_runs_failed(pool) -> None:
    """Au démarrage : une recherche restée « en cours » après un redémarrage du serveur est perdue."""
    await _require(pool).execute(
        "update public.ai_tool_research_runs set state='failed', error='serveur redémarré', "
        "finished_at=now() where state in ('queued','running')"
    )


# --- relecture humaine (scripts/review_ai_tools.py) -------------------------------------------
async def list_by_review_state(pool, state: str) -> list[Row]:
    recs = await _require(pool).fetch(
        "select * from public.ai_tools where review_state = $1 order by name", state
    )
    return [_row(r) for r in recs]


async def get_fact(pool, fact_id: str) -> Row | None:
    rec = await _require(pool).fetchrow(
        "select * from public.ai_tool_facts where id = $1::uuid", fact_id
    )
    return _row(rec) if rec else None


async def delete_fact(pool, fact_id: str) -> None:
    await _require(pool).execute("delete from public.ai_tool_facts where id = $1::uuid", fact_id)


async def confirm_fact(pool, fact_id: str) -> None:
    await _require(pool).execute(
        "update public.ai_tool_facts set human_confirmed = true where id = $1::uuid", fact_id
    )


async def set_review(pool, tool_id: str, state: str, reviewer: str | None, status) -> None:
    """Change l'état de relecture d'un outil et enregistre son statut recalculé."""
    await _require(pool).execute(
        "update public.ai_tools set review_state = $2, status = $3, "
        "reviewed_by = case when $2 = 'verifie' then $4 else null end, "
        "reviewed_at = case when $2 = 'verifie' then now() else null end where id = $1::uuid",
        tool_id, state, status, reviewer,
    )  # fmt: skip
