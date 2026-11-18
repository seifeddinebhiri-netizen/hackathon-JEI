import asyncpg

from app.core.auth import CurrentUser
from app.core.errors import AppError
from app.repositories import project_repository as repo
from app.schemas.project import CreateProjectInput, Me, Project, UpdateProjectInput

DATA_FIELDS = (
    "shooting_window", "max_hours_per_day", "scenes", "locations", "people", "schedule",
    "festival_shortlist", "film_profile", "synopsis", "film_page",
)  # fmt: skip


def _to_project(row: repo.Row) -> Project:
    # `scene_extras` (géré par le backend) reste dans `data` et n'est pas renvoyé au front.
    visible = {k: row["data"][k] for k in DATA_FIELDS if k in row["data"]}
    return Project.model_validate(
        {
            "id": row["id"],
            "title": row["title"],
            "format": row["format"],
            "city": row["city"],
            **visible,
        }
    )


async def _owned(pool: asyncpg.Pool | None, project_id: str, user: CurrentUser) -> repo.Row:
    row = await repo.get(pool, project_id)
    if row is None:
        raise AppError("Projet introuvable.", status_code=404, code="introuvable")
    if row["owner_id"] != user.id:
        raise AppError("Ce projet ne t'appartient pas.", status_code=403, code="interdit")
    return row


async def create_project(
    pool: asyncpg.Pool | None, user: CurrentUser, body: CreateProjectInput
) -> Project:
    data = {
        "shooting_window": body.shooting_window.model_dump(by_alias=True),
        "max_hours_per_day": body.max_hours_per_day,
        "scenes": [], "locations": [], "people": [], "festival_shortlist": [],
        "scene_extras": {},
    }  # fmt: skip
    row = await repo.create(pool, user.id, body.title, body.format, body.city, data)
    return _to_project(row)


async def get_project(pool: asyncpg.Pool | None, user: CurrentUser, project_id: str) -> Project:
    return _to_project(await _owned(pool, project_id, user))


async def update_project(
    pool: asyncpg.Pool | None, user: CurrentUser, project_id: str, body: UpdateProjectInput
) -> Project:
    await _owned(pool, project_id, user)
    sent = body.model_dump(exclude_unset=True, by_alias=True)
    columns = {k: sent.pop(k) for k in repo.COLUMN_FIELDS if sent.get(k) is not None}
    sent = {k: v for k, v in sent.items() if k in DATA_FIELDS}
    row = await repo.update(pool, project_id, columns, sent)
    return _to_project(row)


async def delete_project(pool: asyncpg.Pool | None, user: CurrentUser, project_id: str) -> None:
    await _owned(pool, project_id, user)
    # TODO (avec l'envoi du scénario) : supprimer aussi les fichiers du bucket `scripts`.
    await repo.delete(pool, project_id)


async def get_me(pool: asyncpg.Pool | None, user: CurrentUser) -> Me:
    profile = await repo.get_profile(pool, user.id)
    if profile is None:
        raise AppError("Profil introuvable.", status_code=404, code="introuvable")
    return Me(email=user.email, **profile)
