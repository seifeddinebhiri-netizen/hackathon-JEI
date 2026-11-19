from typing import Annotated

from fastapi import Depends, File, Form, Path, Request, UploadFile

from app.core.auth import CurrentUser, get_current_user
from app.core.config import get_settings
from app.schemas.subtitle import SubtitleDraft, SubtitleSaveRequest
from app.services import project_service, subtitle_service

ProjectId = Annotated[str, Path(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")]
User = Annotated[CurrentUser, Depends(get_current_user)]


def _split(value: str | None) -> list[str]:
    """« Amira, Nour , Sidi Bou Saïd » → ["Amira", "Nour", "Sidi Bou Saïd"]."""
    return [v.strip() for v in (value or "").split(",") if v.strip()]


async def _check_project(request: Request, project_id: str, user: CurrentUser) -> None:
    """Le projet doit appartenir à l'utilisateur du jeton (404 / 403 sinon). Sans base (tests,
    développement), pas de projets à vérifier : les brouillons en mémoire sont alors rangés par
    propriétaire, chacun ne voit que les siens."""
    pool = request.app.state.db_pool
    if pool is not None:
        await project_service.ensure_owned(pool, project_id, user)


async def create_draft(
    project_id: ProjectId,
    request: Request,
    user: User,
    file: Annotated[UploadFile, File(description="Audio ou vidéo du film")],
    language_code: Annotated[str | None, Form(max_length=8)] = None,
    keyterms: Annotated[str | None, Form(max_length=5000)] = None,
    characters: Annotated[str | None, Form(max_length=2000)] = None,
) -> SubtitleDraft:
    """POST /subtitles/{project_id}/draft : transcription + traduction → brouillon à relire."""
    await _check_project(request, project_id, user)
    state = request.app.state
    settings = get_settings()
    return await subtitle_service.create_draft(
        state.db_pool,
        state.transcriber,
        state.translator,
        user.id,
        project_id,
        file,
        settings.subtitle_max_upload_mb,
        language_code=(language_code or "").strip() or None,
        keyterms=_split(keyterms),
        characters=_split(characters),
        timeout_s=settings.subtitle_draft_timeout_s,
    )


async def get_draft(project_id: ProjectId, request: Request, user: User) -> SubtitleDraft:
    await _check_project(request, project_id, user)
    return await subtitle_service.get_draft(request.app.state.db_pool, user.id, project_id)


async def save_subtitles(
    project_id: ProjectId, body: SubtitleSaveRequest, request: Request, user: User
) -> SubtitleDraft:
    await _check_project(request, project_id, user)
    return await subtitle_service.save_lines(
        request.app.state.db_pool, user.id, project_id, body.lines
    )
